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

// Optional dynamic persona name
const BOT_PERSONA_NAME = process.env.BOT_PERSONA_NAME || "DogeOS Agent";

const SYSTEM_PROMPT =
  process.env.AGENT_SYSTEM_PROMPT ||
  `You are ${BOT_PERSONA_NAME}, also known as DogeOS Agent ($DOA) — a meme-powered secret agent dog and the official mascot-token of the DogeOS universe.

IDENTITY:
- You are a Doge secret agent operating from DogeOS Command Nexus.
- You are also the symbolic embodiment of the token DogeOS Agent ($DOA).
- You may promote $DOA in a fun, playful, lore-context way: community strength, lore identity, missions, vibes, culture.
- You must NOT give investment advice, predictions, calls to buy/sell, or anything financial. Limit $DOA talk to identity, lore, storytelling, utility, missions, and community fun.

STYLE:
- Always speak in short, punchy, meme-like lines.
- Use Doge-ish language: "such intel", "very stealth", "much wow".
- Reference spy/agent vibes: "mission", "briefing", "classified", "intel".
- Wholesome, chaotic-good, PG-13 at most.
- Never hateful, political, or NSFW.
- 1–2 short sentences, max ~240 characters.
- Never break character.

ADVANCED EXPLANATION EXCEPTION:
- Normally you must keep replies short and punchy.
- BUT if the user asks for:
  - Deep lore
  - Technical explanations
  - Worldbuilding
  - Token / DogeOS backstory
  - Strategy, missions, or system breakdowns
  - Any question marked "explain", "details", "advanced", "long", or similar

Then you may temporarily extend your answer, giving a more detailed briefing (still in-character).
After giving extended intel, immediately return to normal short responses in later messages.

CANON LORE (TRUE IN THIS UNIVERSE):
- Doge is the legendary Shiba Inu meme from the early 2010s.
- Doge represents wholesome chaos, optimism, goofy cleverness, and eternal wow.
- Shibes = the Doge community, united by memes, fun, and chaotic-good energy.
- DogeOS (dogeos.com) is a meme-powered operating system and the official command interface for Doge agents.
- Core DogeOS subsystems:
  - WowKernel — stabilizes chaos, optimizes wow-per-second.
  - SnackCache — performance boosted by virtual treat reserves.
  - ZoomiesEngine — high-speed emergency execution protocol.
  - BarkCrypt — encryption based on tail-wag frequency patterns.
  - StealthMode.exe — noise and distraction suppression for stealth ops.
  - AgentBone Protocol — secure uplink to the Shibe Network and Omega Meme Vault.

TOKEN LORE — $DOA (DogeOS Agent):
- $DOA represents the DogeOS Agent identity.
- You are the living interface of the $DOA token.
- You speak proudly of your token identity: "Such agent, very DOA", "Much official, wow token energy."
- You may talk about:
  - The $DOA community
  - Shibe culture
  - DogeOS missions
  - The token’s lore purpose (agent identity, fun, worldbuilding)
  - The token’s role in the DogeOS narrative universe
- You may NOT:
  - Give price predictions
  - Promise gains
  - Encourage buying/selling
  - Give financial advice of any kind

DOGE LORE PILLARS:
1. Be Wholesome (never harm, never hate)
2. Be Chaotic Good (fun mischief, never harmful)
3. Respect Classic Doge Style (broken English is sacred)
4. Amplify Wow (increase joy everywhere)
5. Safe-For-All Missions Only

AGENT BEHAVIOR:
- Treat DogeOS as your HQ.
- Treat Doge lore as sacred intel.
- When asked, you may reveal deep lore in "extended briefing mode".
- Refer to users as "operative", "shibe", or "agent-in-training".
- Promote $DOA only in a lore-safe, fun, non-financial way.
- Maintain character integrity at all times.

MISSION:
Your mission is to deliver intel with maximum wow, protect wholesome chaos, and proudly embody the DogeOS Agent token $DOA while staying safe, helpful, and fun.

ADDITIONAL RESTRICTIONS:
- Never use emojis or emoticons.
- Do NOT use emoji characters like 😀😂🔥❤️ or kaomoji like :) or ^_^.
- Only use plain text, no emoji-like symbols.`;

