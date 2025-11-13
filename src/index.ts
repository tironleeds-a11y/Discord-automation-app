import { startBrowserAgent } from "magnitude-core";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// Load shared env vars (no DISCORD_MESSAGE anymore)
const apiKey = process.env.ANTHROPIC_API_KEY;
const email = process.env.DISCORD_EMAIL;
const password = process.env.DISCORD_PASSWORD;
const channelUrl = process.env.DISCORD_CHANNEL_URL;

if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY in env");
if (!email || !password)
  throw new Error("Missing DISCORD_EMAIL or DISCORD_PASSWORD in env");
if (!channelUrl) throw new Error("Missing DISCORD_CHANNEL_URL in env");

// Helper that actually talks to Discord
async function runDiscordAutomation(params: { message: string; imageUrl?: string }) {
  const { message, imageUrl } = params;

  const agent = await startBrowserAgent({
    url: "https://discord.com/login",
    narrate: true,
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

    // 3) Post image + caption OR just caption
    if (imageUrl) {
      console.log("🖼️ Uploading image and caption...");
      await agent.act(
        "In the currently open Discord channel, upload an image from the given URL and then send a single chat message " +
          "with the exact caption text provided. Do not add anything else.",
        { data: { message, imageUrl } }
      );
    } else {
      console.log("💬 Posting text message...");
      await agent.act(
        "In the currently open Discord channel, click into the message input box and send a single chat message " +
          "with the exact text provided. Do not add anything else before or after it.",
        { data: { message } }
      );
    }

    console.log("✅ Finished – message (and optional image) should be posted.");
  } finally {
    await agent.stop();
  }
}

// ---- HTTP server for Render / n8n ----

const app = express();
app.use(express.json({ limit: "10mb" }));

app.post("/discord/send", async (req, res) => {
  const { message, imageUrl } = req.body as {
    message?: string;
    imageUrl?: string;
  };

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    await runDiscordAutomation({ message, imageUrl });
    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("❌ Error in /discord/send:", err);
    res.status(500).json({
      error: "Discord automation failed",
      details: String(err?.message || err),
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🔥 Discord automation server running at http://localhost:${port}`);
});
