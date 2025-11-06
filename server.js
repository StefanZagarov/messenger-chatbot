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
  const serverReceiveTime = Date.now();

  const body = req.body;

  console.log(
    "📥 Received webhook event at server time:",
    new Date(serverReceiveTime).toISOString(),
  );
  console.log(JSON.stringify(body, null, 2));

  if (body.object === "page") {
    body.entry.forEach((entry) => {
      const facebookReceiveTime = entry.time;

      entry.messaging.forEach((event) => {
        if (event.message) {
          const userSendTime = event.timestamp;
          const senderId = event.sender.id;
          const messageText = event.message.text || "";

          const userToFacebookDelay = facebookReceiveTime - userSendTime;
          const facebookToServerDelay = serverReceiveTime - facebookReceiveTime;
          const totalDelay = serverReceiveTime - userSendTime;

          console.log(`💬 Message from ${senderId}: "${messageText}"`);
          // Timing logs
          console.log("Timing Analysis:");
          console.log(
            `User sent message at: ${new Date(userSendTime).toISOString()}`,
          );
          console.log(
            `Facebook received at: ${new Date(facebookReceiveTime).toISOString()} (delay: ${userToFacebookDelay}ms)`,
          );
          console.log(
            `Server received at: ${new Date(serverReceiveTime).toISOString()} (delay: ${facebookToServerDelay}ms)`,
          );
          console.log(`Total round trip: ${totalDelay}ms`);

          // For now echo back the user's text, later an AI will answer
          sendMessage(senderId, `Echo: "${messageText}"`);
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

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 Webhook URL: https://your-render-url.onrender.com/webhook`);
});
