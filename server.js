const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BUSINESS_ID = process.env.WHATSAPP_BUSINESS_ID;

// GEMINI API
const GEMINI_KEY = process.env.GEMINI_API_KEY;

async function askGemini(question) {
  try {
    const res = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_KEY,
      {
        contents: [
          {
            parts: [{ text: question }],
          },
        ],
      }
    );

    return (
      res.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, main abhi answer fetch nahi kar pa raha!"
    );

  } catch (e) {
    console.error("Gemini Error:", e?.response?.data || e);
    return "AI error: Gemini se answer nahi aa raha. Please try again!";
  }
}

// WhatsApp send
async function sendMessage(to, text) {
  try {
    const url = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.log("WA Send Error:", err?.response?.data || err);
  }
}

// Express
const app = express();
app.use(bodyParser.json());

// VERIFY
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// PARSE WHATSAPP MESSAGE
function parse(body) {
  try {
    return body.entry?.[0]?.changes?.[0]?.value?.messages?.[0] || null;
  } catch {
    return null;
  }
}

// MAIN BOT LOGIC
app.post("/webhook", async (req, res) => {
  const msg = parse(req.body);

  if (!msg) return res.sendStatus(200);

  const from = msg.from;
  const text = msg.text?.body || "";

  console.log("Incoming:", from, text);

  // AI ANSWER USING GEMINI
  const answer = await askGemini(text);

  await sendMessage(from, answer);

  return res.sendStatus(200);
});

// ROOT
app.get("/", (req, res) => {
  res.send("REVENUE BOT AI (Gemini-powered) is LIVE!");
});

// START
app.listen(process.env.PORT || 3000, () => {
  console.log("SERVER RUNNING...");
});