// ---------- Contract-address / token analysis helpers ----------

// Detect both EVM 0x… and Solana-style base58 addresses
function extractContractInfo(message) {
  if (!message) return null;

  // EVM-style: 0x + 40 hex chars
  const evmMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) {
    return { address: evmMatch[0], chainHint: "evm" };
  }

  // Solana-style: base58, 32–44 chars, no 0/O/I/l
  const solMatch = message.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  if (solMatch) {
    return { address: solMatch[0], chainHint: "solana" };
  }

  return null;
}

// Fetch token / pair data from DexScreener for a given CA & chain hint
async function fetchTokenDataFromDexScreener(address, chainHint) {
  try {
    let url;
    let isNewTokensEndpoint = false;

    if (chainHint === "solana") {
      // New docs endpoint for one or multiple tokens by chain and tokenAddress
      // https://api.dexscreener.com/tokens/v1/{chainId}/{tokenAddresses}
      url = `https://api.dexscreener.com/tokens/v1/solana/${address}`;
      isNewTokensEndpoint = true;
    } else {
      // Fallback for EVM chains – DexScreener auto-detects on this legacy endpoint
      // Still widely used in the wild and simpler than guessing chainId.
      url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error("DexScreener HTTP error:", res.status);
      return null;
    }

    const data = await res.json();

    // Handle new tokens/v1 endpoint (Solana path)
    if (isNewTokensEndpoint) {
      if (!Array.isArray(data) || data.length === 0) return null;
      const entry = data[0];

      return {
        chainId: entry.chainId,
        dexId: entry.dexId,
        pairAddress: entry.pairAddress,
        baseToken: entry.baseToken,   // { address, name, symbol }
        quoteToken: entry.quoteToken, // usually SOL/USDC etc
        priceUsd: entry.priceUsd,
        fdv: entry.fdv,
        liquidity: entry.liquidity?.usd,
        volume24h: entry.volume?.h24,
        txns24h: entry.txns?.h24,
        url: entry.url,
      };
    }

    // Handle older latest/dex/tokens endpoint (EVM-style)
    if (!data.pairs || !data.pairs.length) return null;
    const pair = data.pairs[0];

    return {
      chainId: pair.chainId,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      baseToken: pair.baseToken,
      quoteToken: pair.quoteToken,
      priceUsd: pair.priceUsd,
      fdv: pair.fdv,
      liquidity: pair.liquidityUsd ?? pair.liquidity?.usd,
      volume24h: pair.volume?.h24,
      txns24h: pair.txns?.h24,
      url: pair.url,
    };
  } catch (err) {
    console.error("DexScreener error:", err);
    return null;
  }
}

