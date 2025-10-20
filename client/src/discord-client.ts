import { Client, GatewayIntentBits } from "discord.js";
import axios, { AxiosError } from "axios";
import * as dotenv from "dotenv";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const AGENT_URL = process.env.AGENT_URL || "http://localhost:3000/prompt";

if (!DISCORD_TOKEN) {
  throw new Error("Missing DISCORD_TOKEN in .env");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }

  // restrict to a specific channel
  // wed diaable this for public use
  if (DISCORD_CHANNEL_ID && message.channelId !== DISCORD_CHANNEL_ID) {
    return;
  }

  const prompt = message.content.trim();
  if (!prompt) {
    return;
  }

  const userId = message.author.id;

  try {
    const response = await axios.post(AGENT_URL, {
      user_id: userId,
      prompt,
    });

    let reply = response.data.response || "No response from server.";
    if (typeof reply !== "string") {
      reply = JSON.stringify(reply, null, 2);
    }

    // Handle Discord's 2000-character limit
    const maxLength = 2000;
    if (reply.length <= maxLength) {
      await message.reply(reply);
    } else {
      const chunks = reply.match(new RegExp(`.{1,${maxLength}}`, "g")) || [];
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    }
  } catch (err) {
    console.error(`Error processing prompt for user ${userId}:`, err);

    const axiosError = err as AxiosError;
    let reply = "Failed to process request. Check server logs for details.";

    if (axiosError.response) {
      const errorData = axiosError.response.data as any;
      if (axiosError.response.status === 404) {
        reply = `Error: 404 Not Found. I tried to connect to ${AGENT_URL}, but the server responded with a 404 for ${axiosError.config?.url || 'the requested path'}. Please ensure your agent server is running and listening on the /prompt endpoint.`;
      } else if (errorData?.error?.includes("AUTH_REQUIRED")) {
        reply = `Please authenticate: ${errorData.authUrl || "Check server logs for auth URL."}`;
      } else if (errorData?.error?.includes("TENANT_REQUIRED")) {
        reply = `Please select a tenant ID. Available tenants: ${JSON.stringify(errorData.tenants || [])}`;
      } else {
        reply = `Error: ${errorData?.error || axiosError.message}`;
      }
    }
    await message.reply(reply);
  }
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("Failed to login to Discord:", err);
  process.exit(1);
});
