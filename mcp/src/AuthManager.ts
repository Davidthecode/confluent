import { Redis } from "@upstash/redis";
import axios from "axios";
import { URLSearchParams } from "url";

export type Platform = "ZOHO" | "XERO";

export interface TokenRecord {
  accessToken: string;
  refreshToken?: string;
  expiryTime: number;
  scope?: string;
  refreshedAt?: number;
  apiDomain?: string;
  orgId?: string;
}

export class AuthManager {
  private redis: Redis;
  private prefix = "tokens";


  constructor(redisUrl?: string, token?: string) {
    const url = redisUrl ?? process.env.REDIS_URL;
    const upstashToken = token ?? process.env.UPSTASH_REDIS_TOKEN;
    if (!url || !upstashToken) {
      throw new Error("Upstash REDIS_URL and UPSTASH_REDIS_TOKEN must be set in environment");
    }
    this.redis = new Redis({ url, token: upstashToken });
  }


  private makeKey(userId: string, platform: Platform) {
    return `${this.prefix}:${userId}:${platform}`;
  }


  async getToken(userId: string, platform: Platform): Promise<TokenRecord | null> {
    const key = this.makeKey(userId, platform);

    const raw = await this.redis.get(key) as string | null;
    if (!raw) {
      return null;
    }
    try {
      const parsed = raw as unknown as TokenRecord;

      if (typeof parsed === "object" && parsed.accessToken) {
        return parsed;
      } else {
        return null;
      }

    } catch (err) {
      return null;
    }
  }

  async setToken(userId: string, platform: Platform, token: TokenRecord): Promise<void> {
    const key = this.makeKey(userId, platform);
    await this.redis.set(key, JSON.stringify(token));
  }

  async deleteToken(userId: string, platform: Platform): Promise<void> {
    const key = this.makeKey(userId, platform);
    await this.redis.del(key);
  }

  async getValidTokenRecord(userId: string, platform: Platform): Promise<TokenRecord | null> {
    const tokenRecord = await this.getToken(userId, platform);

    if (!tokenRecord) {
      return null;
    }

    const now = Date.now();
    if (tokenRecord.expiryTime > now + 30000) {
      return tokenRecord
    }

    if (!tokenRecord.refreshToken) {
      return null;
    }

    try {
      const refreshed = await this.refreshToken(platform, tokenRecord.refreshToken, tokenRecord.apiDomain);
      const newRecord: TokenRecord = {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? tokenRecord.refreshToken,
        expiryTime: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
        scope: refreshed.scope,
        refreshedAt: Date.now(),
        apiDomain: tokenRecord.apiDomain,
        orgId: tokenRecord.orgId
      };
      await this.setToken(userId, platform, newRecord);
      return newRecord;
    } catch (err) {
      return null;
    }
  }

  private async refreshToken(platform: Platform, refreshToken: string, apiDomain?: string): Promise<any> {
    if (platform === "ZOHO") {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error("Zoho client credentials not set");
      }

      const baseDomain = apiDomain
        ? apiDomain.replace("www.", "accounts.")
        : "https://accounts.zoho.com";

      const params = new URLSearchParams();
      params.append("refresh_token", refreshToken);
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("grant_type", "refresh_token");

      const resp = await axios.post(`${baseDomain}/oauth/v2/token`, params);
      return resp.data;
    }


    if (platform === "XERO") {
      const clientId = process.env.XERO_CLIENT_ID;
      const clientSecret = process.env.XERO_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error("Xero client credentials not set");
      }
      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", refreshToken);
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const resp = await axios.post("https://identity.xero.com/connect/token", params.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      return resp.data;
    }

