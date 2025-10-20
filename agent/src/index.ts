import { financialAgent } from "./agents/financial-agent/agent";
import express from "express";
import bodyParser from "body-parser";
import { InMemorySessionService } from "@iqai/adk";
import * as dotenv from "dotenv";

dotenv.config();

const AGENT_PORT = Number(process.env.AGENT_PORT ?? 3000);

const sessionService = new InMemorySessionService();

const runnerCache = new Map();


async function getAgentRunner(userId: string) {
  if (runnerCache.has(userId)) {
    return runnerCache.get(userId);
  }

  const { runner } = await financialAgent(userId, sessionService);

  runnerCache.set(userId, runner);

  return runner;
}

const app = express();
app.use(bodyParser.json());

app.post("/prompt", async (req, res) => {
  const { user_id, prompt } = req.body;

  if (!user_id || typeof user_id !== "string") {
    return res.status(400).json({ response: "Missing or invalid 'user_id' in request." });
  }
  if (!prompt) {
    return res.status(400).json({ response: "Missing 'prompt' in request." });
  }

  try {
    console.log(`\n[REQUEST] User: ${user_id} | Prompt: "${prompt}"`);

    const agentRunner = await getAgentRunner(user_id);

    const agentResponse = await agentRunner.ask(prompt);

    console.log(`[RESPONSE] Sent response to client for user: ${user_id}`);
    res.json({ response: agentResponse });

  } catch (error) {
    console.error(`Agent execution error for user ${user_id}:`, error);
    res.status(500).json({ response: "An internal agent error occurred. Check server logs." });
  }
});

app.listen(AGENT_PORT, () => {
  console.log(`\n Agent HTTP Server listening on port ${AGENT_PORT}`);
  console.log("-----------------------------------------");
  console.log(`Note: Agent initialized to handle multiple users via sessionService.`);
});