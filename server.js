import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Environment variables - Render will set these in dashboard
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

function sendMessage(recipientId, messageText) {
  const requestBody = {
    recipient: { id: recipientId },
    message: { text: messageText },
    messaging_type: "RESPONSE",
  };
}
// GET endpoint for Facebook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Verification request received");
  console.log("Mode:", mode);
  console.log("Token provided:", token);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Verification failed - invalid token or mode");
    res.sendStatus(403);
  }
});

// POST endpoint to receive messages
app.post("/webhook", (req, res) => {
  const body = req.body;

  console.log("📥 Received webhook event:");
  console.log(JSON.stringify(body, null, 2));

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      entry.messaging.forEach((event) => {
        if (event.message) {
          const senderId = event.sender.id;
          const messageText = event.message.text || "";

          console.log(`💬 Message from ${senderId}: ${messageText}`);

          // For now echo back the user's text, later an AI will answer
          sendMessage(senderId, `Echo: ${messageText}`);
        }
      });
    });

    // Must respond with 200 OK within 20 seconds
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.send("Messenger Bot Server is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Webhook URL: https://your-render-url.onrender.com/webhook`);
});
