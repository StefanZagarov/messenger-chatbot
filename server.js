import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import request from "request";

dotenv.config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Track which conversations have human control
// In production, use Redis or a database instead of in-memory storage
const humanControlledChats = new Set();

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

        // HANDLE HANDOVER EVENTS
        if (event.pass_thread_control) {
          console.log(
            `🔄 Thread control passed - Human taking over for ${senderId}`,
          );
          humanControlledChats.add(senderId);
          return;
        }

        if (event.take_thread_control) {
          console.log(
            `🤖 Thread control taken back - Bot resuming for ${senderId}`,
          );
          humanControlledChats.delete(senderId);
          return;
        }

        if (event.request_thread_control) {
          console.log(
            `📞 Thread control requested by secondary app for ${senderId}`,
          );
          // Optionally: automatically pass control or handle request
          return;
        }

        // HANDLE MESSAGES
        if (event.message) {
          const messageText = event.message.text || "";

          // Ignore message echoes (messages sent by your page)
          if (event.message.is_echo) {
            console.log("🔇 Ignoring message echo");
            return;
          }

          // Ignore messages while human has control
          if (humanControlledChats.has(senderId)) {
            console.log(
              `🚫 Human has control - bot staying silent for ${senderId}`,
            );
            return;
          }

          console.log(`💬 Message from ${senderId}: ${messageText}`);

          // Your bot logic here
          sendMessage(senderId, `Echo: ${messageText}`);
        }
      });
    });
  }

  res.status(200).send("EVENT_RECEIVED");
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Messenger Bot Server is running!");
});

// Endpoint to check human control status (optional, for debugging)
app.get("/control-status", (req, res) => {
  res.json({
    humanControlledChats: Array.from(humanControlledChats),
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Webhook URL: https://your-render-url.onrender.com/webhook`);
});