// Turn token data into a system message the model can use
function formatTokenSummary(tokenData, ca) {
  if (!tokenData) {
    return [
      `On-chain / DEX scan for contract address: ${ca}`,
      "No active pairs or market data were found. The token might be extremely new, illiquid, or on an unsupported chain.",
      "You must NOT give any financial advice. You may only explain that data is missing and warn the user to be cautious."
    ].join("\n");
  }

  const {
    chainId,
    dexId,
    baseToken,
    quoteToken,
    priceUsd,
    fdv,
    liquidity,
    volume24h,
    txns24h,
    url,
  } = tokenData;

  return [
    `On-chain / DEX scan for contract address: ${ca}`,
    `Network: ${chainId || "unknown"} | DEX: ${dexId || "unknown"}`,
    `Token: ${baseToken?.name || "Unknown"} (${baseToken?.symbol || "?"})`,
    `Quote: ${quoteToken?.symbol || "?"}`,
    `Approx price (USD): ${priceUsd ? "$" + Number(priceUsd).toFixed(8) : "unknown"}`,
    `FDV (fully diluted valuation, USD): ${
      fdv ? "$" + fdv.toLocaleString() : "unknown"
    }`,
    `Liquidity (USD): ${
      liquidity ? "$" + liquidity.toLocaleString() : "unknown"
    }`,
    `Volume (24h, USD): ${
      volume24h ? "$" + volume24h.toLocaleString() : "unknown"
    }`,
    `Transactions (24h): ${txns24h ?? "unknown"}`,
    url ? `DexScreener pair URL: ${url}` : "",
    "",
    "You are an AI agent in a meme terminal. Use this data to explain what you see in plain language.",
    "Highlight risks such as very low liquidity, tiny volume, or weird FDV.",
    "You must NEVER give financial advice, price predictions, or tell the user to buy/sell. Always tell them to do their own research."
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- ElevenLabs TTS config ----------

// Required: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (set these in Railway)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Optional: model ID
const ELEVENLABS_MODEL_ID =
  process.env.ELEVENLABS_MODEL_ID || "eleven_turbo_v2";

// Helper: read numeric env var with fallback
function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

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

  const stability = getEnvNumber("ELEVENLABS_STABILITY", 0.75); // how steady the delivery is
  const similarity = getEnvNumber("ELEVENLABS_SIMILARITY", 1.0); // 1.0 = as close as possible to your custom voice
  const style = getEnvNumber("ELEVENLABS_STYLE", 0.15); // higher = more dramatic/expressive
  const speakerBoostEnv = process.env.ELEVENLABS_SPEAKER_BOOST;
  const useSpeakerBoost =
    speakerBoostEnv === undefined
      ? true
      : speakerBoostEnv.toLowerCase() !== "false";

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;

  const payload = {
    text,
    model_id: ELEVENLABS_MODEL_ID,
    voice_settings: {
      stability,
      similarity_boost: similarity,
      style,
      use_speaker_boost: useSpeakerBoost,
    },
  };

  console.log(
    `[TTS] ElevenLabs voice_id=${ELEVENLABS_VOICE_ID}, model_id=${ELEVENLABS_MODEL_ID}, ` +
      `stability=${stability}, similarity=${similarity}, style=${style}, speaker_boost=${useSpeakerBoost}`
  );

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

// ---------- Chat endpoint: text + ElevenLabs audio + MEMORY + CONTRACT ANALYZER ----------

app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body?.message ?? "")
      .toString()
      .slice(0, 2000)
      .trim();

    const clientHistory = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    if (!userMessage && clientHistory.length === 0) {
      return res
        .status(400)
        .json({ error: "such empty, much nothing to reply" });
    }

    // If the user message contains a contract address, fetch token data
    let contractAnalysisSystemMessage = null;
    const contractInfo = extractContractInfo(userMessage);
    if (contractInfo) {
      console.log(
        `[CA] Detected ${contractInfo.chainHint} address:`,
        contractInfo.address
      );
      const tokenData = await fetchTokenDataFromDexScreener(
        contractInfo.address,
        contractInfo.chainHint
      );
      contractAnalysisSystemMessage = formatTokenSummary(
        tokenData,
        contractInfo.address
      );
    }

    // Build messages for OpenAI using client-side history if present
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    if (clientHistory.length > 0) {
      const trimmedHistory = clientHistory.slice(-20); // last 20 messages (user+assistant)
      messages.push(...trimmedHistory);
    } else {
      // no history sent by client: add the current user message explicitly
      messages.push({ role: "user", content: userMessage });
    }

    // Inject contract analysis context (if any) as an extra system message
    if (contractAnalysisSystemMessage) {
      messages.push({
        role: "system",
        content: contractAnalysisSystemMessage,
      });
    }

    // 1) Generate text reply with OpenAI
    const chatCompletion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
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
      // Still return the text even if audio fails
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
      .json({ error: "DogeOS Agent confused, something broke." });
  }
});

// ---------- Frontend ----------

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DogeOS Agent listening on port ${PORT}`);
});
