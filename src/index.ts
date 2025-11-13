import { startBrowserAgent } from "magnitude-core";
import dotenv from "dotenv";
import express from "express"

dotenv.config();
const app = express();
app.use(express.json());

async function
runAutomation(customMessage?: string)
{
    if (customMessage) {
        process.env.Discord_MESSAGE = 
    customMessage
    }

    return main();
}
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const email = process.env.DISCORD_EMAIL;
  const password = process.env.DISCORD_PASSWORD;
  const channelUrl = process.env.DISCORD_CHANNEL_URL;
  const message = process.env.DISCORD_MESSAGE;

  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in .env");
  if (!email || !password) throw new Error("Missing DISCORD_EMAIL or DISCORD_PASSWORD in .env");
  if (!channelUrl) throw new Error("Missing DISCORD_CHANNEL_URL in .env");
  if (!message) throw new Error("Missing DISCORD_MESSAGE in .env");

  // Start browser under Claude's control
  const agent = await startBrowserAgent({
    url: "https://discord.com/login",
    narrate: true, // prints what the agent is doing
    llm: {
      provider: "anthropic",
      options: {
        model: "claude-sonnet-4-20250514",
        apiKey,
      },
    },
  });

  try {
    console.log("🔐 Logging into Discord...");

    // 1) Log in
    await agent.act(
      "On this Discord login page, log into the account using the provided credentials. " +
        "Be careful to enter the email in the email field and the password in the password field, " +
        "then submit the login form and wait until the main Discord interface has fully loaded.",
      {
        data: { email, password },
      }
    );

    // 2) Go directly to the target channel URL
    console.log("➡️ Navigating to target channel...");
    await agent.act(
      "Open the given Discord channel URL in this browser tab and wait until the chat messages are visible.",
      { data: { url: channelUrl } }
    );

    // 3) Post the message
    console.log("💬 Posting message...");
    await agent.act(
      "In the currently open Discord channel, click into the message input box and send a single chat message " +
        "with the exact text provided. Do not add anything else before or after it.",
      { data: { message } }
    );

    console.log("✅ Finished – message should be posted.");
  } finally {
    await agent.stop();
  }
}

// HTTP endpoint for external triggers (n8n, curl, etc.)
app.post("/discord/send", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Missing 'message' in request body" });
  }

  try {
    await runAutomation(message);
    res.json({ success: true, posted: message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


main().catch((err) => {
  console.error("❌ Error running Discord automation:", err);
  process.exit(1);
});

app.listen(3000, () => {
    console.log("Http server running at http://localHost:3000");
});