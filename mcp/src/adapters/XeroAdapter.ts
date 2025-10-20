import axios, { AxiosInstance } from "axios";
import { AuthManager } from "../AuthManager";
import { UnifiedContact, FinancialSummary, ContactType, UnifiedContactCreation } from "../unified-schema";

export class XeroAdapter {
  private auth: AuthManager;
  private apiBase = "https://api.xero.com/api.xro/2.0";

  constructor(authManager: AuthManager) {
    this.auth = authManager;
  }

  private async getAxiosForUser(userId: string): Promise<AxiosInstance> {
    const tokenRecord = await this.auth.getValidTokenRecord(userId, "XERO");

    if (!tokenRecord) {
      throw new Error("AUTH_REQUIRED: Xero token is missing or invalid. Please re-authenticate.");
    }

    const accessToken = tokenRecord.accessToken;
    const tenantId = tokenRecord.orgId;

    if (!tenantId) {
      throw new Error("TENANT_REQUIRED: Xero Tenant ID (orgId) is missing from the token record. User must reconnect or select an organization.");
    }

    const instance = axios.create({
      baseURL: this.apiBase,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Xero-Tenant-Id": tenantId
      }
    });
    return instance;
  }

  async get_contact_summary(userId: string, contact_type: ContactType): Promise<UnifiedContact[]> {
    console.log("getting contacts summary ==>", userId, contact_type)
    const axiosInst = await this.getAxiosForUser(userId);
    const allContacts: any[] = [];
    let page = 1;

    while (true) {
      let resp;
      try {
        resp = await axiosInst.get("/Contacts", { params: { page: page } });
      } catch (err) {
        console.warn(`Failed to fetch contacts on page ${page}:`, err);
        break;
      }

      console.log("contacts data response ==>", resp.data);
      console.log("contacts ==> ", JSON.stringify(resp.data?.Contacts, null, 2))
      const contacts = resp.data.Contacts as any[];

      if (!contacts || contacts.length === 0) {
        break;
      }

      allContacts.push(...contacts);

      if (contacts.length < 100) {
        break;
      }

      page++;
    }

    const filtered = allContacts.filter((c) => {
      const isGeneric = !c.IsCustomer && !c.IsSupplier;

      if (contact_type === "CUSTOMER") {
        return c.IsCustomer === true || isGeneric;
      }

      if (contact_type === "VENDOR") {
        return c.IsSupplier === true || isGeneric;
      }

      return true;
    });

    const mapped: UnifiedContact[] = filtered.map((c) => {
      let balance = 0;

      if (contact_type === "CUSTOMER") {
        balance = c.Balances?.AccountsReceivable?.Outstanding ?? 0;
      } else {
        balance = c.Balances?.AccountsPayable?.Outstanding ?? 0;
      }

      const contactId = String(c.ContactID ?? c.ContactNumber ?? c.Name);

      return {
        id: contactId,
        name: c.Name ?? "Unnamed",
        email: (Array.isArray(c.Emails) && c.Emails[0]) ? c.Emails[0].Address : (c.EmailAddress ?? null),
        type: contact_type,
        balance: isNaN(balance) ? 0 : balance
      };
    });

    return mapped;
  }

  async get_financial_summary(userId: string, start_date: string, end_date: string): Promise<FinancialSummary> {
    const axiosInst = await this.getAxiosForUser(userId);

    try {
      const resp = await axiosInst.get("/Reports/ProfitAndLoss", {
        params: { fromDate: start_date, toDate: end_date }
      });

      const report = resp.data.Reports?.[0];
      let totalRevenue = 0;
      let totalExpenses = 0;
      if (report && report.Rows && Array.isArray(report.Rows.Row)) {
        const rows = report.Rows.Row as any[];
        rows.forEach((r) => {
          if (!r.Cells) return;
          const label = (r.Label ?? "").toString().toLowerCase();
          if (label.includes("revenue") || label.includes("income") || label.includes("sales")) {
            const val = Number(r.Cells?.[1]?.Value ?? 0);
            totalRevenue += isNaN(val) ? 0 : val;
          }
          if (label.includes("expense") || label.includes("cost")) {
            const val = Number(r.Cells?.[1]?.Value ?? 0);
            totalExpenses += isNaN(val) ? 0 : val;
          }
        });
      }

      const netIncome = totalRevenue - totalExpenses;
      const currency = report?.Currency ?? (process.env.DEFAULT_CURRENCY ?? "USD");
      return {
        startDate: start_date,
        endDate: end_date,
        totalRevenue,
        totalExpenses,
        netIncome,
        currency
      } as FinancialSummary;
    } catch (err) {
      console.warn("Failed to fetch Xero P&L report; attempting fallback via Invoices and Bank Transactions", err);

      let totalRevenue = 0;
      try {
        const invoicesResp = await axiosInst.get("/Invoices", {
          params: {
            where: `Status=="AUTHORISED" AND Date >= DateTime("${start_date}") AND Date <= DateTime("${end_date}")`
          }
        });
        const invoices = invoicesResp.data.Invoices as any[];
        totalRevenue = invoices.reduce((s, inv) => s + Number(inv.Total ?? 0), 0);
      } catch (invErr) {
        console.warn("Failed to fetch Xero invoices; totalRevenue set to 0", invErr);
        totalRevenue = 0;
      }

      let totalExpenses = 0;
      try {
        const bankResp = await axiosInst.get("/BankTransactions", { params: { where: `Date >= DateTime(${start_date}) AND Date <= DateTime(${end_date})` } });
        const trans = bankResp.data.BankTransactions as any[];
        totalExpenses = trans.reduce((s, t) => s + Number(t.Total ?? 0), 0);
      } catch (inner) {
        console.warn("Could not fetch bank transactions; expenses=0", inner);
        totalExpenses = 0;
      }

      const netIncome = totalRevenue - totalExpenses;
      return {
        startDate: start_date,
        endDate: end_date,
        totalRevenue,
        totalExpenses,
        netIncome,
        currency: process.env.DEFAULT_CURRENCY ?? "USD"
      } as FinancialSummary;
    }
  }

  async create_invoice(userId: string, contactId: string, amount: number, dueDate: string): Promise<any> {
    const axiosInst = await this.getAxiosForUser(userId);
    const payload = {
      Type: "ACCREC",
      Contact: { ContactID: contactId },
      Date: new Date().toISOString().split("T")[0],
      DueDate: dueDate,
      LineItems: [{ Quantity: 1, UnitAmount: amount }],
    };
    try {
      const resp = await axiosInst.post("/Invoices", { Invoices: [payload] });
      return { invoice_id: resp.data.Invoices[0].InvoiceID };
    } catch (error: any) {
      throw new Error(`Failed to create xero invoice: ${error.response?.data?.message || error.message}`);
    }
  }

  async create_contact(userId: string, contact: UnifiedContactCreation): Promise<UnifiedContact> {
    const axiosInst = await this.getAxiosForUser(userId);

    const payload: any = {
      Name: contact.name,
      EmailAddress: contact.email,
    };

    if (contact.type === "CUSTOMER") {
      payload.IsCustomer = true;
    } else if (contact.type === "VENDOR") {
      payload.IsSupplier = true;
    }

    console.log("creating customer with payload ==>", payload);

    try {
      const resp = await axiosInst.post("/Contacts", { Contacts: [payload] });
      const created = resp.data.Contacts[0];

      console.log("created customer ==>", created);

      return {
        id: created.ContactID,
        name: created.Name,
        email: created.EmailAddress ?? null,
        type: contact.type,
        balance: 0
      } as UnifiedContact;
    } catch (error: any) {
      throw new Error(`Failed to create xero contact: ${error.response?.data?.message || error.message}`);
    }
  }
}