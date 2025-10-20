import * as readline from "readline";
import axios, { AxiosError } from "axios";
import "dotenv/config";

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:3000/prompt";
const USER_ID = process.env.USER_ID ?? "demo-user-123";

async function sendPrompt(prompt: string) {
  try {
    const response = await axios.post(AGENT_URL, {
      user_id: USER_ID,
      prompt: prompt,
    });

    console.log(`\n Agent Response:\n${response.data.response}\n`);

  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.error("\n Agent Error (HTTP):", axiosError.response.data);
    } else {
      console.error("\n Client Error:", axiosError.message);
    }
  }
}

function startClient() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`\n Agent Client Started (User: ${USER_ID})`);
  console.log("-----------------------------------------");
  console.log("Enter prompt (or type 'exit' to quit):");

  rl.on("line", (prompt) => {
    if (prompt.toLowerCase().trim() === "exit") {
      rl.close();
      return;
    }

    if (prompt.trim() === "") {
      process.stdout.write("> ");
      return;
    }

    sendPrompt(prompt);
  });

  rl.on("close", () => {
    console.log("\n Agent Client shut down.");
    process.exit(0);
  });

  process.stdout.write("> ");
}

startClient();