    throw new Error("Unsupported platform for refresh");
  }

  getAuthorizationUrl(platform: Platform, userId: string): string {
    if (platform === "ZOHO") {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const redirectUri = process.env.ZOHO_REDIRECT_URI;
      const scope = process.env.ZOHO_SCOPES ?? "ZohoBooks.fullaccess.all,offline_access";
      const url = new URL("https://accounts.zoho.com/oauth/v2/auth");
      url.searchParams.set("client_id", clientId ?? "");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scope);
      url.searchParams.set("redirect_uri", redirectUri ?? "");
      url.searchParams.set("state", userId);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      return url.toString();
    }

    if (platform === "XERO") {
      const clientId = process.env.XERO_CLIENT_ID;
      const redirectUri = process.env.XERO_REDIRECT_URI;
      const scope = process.env.XERO_SCOPES ?? "offline_access accounting.transactions accounting.settings accounting.contacts accounting.reports.read";
      const url = new URL("https://login.xero.com/identity/connect/authorize");
      url.searchParams.set("client_id", clientId ?? "");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", scope);
      url.searchParams.set("redirect_uri", redirectUri ?? "");
      url.searchParams.set("state", userId);
      return url.toString();
    }
    throw new Error("Unsupported platform");
  }

  async exchangeCodeForToken(
    platform: Platform,
    code: string,
    userId: string,
    zohoApiDomain?: string
  ): Promise<{ requiresOrgSelection: boolean }> {
    let respData: any;
    let accountsUrl: string = "";

    if (platform === "ZOHO") {
      const clientId = process.env.ZOHO_CLIENT_ID;
      const clientSecret = process.env.ZOHO_CLIENT_SECRET;
      const redirectUri = process.env.ZOHO_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("Zoho client/redirect credentials not set for code exchange");
      }

      accountsUrl = zohoApiDomain
        ? zohoApiDomain.replace("www.zohoapis", "accounts.zoho") + "/oauth/v2/token"
        : "https://accounts.zoho.com/oauth/v2/token";

      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("client_id", clientId);
      params.append("client_secret", clientSecret);
      params.append("redirect_uri", redirectUri);
      params.append("code", code);

      const resp = await axios.post(accountsUrl, params);
      respData = resp.data;

      const tempTokenRecord: TokenRecord = {
        accessToken: respData.access_token,
        refreshToken: respData.refresh_token,
        expiryTime: Date.now() + (respData.expires_in ?? 3600) * 1000,
        scope: respData.scope,
        apiDomain: respData.api_domain ?? zohoApiDomain ?? "https://www.zohoapis.com",
      };

      await this.setToken(userId, platform, tempTokenRecord);
      return { requiresOrgSelection: true };
    }

    if (platform === "XERO") {
      const clientId = process.env.XERO_CLIENT_ID;
      const clientSecret = process.env.XERO_CLIENT_SECRET;
      const redirectUri = process.env.XERO_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("Xero client/redirect credentials not set for code exchange");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);
      params.append("redirect_uri", redirectUri);

      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

      const resp = await axios.post("https://identity.xero.com/connect/token", params.toString(), {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });
      respData = resp.data;

      const tokenRecord: TokenRecord = {
        accessToken: respData.access_token,
        refreshToken: respData.refresh_token,
        expiryTime: Date.now() + (respData.expires_in ?? 1800) * 1000,
        scope: respData.scope,
      };

      await this.setToken(userId, platform, tokenRecord);

      return { requiresOrgSelection: true };
    }

    throw new Error("Unsupported platform for code exchange");
  }

  async getConnectedTenants(userId: string, platform: Platform): Promise<any[]> {
    const tokenRecord = await this.getValidTokenRecord(userId, platform);

    if (!tokenRecord) {
      throw new Error("AUTH_REQUIRED: No token found to check connections.");
    }

    if (platform === "XERO") {
      const connectionsResp = await axios.get("https://api.xero.com/connections", {
        headers: {
          Authorization: `Bearer ${tokenRecord.accessToken}`,
          "Content-Type": "application/json"
        }
      });

      const tenants = connectionsResp.data as any[];

      if (!Array.isArray(tenants) || tenants.length === 0) {
        throw new Error("Xero user has no active connected tenants (organizations).");
      }
      return tenants;
    }

    if (platform === "ZOHO") {
      const apiDomain = tokenRecord.apiDomain ?? "https://www.zohoapis.com";
      const apiBase = `${apiDomain}/books/v3`;

      try {
        const orgsResp = await axios.get(`${apiBase}/organizations`, {
          headers: {
            Authorization: `Zoho-oauthtoken ${tokenRecord.accessToken}`
          }
        });

        const organizations = orgsResp.data.organizations as any[];

        if (!Array.isArray(organizations) || organizations.length === 0) {
          throw new Error("Zoho account has no active organizations.");
        }

        return organizations.map(org => ({
          id: org.organization_id,
          name: org.name,
        }));
      } catch (error: any) {
        throw new Error(`Failed to fetch Zoho organizations: ${error.response?.data?.message || error.message}`);
      }
    }

    throw new Error("Unsupported platform for tenant retrieval");
  }

  async setOrgId(userId: string, platform: Platform, orgId: string): Promise<void> {
    const tokenRecord = await this.getToken(userId, platform);
    if (!tokenRecord) {
      throw new Error(`Token record not found for user ${userId} and platform ${platform}`);
    }
    const updatedRecord: TokenRecord = {
      ...tokenRecord,
      orgId: orgId,
    };
    await this.setToken(userId, platform, updatedRecord);
  }

  async getOrgId(userId: string, platform: Platform): Promise<string | undefined> {
    const tokenRecord = await this.getToken(userId, platform);
    return tokenRecord?.orgId;
  }
}