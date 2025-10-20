import axios, { AxiosError } from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const MCP_URL = process.env.MCP_URL ?? "http://localhost:8080/rpc";

interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

interface JSONRPCErrorResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  error: JSONRPCError;
}

export async function callMcp(method: string, params: Record<string, any>) {
  try {
    const resp = await axios.post(
      MCP_URL,
      { jsonrpc: "2.0", method, params, id: Date.now() },
      { timeout: 10_000 }
    );

    if (resp.data?.error) {
      const errorMessage = resp.data.error.data ?? resp.data.error.message ?? "MCP error";
      console.error(`[MCP ERROR] ${method}:`, errorMessage);
      return { success: false, error: errorMessage };
    }

    console.log(`[MCP SUCCESS] ${method}:`, resp.data.result);
    return { success: true, data: resp.data.result };
  } catch (err: any) {
    const axiosError = err as AxiosError;

    if (axiosError.response) {
      const responseData = axiosError.response.data;
      const isMcpResponseError = (responseData as JSONRPCErrorResponse)?.error;

      if (isMcpResponseError) {
        const mcpErrorData = (responseData as JSONRPCErrorResponse).error;
        const errorMessage = mcpErrorData.data ?? mcpErrorData.message ?? "MCP error";

        console.error(`[MCP ERROR] ${method} (HTTP ${axiosError.response.status}):`, errorMessage);
        return { success: false, error: errorMessage };
      }
    }

    console.error(`[RPC ERROR] ${method}:`, err?.message ?? err);
    return { success: false, error: err?.message ?? "Network or internal error" };
  }
}

export async function handleAuthOrTenantError(
  error: string,
  userId: string,
  platform: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (error.startsWith("AUTH_REQUIRED:")) {
    const oauthRes = await callMcp("get_oauth_url", { user_id: userId, platform });
    if (oauthRes.success && oauthRes.data?.auth_url) {
      return {
        success: false,
        error: `Authentication required for ${platform}. Please click this link to authenticate: ${oauthRes.data.auth_url}. After completing authentication, retry your original request.`
      };
    }
  } else if (error.startsWith("TENANT_REQUIRED:")) {
    console.log("calling tenant mcp")
    const tenantsRes = await callMcp("get_connected_tenants", { user_id: userId, platform });
    console.log("tenant mcp res in agent ==>", tenantsRes);
    if (tenantsRes.success && tenantsRes.data?.tenants) {
      const tenantsList = tenantsRes.data.tenants;
      const tenantsStr = tenantsList.map((t: any) => `- ID: ${t.tenantId}, Name: ${t.tenantName}`).join("\n");
      return {
        success: false,
        error: `Tenant selection required for ${platform}. Please choose an organization from the list below and provide the ID:\n${tenantsStr}\nOnce you provide the ID, I'll set it and you can retry your request.`
      };
    }
  }
  return { success: false, error };
}