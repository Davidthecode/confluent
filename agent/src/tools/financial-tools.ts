import { createTool } from "@iqai/adk";
import { callMcp, handleAuthOrTenantError } from "../utils/tools";
import { generateInvoiceEmailHTML } from "../templates/InvoiceEmailTemplate";
import { generateGenericEmailHTML } from "../templates/GenericEmailTemplate";
import { z } from "zod";

/* --- Schemas & helper types --- */
const PlatformEnum = z.enum(["ZOHO", "XERO"]);
type PlatformType = z.infer<typeof PlatformEnum>;

const ContactTypeEnum = z.enum(["CUSTOMER", "VENDOR"]);
type ContactTypeType = z.infer<typeof ContactTypeEnum>;

export function createFinancialTools(userId: string) {
  console.log("using userid ==>", userId)
  return {
    GetOAuthUrlTool: createTool({
      name: "get_oauth_url",
      description: "Fetches the authorization URL for the user to connect a platform (XERO/ZOHO).",
      schema: z.object({
        platform: PlatformEnum,
      }),
      fn: async (args: { platform: PlatformType }) => {
        return await callMcp("get_oauth_url", { user_id: userId, ...args });
      },
    }),

    GetConnectedTenantsTool: createTool({
      name: "get_connected_tenants",
      description: "Fetches a list of connected organizations (tenants) for the user (XERO/ZOHO).",
      schema: z.object({
        platform: PlatformEnum
      }),
      fn: async (args: { platform: PlatformType }) => {
        const res = await callMcp("get_connected_tenants", { user_id: userId, ...args });
        if (!res.success && res.error) {
          const handled = await handleAuthOrTenantError(res.error, userId, args.platform);
          if (handled.error !== res.error) {
            return handled;
          }
        }
        return res;
      },
    }),

    SetSelectedTenantTool: createTool({
      name: "set_selected_tenant",
      description: "Sets the active organization (tenant) ID for the user (XERO/ZOHO).",
      schema: z.object({
        platform: PlatformEnum,
        tenant_id: z.string().describe("The organization/tenant ID selected by the user."),
      }),
      fn: async (args: { platform: PlatformType; tenant_id: string }) => {
        return await callMcp("set_selected_tenant", { user_id: userId, ...args });
      },
    }),

    GetFinancialSummaryTool: createTool({
      name: "get_financial_summary",
      description:
        "Fetch financial summary for the user from Zoho or Xero between start_date and end_date (YYYY-MM-DD). Returns a structured summary.",
      schema: z.object({
        platform: PlatformEnum,
        start_date: z.string(),
        end_date: z.string(),
      }),
      fn: async (args: {
        platform: PlatformType;
        start_date: string;
        end_date: string;
      }) => {
        const res = await callMcp("get_financial_summary", { user_id: userId, ...args });
        console.log("res from finalcial summary ===>", res);
        if (!res.success && res.error) {
          const handled = await handleAuthOrTenantError(res.error, userId, args.platform);
          if (handled.error !== res.error) {
            return handled;
          }
        }
        return res;
      },
    }),

    GetContactSummaryTool: createTool({
      name: "get_contact_summary",
      description: "Get customer or vendor contact summaries with balances for the user.",
      schema: z.object({
        platform: PlatformEnum,
        contact_type: ContactTypeEnum,
      }),
      fn: async (args: { platform: PlatformType; contact_type: ContactTypeType }) => {
        const res = await callMcp("get_contact_summary", { user_id: userId, ...args });
        if (!res.success && res.error) {
          const handled = await handleAuthOrTenantError(res.error, userId, args.platform);
          if (handled.error !== res.error) {
            return handled;
          }
        }
        return res;
      },
    }),

    CreateInvoiceTool: createTool({
      name: "create_invoice",
      description:
        "Creates a new invoice on the specified platform for the user. Returns invoice details / id on success.",
      schema: z.object({
        platform: PlatformEnum,
        contact_id: z.string(),
        amount: z.number(),
        due_date: z.string(),
      }),
      fn: async (args: {
        platform: PlatformType;
        contact_id: string;
        amount: number;
        due_date: string;
      }) => {
        const res = await callMcp("create_invoice", { user_id: userId, ...args });
        if (!res.success && res.error) {
          const handled = await handleAuthOrTenantError(res.error, userId, args.platform);
          if (handled.error !== res.error) {
            return handled;
          }
        }
        return res;
      },
    }),

    SendEmailTool: createTool({
      name: "send_email",
      description: "Sends a generic email to a recipient using Resend (Resend-backed SMTP). Requires the subject and HTML content.",
      schema: z.object({
        to: z.email(),
        subject: z.string(),
        html: z.string(),
        tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
      }),
      fn: async (args: { to: string; subject: string; html: string; tags?: { name: string; value: string }[] }) => {
        return await callMcp("send_email", args);
      },
    }),

    CreateContactTool: createTool({
      name: "create_contact",
      description: "Creates a new customer or vendor contact on the specified platform. Use this if the user asks to create a new client or supplier.",
      schema: z.object({
        platform: PlatformEnum,
        name: z.string().describe("The full name of the contact (e.g., 'Acme Corp')."),
        email: z.string().email().optional().describe("The contact's email address."),
        contact_type: ContactTypeEnum.describe("The type of contact (CUSTOMER or VENDOR)."),
      }),
      fn: async (args: { platform: PlatformType; name: string; email?: string; contact_type: ContactTypeType }) => {
        const res = await callMcp("create_contact", { user_id: userId, ...args });
        if (!res.success && res.error) {
          const handled = await handleAuthOrTenantError(res.error, userId, args.platform);
          if (handled.error !== res.error) {
            return handled;
          }
        }
        return res;
      },
    }),

    GenerateInvoiceHtmlTool: createTool({
      name: "generate_invoice_html",
      description: "Generates the full HTML content for an invoice email. Use this immediately after successfully creating an invoice to get the HTML for the 'send_email' tool.",
      schema: z.object({
        to: z.email().describe("The recipient's email address."),
        invoice_id: z.string().describe("The ID of the invoice created by the 'create_invoice' tool."),
        amount: z.number().describe("The total invoice amount."),
        due_date: z.string().describe("The invoice due date (YYYY-MM-DD)."),
        company_name: z.string().describe("The name of the company sending the invoice."),
      }),
      fn: async (args: {
        to: string;
        invoice_id: string;
        amount: number;
        due_date: string;
        company_name: string;
      }) => {
        const htmlContent = generateInvoiceEmailHTML({
          invoiceId: args.invoice_id,
          amount: args.amount,
          dueDate: args.due_date,
          companyName: args.company_name,
        });

        return { success: true, data: htmlContent };
      },
    }),

    GenerateGenericEmailHtmlTool: createTool({
      name: "generate_generic_email_html",
      description: "Generates the full HTML email body for arbitrary text content (like reminders or status updates). Use this when the user asks you to send a custom message.",
      schema: z.object({
        body_content: z.string().describe("The primary text message generated by the LLM for the email body."),
        sender_name: z.string().describe("The name of the entity sending the email (e.g., 'Financial Assistant')."),
      }),
      fn: async (args: {
        body_content: string;
        sender_name: string;
      }) => {
        const htmlContent = generateGenericEmailHTML({
          bodyContent: args.body_content,
          senderName: args.sender_name,
        });

        return { success: true, data: htmlContent };
      },
    }),
  };
}