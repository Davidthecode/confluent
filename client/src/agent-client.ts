import * as readline from "readline";
import axios, { AxiosError } from "axios";
import "dotenv/config";

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:3000/prompt";
const USER_ID = process.env.USER_ID ?? "demo-user-123";

async function sendPrompt(prompt: string) {
  process.stdout.write("Processing...");
  const spinner = ["|", "/", "-", "\\"];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\rProcessing... ${spinner[i++ % spinner.length]}`);
  }, 200);

  try {
    const response = await axios.post(AGENT_URL, {
      user_id: USER_ID,
      prompt: prompt,
    });

    clearInterval(interval);
    process.stdout.write("\r\x1b[K");

    console.log(`\nAgent Response:\n${response.data.response}\n`);
  } catch (error) {
    clearInterval(interval);
    process.stdout.write("\r\x1b[K");

    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.error("\nAgent Error (HTTP):", axiosError.response.data);
    } else {
      console.error("\nClient Error:", axiosError.message);
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