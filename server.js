// server.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ----------------- ENV VARIABLES -----------------
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Gemini init
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Express app
const app = express();
app.use(bodyParser.json());

// -------------------- AI FUNCTION --------------------
async function askGemini(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini Error:", err.response?.data || err);
    return "⚠ AI system error. Please try again!";
  }
}

// -------------------- SEND WHATSAPP MESSAGE --------------------
async function sendWhatsAppMessage(to, text) {
  try {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: to,
      text: { body: text }
    };

    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    console.log("WA API Response:", res.data);
    return res.data;
  } catch (err) {
    console.error("WA Send Error:", err.response?.data || err);
  }
}

// -------------------- WEBHOOK VERIFY --------------------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook Verified ✔");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// -------------------- RECEIVE WHATSAPP MESSAGE --------------------
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const msg = changes?.value?.messages?.[0];

    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    const text = msg.text?.body || "";

    console.log("Incoming:", from, text);

    // -------------------- AI Reply System --------------------
    const aiAnswer = await askGemini(
      `You are REVENUE BOT AI. Give a clear, simple, accurate explanation:\n\nQuestion: ${text}`
    );

    await sendWhatsAppMessage(from, aiAnswer);

    return res.sendStatus(200);
  } catch (err) {
    console.error("Incoming Message Error:", err);
    return res.sendStatus(200);
  }
});

// -------------------- HOME ROUTE --------------------
app.get("/", (req, res) => {
  res.send("REVENUE BOT AI is running ✔");
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});