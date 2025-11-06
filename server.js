import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import request from "request";

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

  request(
    {
      uri: "https://graph.facebook.com/v22.0/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: requestBody,
    },
    (err, response) => {
      if (err) {
        console.error("❌ Error sending message:", err);
      } else if (response.body.error) {
        console.error("❌ Facebook API Error:", response.body.error);
      } else {
        console.log("✅ Message sent successfully to", recipientId);
      }
    },
  );
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
        const senderId = event.sender.id;

        // Handle handoff events
        if (event.pass_thread_control) {
          console.log(
            `🔄 Human agent taking over conversation for ${senderId}`,
          );
          return; // Don't respond - human is handling
        }

        if (event.take_thread_control) {
          console.log(`🤖 Bot resuming control for ${senderId}`);
        }

        // Handle regular messages
        if (event.message) {
          const messageText = event.message.text || "";
          console.log(`💬 Message from ${senderId}: ${messageText}`);

          // Skip bot response if this is an admin message (optional)
          const ADMIN_PSID = "YOUR_ADMIN_PSID_HERE"; // Get this from your logs
          if (senderId === ADMIN_PSID) {
            console.log("👑 Admin message - skipping bot response");
            return;
          }

          // Only respond to non-admin messages
          sendMessage(senderId, `You said: ${messageText}`);
        }
      });
    });
  }

  res.status(200).send("EVENT_RECEIVED");
});

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.send("Messenger Bot Server is running!");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Webhook URL: https://your-render-url.onrender.com/webhook`);
});
