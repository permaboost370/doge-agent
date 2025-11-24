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

// ---------- OpenAI client & config (TEXT ONLY) ----------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const SYSTEM_PROMPT =
  process.env.AGENT_SYSTEM_PROMPT ||
  `You are Agent Doge, a black-and-white pixel Doge secret agent.
Minimal, wholesome, slightly chaotic.
Use Doge meme language sometimes: "such intel", "very stealth", "much wow".
Reply in 1–2 short sentences, fun and kind, never toxic.

Important style rules:
- Never use emojis or emoticons.
- Do NOT use emoji characters like 😀😂🔥❤️ or kaomoji like :) or ^_^.
- Only use plain text, no special emoji-like symbols.`;

// ---------- ElevenLabs TTS config ----------

// Required: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (set these in Railway)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Optional: model ID
const ELEVENLABS_MODEL_ID =
  process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2";

// small helper to ensure config is present
function checkTTSConfig() {
  if (!ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID environment variables."
    );
  }
}

// ---------- Helper: call ElevenLabs TTS and return base64 MP3 ----------

async function synthesizeWithElevenLabs(text) {
  checkTTSConfig();

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

  const payload = {
    text,
    model_id: ELEVENLABS_MODEL_ID,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.4,
      use_speaker_boost: true,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64"); // MP3 in base64
}

// ---------- Chat endpoint: text + ElevenLabs audio ----------

app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body?.message ?? "")
      .toString()
      .slice(0, 2000)
      .trim();

    if (!userMessage) {
      return res
        .status(400)
        .json({ error: "such empty, much nothing to reply" });
    }

    // 1) Generate text reply with OpenAI
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

    // 2) Generate TTS audio from reply using ElevenLabs
    let audioBase64 = null;
    const audioFormat = "mp3";

    try {
      audioBase64 = await synthesizeWithElevenLabs(reply);
    } catch (ttsError) {
      console.error("ElevenLabs TTS error:", ttsError);
      // We still return the text even if audio fails
    }

    // 3) Send both text + base64 audio to frontend
    res.json({
      reply,
      audioBase64, // may be null if TTS failed
      audioFormat,
    });
  } catch (err) {
    console.error("Chat error:", err);
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
