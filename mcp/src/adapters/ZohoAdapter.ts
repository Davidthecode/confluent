import axios, { AxiosInstance } from "axios";
import { AuthManager } from "../AuthManager";
import { UnifiedContact, FinancialSummary, ContactType, UnifiedContactCreation } from "../unified-schema";

export class ZohoAdapter {
  private auth: AuthManager;

  constructor(authManager: AuthManager) {
    this.auth = authManager;
  }

  private async getAxiosForUser(userId: string): Promise<AxiosInstance> {
    const tokenRecord = await this.auth.getValidTokenRecord(userId, "ZOHO");

    if (!tokenRecord || !tokenRecord.accessToken) {
      throw new Error("AUTH_REQUIRED: Zoho token is missing or invalid. Please re-authenticate.");
    }

    const accessToken = tokenRecord.accessToken;
    const orgId = tokenRecord.orgId;
    if (!orgId) {
      throw new Error("TENANT_REQUIRED: Zoho Organization ID (orgId) is missing. User must select an organization.");
    }
    const apiDomain = tokenRecord.apiDomain ?? "https://www.zohoapis.com";

    const apiBase = `${apiDomain}/books/v3`;

    const instance = axios.create({
      baseURL: apiBase,
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    instance.interceptors.request.use((config) => {
      if (!config.params) {
        config.params = {};
      }
      if (config.params.organization_id === undefined) {
        config.params.organization_id = orgId;
      }
      return config;
    });

    return instance;
  }

  async get_contact_summary(userId: string, contact_type: ContactType): Promise<UnifiedContact[]> {
    const axiosInst = await this.getAxiosForUser(userId);
    const params: any = {
      page: 1,
      per_page: 200,
      include: "balances",
    };

    if (contact_type === "CUSTOMER") {
      params.contact_type = "customer";
    } else if (contact_type === "VENDOR") {
      params.contact_type = "vendor";
    }

    const all: UnifiedContact[] = [];

    while (true) {
      try {
        const resp = await axiosInst.get("/contacts", { params });

        if (!resp.data || !Array.isArray(resp.data.contacts)) {
          console.warn("Unexpected Zoho /contacts response shape:", resp.data);
          break;
        }

        const contacts = resp.data.contacts as any[];

        console.log("zoho contacts ==>", contacts);

        contacts.forEach((c) => {
          console.log("individual contact ==>", c)
          const balance =
            contact_type === "CUSTOMER"
              ? Number(c.outstanding_receivable_amount ?? c.balance ?? 0)
              : Number(c.outstanding_payable_amount ?? c.balance ?? 0);
          all.push({
            id: String(
              c.contact_id ??
              c.contact_code ??
              c.contact_name ??
              c.contact_person?.contact_id ??
              "unknown"
            ),
            name: c.contact_name ?? c.contact_person?.name ?? "Unnamed",
            email:
              typeof c.email === "string"
                ? c.email
                : c.contact_person?.email ?? null,
            type: contact_type,
            balance: isNaN(balance) ? 0 : balance,
          });
        });

        const pageContext = resp.data.page_context;
        if (!pageContext || !pageContext.has_more_page) {
          break;
        }

        params.page = (pageContext.current_page ?? params.page) + 1;
      } catch (err: any) {
        if (err.response) {
          console.error(
            `Zoho /contacts API error (status ${err.response.status}):`,
            err.response.data
          );
        } else if (err.request) {
          console.error("Zoho /contacts network error:", err.message);
        } else {
          console.error("Zoho /contacts unexpected error:", err);
        }
        break;
      }
    }

    console.log("zoho contact summary ==>", all);
    return all;
  }

  async get_financial_summary(
    userId: string,
    start_date: string,
    end_date: string
  ): Promise<FinancialSummary> {
    const axiosInst = await this.getAxiosForUser(userId);
    let totalRevenue = 0;
    let totalExpenses = 0;
    let currency: string = "USD";
    const allInvoices: any[] = [];

    const invoiceParams: any = {
      date_start: start_date,
      date_end: end_date,
      page: 1,
      per_page: 200,
    };

    try {
      while (true) {
        let invResp;
        try {
          invResp = await axiosInst.get("/invoices", { params: invoiceParams });
        } catch (err: any) {
          console.error(
            `Zoho /invoices request failed on page ${invoiceParams.page}:`,
            err?.response?.data || err?.message || err
          );

          if (invoiceParams.page === 1) {
            throw new Error("Failed to fetch invoices from Zoho.");
          } else {
            console.warn(
              "Stopping invoice pagination early due to repeated API error."
            );
            break;
          }
        }

        if (!invResp?.data) {
          console.warn("Empty invoice response received from Zoho.");
          break;
        }

        const invoices = Array.isArray(invResp.data?.invoices)
          ? invResp.data.invoices
          : [];
        allInvoices.push(...invoices);

        console.log(`zoho invoices (page ${invoiceParams.page}) =>`, invoices.length);

        const pageContext = invResp.data?.page_context;
        if (!pageContext || !pageContext.has_more_page) break;

        invoiceParams.page = (pageContext.current_page ?? invoiceParams.page) + 1;
      }

      totalRevenue = allInvoices.reduce((sum, inv) => sum + Number(inv.total ?? 0), 0);
      if (allInvoices.length > 0) {
        currency = allInvoices[0].currency_code || "USD";
      }
    } catch (invErr: any) {
      console.error("Failed to fetch invoices from Zoho:", invErr?.message || invErr);
      throw new Error("Failed to fetch invoices from Zoho.");
    }

    try {
      const expenseParams: any = { date_start: start_date, date_end: end_date, page: 1, per_page: 200 };
      const allExpenses: any[] = [];

      while (true) {
        let expResp;
        try {
          expResp = await axiosInst.get("/expenses", { params: expenseParams });
        } catch (err: any) {
          console.error(
            `Zoho /expenses request failed on page ${expenseParams.page}:`,
            err?.response?.data || err?.message || err
          );

          if (expenseParams.page === 1) {
            throw new Error("Failed to fetch expenses from Zoho.");
          } else {
            console.warn(
              "Stopping expenses pagination early due to repeated API error."
            );
            break;
          }
        }

        const exps = Array.isArray(expResp.data?.expenses) ? expResp.data.expenses : [];
        allExpenses.push(...exps);

        const pageContext = expResp.data?.page_context;
        if (!pageContext || !pageContext.has_more_page) break;

        expenseParams.page = (pageContext.current_page ?? expenseParams.page) + 1;
      }

      totalExpenses = allExpenses.reduce((sum, e) => sum + Number(e.total ?? e.amount ?? 0), 0);
    } catch (err) {
      console.warn("Zoho /expenses failed, trying vendorpayments fallback", err);

      try {
        const vpParams: any = { date_start: start_date, date_end: end_date, page: 1, per_page: 200 };
        const allVPs: any[] = [];

        while (true) {
          let vpResp;
          try {
            vpResp = await axiosInst.get("/vendorpayments", { params: vpParams });
          } catch (innerErr: any) {
            console.error(
              `Zoho /vendorpayments request failed on page ${vpParams.page}:`,
              innerErr?.response?.data || innerErr?.message || innerErr
            );

            if (vpParams.page === 1) {
              throw new Error("Failed to fetch vendor payments from Zoho.");
            } else {
              console.warn(
                "Stopping vendor payments pagination early due to repeated API error."
              );
              break;
            }
          }

          const vps = Array.isArray(vpResp.data?.vendorpayments)
            ? vpResp.data.vendorpayments
            : [];
          allVPs.push(...vps);

          const pageContext = vpResp.data?.page_context;
          if (!pageContext || !pageContext.has_more_page) break;

          vpParams.page = (pageContext.current_page ?? vpParams.page) + 1;
        }

        totalExpenses = allVPs.reduce((sum, p) => sum + Number(p.total ?? p.amount ?? 0), 0);
      } catch (inner) {
        console.warn("Vendorpayments fallback also failed. Total expenses defaulted to 0.", inner);
        totalExpenses = 0;
      }
    }

    const netIncome = totalRevenue - totalExpenses;

    const result: FinancialSummary = {
      startDate: start_date,
      endDate: end_date,
      totalRevenue,
      totalExpenses,
      netIncome,
      currency,
    };

    return result;
  }

  async create_invoice(userId: string, contactId: string, amount: number, dueDate: string): Promise<any> {
    const axiosInst = await this.getAxiosForUser(userId);
    const payload = {
      customer_id: contactId,
      total: amount,
      due_date: dueDate,
      date: new Date().toISOString().split("T")[0],
      line_items: [{
        quantity: 1,
        rate: amount,
        description: "General Service/Item"
      }],
    };

    console.log("zoho invoice ==>", payload);
    try {
      const resp = await axiosInst.post("/invoices", payload);
      console.log("created zoho invoice ==>", resp.data.invoice)
      return { invoice_id: resp.data.invoice.invoice_id };
    } catch (error: any) {
      console.log("error creating zoho invoice ==>", error.response?.data?.message || error.message)
      throw new Error(`Failed to create Zoho invoice: ${error.response?.data?.message || error.message}`);
    }
  }

  async create_contact(userId: string, contact: UnifiedContactCreation): Promise<UnifiedContact> {
    const axiosInst = await this.getAxiosForUser(userId);

    const nameParts = contact.name.split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const payload: any = {
      contact_name: contact.name,
      contact_type: contact.type === "CUSTOMER" ? "customer" : "vendor",
      contact_persons: contact.email ?
        [{
          first_name: firstName,
          last_name: lastName,
          email: contact.email,
          is_primary_contact: true
        }] : []
    };

    console.log("zoho contact payload ==>", payload);
    try {

      const resp = await axiosInst.post(`/contacts`, payload);
      const created = resp.data.contact;

      console.log("created zoho contact ==>", created);
      console.log("created zoho contact email ==>", created.contact_persons?.[0]?.email ?? null,)

      return {
        id: created.contact_id,
        name: created.contact_name,
        email: created.contact_persons?.[0]?.email ?? null,
        type: contact.type,
        balance: 0
      } as UnifiedContact;
    } catch (error: any) {
      throw new Error(`Failed to create Zoho contact: ${error.response?.data?.message || error.message}`);
    }
  }
}