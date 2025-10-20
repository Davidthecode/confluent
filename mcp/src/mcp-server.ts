import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { AuthManager } from "./AuthManager";
import { ZohoAdapter } from "./adapters/ZohoAdapter";
import { XeroAdapter } from "./adapters/XeroAdapter";
import { ResendAdapter } from "./adapters/ResendAdapter";
import { UnifiedContact, FinancialSummary, UnifiedContactCreation } from "./unified-schema";
import { generateConnectionSuccessHTML } from "./templates/OauthConnectionSuccessTemplate";

type JSONRPCRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
};

type JSONRPCResponse = {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
};

async function main() {
  const PORT = Number(process.env.PORT ?? 8080);
  const auth = new AuthManager(process.env.REDIS_URL, process.env.UPSTASH_REDIS_TOKEN);
  const zoho = new ZohoAdapter(auth);
  const xero = new XeroAdapter(auth);
  const resend = new ResendAdapter(process.env.RESEND_API_KEY ?? "");

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  app.post("/rpc", async (req, res) => {
    const rpc: JSONRPCRequest = req.body;
    const response: JSONRPCResponse = { jsonrpc: "2.0", id: rpc.id ?? null };


    try {
      if (!rpc.method) {
        throw new Error("Method required");
      }

      const params = rpc.params ?? {};
      const userId = params.user_id as string | undefined;
      const platform = (params.platform as string | undefined)?.toUpperCase();

      if (rpc.method === "get_oauth_url") {
        const { user_id, platform } = params;
        if (!user_id || !platform || (platform !== "ZOHO" && platform !== "XERO")) {
          response.error = { code: -32602, message: "user_id and platform (ZOHO or XERO) are required" };
          return res.status(400).json(response);
        }
        const upperPlatform = platform.toUpperCase() as "ZOHO" | "XERO";

        try {
          const authUrl = auth.getAuthorizationUrl(upperPlatform, user_id);
          response.result = { auth_url: authUrl };
          return res.json(response);
        } catch (error: any) {
          response.error = { code: -32001, message: error.message || "Failed to generate auth URL." };
          return res.status(500).json(response);
        }
      }

      if (rpc.method === "get_connected_tenants") {
        const { user_id, platform } = params;
        const upperPlatform = (platform as string | undefined)?.toUpperCase() as "ZOHO" | "XERO";

        if (!user_id || (upperPlatform !== "XERO" && upperPlatform !== "ZOHO")) {
          response.error = { code: -32602, message: "user_id and platform (ZOHO or XERO) are required" };
          return res.status(400).json(response);
        }

        try {
          let tenants: any[];
          if (upperPlatform === "XERO") {
            tenants = await auth.getConnectedTenants(user_id, "XERO");
          } else if (upperPlatform === "ZOHO") {
            tenants = await auth.getConnectedTenants(user_id, "ZOHO");
          } else {
            throw new Error("Invalid platform for tenant check.");
          }

          response.result = { tenants };
          return res.json(response);
        } catch (error: any) {
          response.error = { code: -32001, message: error.message || "Failed to fetch tenants." };
          return res.status(500).json(response);
        }
      }

      if (rpc.method === "set_selected_tenant") {
        const { user_id, platform, tenant_id } = params;
        const upperPlatform = (platform as string | undefined)?.toUpperCase() as "ZOHO" | "XERO";

        if (!user_id || (upperPlatform !== "XERO" && upperPlatform !== "ZOHO") || !tenant_id) {
          response.error = { code: -32602, message: "user_id, platform (ZOHO or XERO), and tenant_id are required" };
          return res.status(400).json(response);
        }
        try {
          await auth.setOrgId(user_id, upperPlatform, tenant_id);
          response.result = { success: true };
          return res.json(response);
        } catch (error: any) {
          response.error = { code: -32001, message: error.message || "Failed to set tenant." };
          return res.status(500).json(response);
        }
      }

      if (rpc.method === "get_contact_summary") {
        if (!userId || !platform || (platform !== "ZOHO" && platform !== "XERO")) {
          response.error = { code: -32000, message: "user_id and platform (ZOHO or XERO) are required" };
          return res.status(400).json(response);
        }

        const contact_type = (params.contact_type ?? "CUSTOMER") as "CUSTOMER" | "VENDOR";
        let result: UnifiedContact[] = [];

        switch (platform) {
          case "ZOHO":
            result = await zoho.get_contact_summary(userId, contact_type);
            break;
          case "XERO":
            result = await xero.get_contact_summary(userId, contact_type);
            break;
          default:
            response.error = { code: -32000, message: "Internal error: Invalid platform type." };
            return res.status(500).json(response);
        }
        response.result = result;
        return res.json(response);
      }

      if (rpc.method === "get_financial_summary") {
        console.log("starting financial summary");
        const start_date = params.start_date as string;
        const end_date = params.end_date as string;
        if (!userId || !platform || !start_date || !end_date) {
          console.log("error: params not complete")
          response.error = { code: -32602, message: "user_id, platform, start_date, and end_date are required" };
          return res.status(400).json(response);
        }
        let result: FinancialSummary;
        switch (platform) {
          case "ZOHO":
            result = await zoho.get_financial_summary(userId, start_date, end_date);
            break;
          case "XERO":
            result = await xero.get_financial_summary(userId, start_date, end_date);
            console.log("financial summary result ==>", result)
            break;
          default:
            response.error = { code: -32000, message: "Internal error: Invalid platform type." };
            return res.status(500).json(response);
        }
        response.result = result;
        return res.json(response);
      }

      if (rpc.method === "create_invoice") {
        const { user_id, platform, contact_id, amount, due_date } = params;
        if (!user_id || !platform || !contact_id || !amount || !due_date) {
          response.error = { code: -32602, message: "user_id, platform, contact_id, amount, and due_date are required" };
          return res.status(400).json(response);
        }
        let result;
        switch (platform.toUpperCase()) {
          case "ZOHO":
            result = await zoho.create_invoice(user_id, contact_id, amount, due_date);
            break;
          case "XERO":
            result = await xero.create_invoice(user_id, contact_id, amount, due_date);
            break;
          default:
            response.error = { code: -32000, message: "Invalid platform" };
            return res.status(400).json(response);
        }
        response.result = result;
        return res.json(response);
      }

      if (rpc.method === "create_contact") {
        const { user_id, platform, name, email, contact_type } = params;

        if (!user_id || !platform || !name || !contact_type || (contact_type !== "CUSTOMER" && contact_type !== "VENDOR")) {
          response.error = { code: -32602, message: "user_id, platform, name, and valid contact_type (CUSTOMER or VENDOR) are required" };
          return res.status(400).json(response);
        }

        const contactCreation: UnifiedContactCreation = { name, email, type: contact_type };
        let result: UnifiedContact;

        switch (platform.toUpperCase()) {
          case "ZOHO":
            result = await zoho.create_contact(user_id, contactCreation);
            break;
          case "XERO":
            result = await xero.create_contact(user_id, contactCreation);
            break;
          default:
            response.error = { code: -32000, message: "Invalid platform" };
            return res.status(400).json(response);
        }

        response.result = result;
        return res.json(response);
      }

      if (rpc.method === "send_email") {
        const { to, subject, html, tags } = params;

        if (!to || !subject || !html) {
          response.error = { code: -32602, message: "to, subject, and html body are required" };
          return res.status(400).json(response);
        }

        try {
          const result = await resend.sendEmail({ to, subject, html, tags });
          response.result = result;
          return res.json(response);
        } catch (error: any) {
          response.error = { code: -32001, message: error.message || "Failed to send email." };
          return res.status(500).json(response);
        }
      }

      response.error = { code: -32601, message: "Method not found" };
      return res.json(response);
    } catch (err: any) {
      console.error("RPC error", err);
      const errorCode = -32001;
      const errorMessage = err.message ?? "Internal error";
      response.error = {
        code: errorCode,
        message: "Internal error: see data for details",
        data: errorMessage
      };
      return res.status(200).json(response);
    }
  });

  app.get("/", (_req, res) => {
    res.send("Financial MCP Server - RPC endpoint at /rpc");
  });

  app.get("/connect/:platform", (req, res) => {
    const { platform } = req.params;
    const userId = req.query.user_id as string;

    if (!userId) {
      return res.status(400).send("Error: 'user_id' query parameter is required to initiate connection.");
    }

    const upperPlatform = platform.toUpperCase();
    if (upperPlatform !== "ZOHO" && upperPlatform !== "XERO") {
      return res.status(400).send("Error: Invalid platform");
    }

    try {
      const authUrl = auth.getAuthorizationUrl(upperPlatform as "ZOHO" | "XERO", userId);

      console.log(`\n\n[OAUTH INITIATOR] Authorization URL for ${upperPlatform}: ${authUrl}\n\n`);

      res.send(`
      <h1>Connect ${upperPlatform}</h1>
      <p>Authorization URL generated for user: <strong>${userId}</strong></p>
      <p>Click <a href="${authUrl}">here to authorize</a> or copy the URL from the console/browser address bar.</p>
      <p>Make sure your server is accessible at the <code>${upperPlatform}_REDIRECT_URI</code> defined in your .env file.</p>
    `);
    } catch (error: any) {
      console.error(`Failed to generate URL for ${platform}:`, error);
      res.status(500).send(`Error generating auth URL: ${error?.message}`);
    }
  });

  app.get("/oauth/callback/zoho", async (req, res) => {
    const { code, state: userId, "accounts-server": apiDomain } = req.query;

    if (!code || !userId) {
      return res.status(400).send("Error: Missing authorization code or user state.");
    }

    try {
      const exchangeResult = await auth.exchangeCodeForToken("ZOHO", code as string, userId as string, apiDomain as string | undefined);

      const nextStep = exchangeResult.requiresOrgSelection
        ? "The agent will now ask you to select one of your Zoho Organizations (Tenants)."
        : "Your token has been successfully saved. Please re-run your original request.";

      res.send(generateConnectionSuccessHTML({
        platform: "Zoho",
        userId: userId as string,
        nextStep: nextStep,
      }));
    } catch (error: any) {
      console.error("Zoho OAuth Exchange Failed:", error);
      res.status(500).send(generateConnectionSuccessHTML({
        platform: "Zoho",
        userId: userId as string,
        isError: true,
        errorMessage: error.message,
        nextStep: "Please try the authentication link again.",
      }));
    }
  });


  app.get("/oauth/callback/xero", async (req, res) => {
    const { code, state: userId, scope } = req.query;

    if (!code || !userId) {
      return res.status(400).send("Error: Missing authorization code or user state.");
    }

    try {
      const exchangeResult = await auth.exchangeCodeForToken("XERO", code as string, userId as string);

      const nextStep = exchangeResult.requiresOrgSelection
        ? "The agent will now ask you to select one of your Xero Organizations (Tenants)."
        : "Your token has been successfully saved. Please re-run your original request.";

      res.send(generateConnectionSuccessHTML({
        platform: "Xero",
        userId: userId as string,
        nextStep: nextStep,
      }));
    } catch (error: any) {
      console.error("Xero OAuth Exchange Failed:", error);
      res.status(500).send(generateConnectionSuccessHTML({
        platform: "Xero",
        userId: userId as string,
        isError: true,
        errorMessage: error.message,
        nextStep: "Please try the authentication link again.",
      }));
    }
  });

  app.listen(PORT, () => {
    console.log(`MCP server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});