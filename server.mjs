// server.mjs
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- OpenAI client & config ----------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "alloy";

const SYSTEM_PROMPT =
  process.env.AGENT_SYSTEM_PROMPT ||
  `You are Agent Doge, a black-and-white pixel Doge secret agent.
Minimal, wholesome, slightly chaotic.
Use Doge meme language sometimes: "such intel", "very stealth", "much wow".
Reply in 1–2 short sentences, fun and kind, never toxic.`;

// ---------- Chat endpoint: text + audio ----------

app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body?.message ?? "").toString().slice(0, 2000).trim();

    if (!userMessage) {
      return res
        .status(400)
        .json({ error: "such empty, much nothing to reply" });
    }

    // 1) Generate text reply
    const chatCompletion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.9,
      max_tokens: 200,
    });

    const reply =
      chatCompletion.choices?.[0]?.message?.content?.trim() ||
      "such silence, much empty";

    // 2) Generate TTS audio from reply
    let audioBase64 = null;
    const audioFormat = "mp3";

    try {
      const speech = await openai.audio.speech.create({
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: reply,
        format: audioFormat,
      });

      const audioBuffer = Buffer.from(await speech.arrayBuffer());
      audioBase64 = audioBuffer.toString("base64");
    } catch (ttsError) {
      console.error("TTS error:", ttsError);
      // We still return the text even if audio fails
    }

    // 3) Send both text + base64 audio to frontend
    res.json({
      reply,
      audioBase64, // may be null if TTS failed
      audioFormat,
    });
  } catch (err) {
    console.error("OpenAI error:", err);
    res
      .status(500)
      .json({ error: "Doge Agent confused, something broke." });
  }
});

// ---------- Frontend ----------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Doge Agent listening on port ${PORT}`);
});
