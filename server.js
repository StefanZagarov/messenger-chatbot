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

// Validate environment variables
if (!VERIFY_TOKEN || !PAGE_ACCESS_TOKEN) {
  console.error(
    "❌ Missing required environment variables: VERIFY_TOKEN or PAGE_ACCESS_TOKEN",
  );
  process.exit(1);
}

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
        console.error(
          "❌ Facebook API Error:",
          JSON.stringify(response.body.error, null, 2),
        );
      } else {
        console.log("✅ Message sent successfully to", recipientId);
      }
    },
  );
}

// GET endpoint for Facebook verification (works for both Facebook and Instagram)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Verification request received");
  console.log("📋 Mode:", mode);
  console.log("🔑 Token provided:", token);
  console.log("✅ Expected token:", VERIFY_TOKEN);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WEBHOOK_VERIFIED - sending challenge response");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Verification failed - invalid token or mode");
    console.log(
      "💡 Make sure your VERIFY_TOKEN matches exactly what you set in Facebook Developer portal",
    );
    res.sendStatus(403);
  }
});

// POST endpoint to receive messages from both Facebook and Instagram
app.post("/webhook", (req, res) => {
  const serverReceiveTime = Date.now();
  const body = req.body;

  // Log the full payload for debugging
  console.log(
    "📥 FULL WEBHOOK PAYLOAD received at:",
    new Date(serverReceiveTime).toISOString(),
  );
  console.log(JSON.stringify(body, null, 2));

  try {
    // Handle Facebook Messenger events (object: "page")
    if (body.object === "page") {
      console.log("📱 Facebook Messenger event detected");

      if (body.entry && Array.isArray(body.entry)) {
        body.entry.forEach((entry) => {
          const facebookReceiveTime = entry.time || Date.now();

          if (entry.messaging && Array.isArray(entry.messaging)) {
            entry.messaging.forEach((event) => {
              if (event.message && !event.message.is_echo) {
                const userSendTime = event.timestamp || Date.now();
                const senderId = event.sender.id;
                const messageText = event.message.text || "";

                const userToFacebookDelay = facebookReceiveTime - userSendTime;
                const facebookToServerDelay =
                  serverReceiveTime - facebookReceiveTime;
                const totalDelay = serverReceiveTime - userSendTime;

                console.log(
                  `💬 Facebook Message from ${senderId}: "${messageText}"`,
                );
                console.log("📊 Facebook Timing Analysis:");
                console.log(
                  `👤 User sent message at: ${new Date(userSendTime).toISOString()}`,
                );
                console.log(
                  ` Meta received at: ${new Date(facebookReceiveTime).toISOString()} (delay: ${userToFacebookDelay}ms)`,
                );
                console.log(
                  `🖥️ Server received at: ${new Date(serverReceiveTime).toISOString()} (delay: ${facebookToServerDelay}ms)`,
                );
                console.log(`⏱️ Total round trip: ${totalDelay}ms`);

                // Echo back the message for Facebook
                sendMessage(senderId, `📱 Facebook Echo: "${messageText}"`);
              }
            });
          }
        });
      }
    }

    // Handle Instagram Messaging events (object: "instagram")
    else if (body.object === "instagram") {
      console.log("📸 Instagram Messaging event detected!");

      if (body.entry && Array.isArray(body.entry)) {
        body.entry.forEach((entry) => {
          console.log("🔍 Instagram entry:", JSON.stringify(entry, null, 2));

          // Handle Instagram messaging events
          if (entry.messaging && Array.isArray(entry.messaging)) {
            entry.messaging.forEach((event) => {
              console.log(
                "⚡ Instagram messaging event:",
                JSON.stringify(event, null, 2),
              );

              if (event.message && !event.message.is_echo) {
                const senderId = event.sender.id;
                const messageText = event.message.text || "📸 No text message";
                const timestamp = event.timestamp || Date.now();

                console.log(
                  `💬 Instagram DM from ${senderId}: "${messageText}"`,
                );
                console.log(
                  `⏰ Instagram message timestamp: ${new Date(timestamp).toISOString()}`,
                );

                // Echo back with Instagram identifier
                sendMessage(
                  senderId,
                  `📸 Instagram Bot Echo: "${messageText}"`,
                );
              }

              // Handle Instagram message reactions if needed
              if (event.message_reaction) {
                console.log(
                  "🎭 Instagram message reaction received:",
                  JSON.stringify(event.message_reaction, null, 2),
                );
              }
            });
          }

          // Handle Instagram comment events (if subscribed)
          if (entry.changes && Array.isArray(entry.changes)) {
            entry.changes.forEach((change) => {
              console.log(
                "📝 Instagram comment change:",
                JSON.stringify(change, null, 2),
              );

              if (
                change.field === "comments" &&
                change.value &&
                change.value.item === "comment"
              ) {
                const commentId = change.value.comment_id;
                const commentText = change.value.text || "No comment text";
                console.log(
                  `💬 Instagram comment on post: "${commentText}" (ID: ${commentId})`,
                );

                // You can reply to comments here if needed
                // Note: Replying to comments requires different API endpoints
              }
            });
          }
        });
      }
    }

    // Handle Instagram Comments events (separate object type - if you have this subscription)
    else if (body.object === "instagram_comments") {
      console.log("💬 Instagram Comments event detected");
      console.log("📝 Comment payload:", JSON.stringify(body, null, 2));

      if (body.entry && Array.isArray(body.entry)) {
        body.entry.forEach((entry) => {
          if (entry.changes && Array.isArray(entry.changes)) {
            entry.changes.forEach((change) => {
              if (change.field === "comments" && change.value) {
                const commentText = change.value.text || "No comment text";
                console.log(`📸 Instagram comment received: "${commentText}"`);
              }
            });
          }
        });
      }
    } else {
      console.log("❓ Unknown webhook object type:", body.object);
      console.log(
        "📋 Full payload for unknown type:",
        JSON.stringify(body, null, 2),
      );
    }

    // Must respond with 200 OK within 20 seconds for all events
    console.log("✅ Responding with 200 OK to webhook event");
    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error("🔥 Error processing webhook:", error);
    res.sendStatus(500);
  }
});

// Health check endpoint for Render
app.get("/", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
    webhookUrl: `https://${req.headers.host}/webhook`,
    environment: {
      VERIFY_TOKEN: VERIFY_TOKEN ? "✓ Set" : "❌ Missing",
      PAGE_ACCESS_TOKEN: PAGE_ACCESS_TOKEN ? "✓ Set" : "❌ Missing",
    },
  });
});

// Debug endpoint to check webhook configuration
app.get("/debug", (req, res) => {
  res.json({
    webhookConfig: {
      callbackUrl: "https://messenger-chatbot-tyoc.onrender.com/webhook",
      subscribedFields: [
        "messages",
        "message_reactions",
        "message_deliveries",
        "message_reads",
      ],
      objectType: "Handles both 'page' (Facebook) and 'instagram' events",
    },
    testingInstructions: {
      facebook: "Send message to Facebook page",
      instagram: "Send DM to Instagram business account from mobile app",
      requirements:
        "Tester must have Instagram account connected to Facebook account",
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `🌐 Webhook URL: https://messenger-chatbot-tyoc.onrender.com/webhook`,
  );
  console.log("🔧 DEBUG ENDPOINT: /debug");
  console.log(
    "✅ Ready to handle both Facebook Messenger and Instagram messages!",
  );
});
