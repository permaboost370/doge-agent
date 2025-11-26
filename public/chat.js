// DOGEOS-067 terminal frontend
// Uses /chat backend (OpenAI + ElevenLabs) exactly as before.

const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");
const sendBtn = document.getElementById("send-btn");
const bootScreen = document.getElementById("boot-screen");
const bootTextEl = document.getElementById("boot-text");
const bootCursorEl = document.querySelector(".boot-cursor");

// Conversation history for backend
const history = [];

// Boot state
let DOGEOS_BOOTED = false;

// Audio context for typing + beep
let audioContext = null;
function getAudioContext() {
  if (!audioContext) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioContext = new AC();
  }
  return audioContext;
}

// Play a short "keyboard click" sound
function playTypingClick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 280 + Math.random() * 60;
  gain.gain.value = 0.03;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + 0.03);
}

// Play a short "system beep" when reply finishes
function playResponseBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.05;

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  osc.start(now);
  osc.stop(now + 0.08);
}

// ===== Helpers ===== //

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createMessageRow(role, text) {
  const row = document.createElement("div");
  row.classList.add("message-row", role);

  const line = document.createElement("div");
  line.classList.add("message-line");

  if (role === "system") {
    const content = document.createElement("span");
    content.classList.add("message-content", "system");
    content.textContent = text;
    line.appendChild(content);
    row.appendChild(line);
    return row;
  }

  const prefix = document.createElement("span");
  prefix.classList.add("message-prefix");
  prefix.textContent = role === "user" ? "YOU> " : "067> ";

  const content = document.createElement("span");
  content.classList.add("message-content", role);
  if (role === "user") {
    content.textContent = text;
  }

  line.appendChild(prefix);
  line.appendChild(content);
  row.appendChild(line);

  return row;
}

// Typewriter effect for bot text with clicks
function typeBotText(element, fullText, onDone) {
  let i = 0;

  function step() {
    if (i >= fullText.length) {
      if (onDone) onDone();
      return;
    }
    element.textContent += fullText.charAt(i);
    i++;

    if (i % 3 === 0) {
      playTypingClick();
    }

    scrollMessagesToBottom();
    setTimeout(step, 18);
  }

  step();
}

function addMessage(text, role = "bot") {
  const row = createMessageRow(role, text);

  // Insert BEFORE the typing indicator (which sits above the prompt)
  const typingNode = typingIndicator;
  messagesEl.insertBefore(row, typingNode);

  scrollMessagesToBottom();

  if (role === "bot") {
    const contentEl = row.querySelector(".message-content.bot");
    if (!contentEl) return row;
    contentEl.textContent = ""; // we'll type it
    typeBotText(contentEl, text, () => {
      playResponseBeep();
    });
  }

  return row;
}

function setLoading(isLoading) {
  if (!typingIndicator) return;
  typingIndicator.classList.toggle("hidden", !isLoading);
  input.disabled = isLoading || !DOGEOS_BOOTED;
  sendBtn.disabled = isLoading || !DOGEOS_BOOTED;
}

// Auto-grow textarea
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 90) + "px";
}

// Base64 -> Blob for audio playback
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function playReplyAudio(base64, format = "mp3") {
  if (!base64) return;
  try {
    const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
    const blob = base64ToBlob(base64, mime);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.warn("Audio playback failed:", err);
    });
  } catch (e) {
    console.warn("Failed to play audio:", e);
  }
}

// ===== Boot screen logic ===== //

const bootLines = [
  "DOGEOS-067 BIOS v1.0",
  "MEM CHECK.......... OK",
  "WOWKERNEL.......... ONLINE",
  "SNACKCACHE......... WARM",
  "ZOOMIESENGINE...... PRIMED",
  "BARKCRYPT................. ARMED",
  "",
  "LINKING TO MAIN SHIBE NET...",
  "HANDSHAKE.......... OK",
  "",
  "SPAWNING AGENT-067 PROCESS...",
  "ROUTE: /DOGE/OPS/INTEL/067",
  "",
  "SYSTEM READY.",
  "AWAITING COMMAND..."
];

function runBootSequence() {
  DOGEOS_BOOTED = false;
  input.disabled = true;
  sendBtn.disabled = true;

  let lineIndex = 0;
  let charIndex = 0;
  let accumulated = "";

  function nextChar() {
    if (lineIndex >= bootLines.length) {
      if (bootCursorEl) bootCursorEl.classList.remove("hidden");
      setTimeout(() => {
        if (bootScreen) {
          bootScreen.classList.add("boot-hide");
        }
        DOGEOS_BOOTED = true;
        input.disabled = false;
        sendBtn.disabled = false;
        input.placeholder = "enter command...";
        showWelcomeMessage();
      }, 450);
      return;
    }

    const line = bootLines[lineIndex];

    if (charIndex < line.length) {
      accumulated += line[charIndex];
      bootTextEl.textContent = accumulated + "\n";
      charIndex++;
      playTypingClick();
      setTimeout(nextChar, 30);
    } else {
      accumulated += "\n";
      bootTextEl.textContent = accumulated;
      lineIndex++;
      charIndex = 0;
      setTimeout(nextChar, 120);
    }
  }

  if (bootCursorEl) {
    bootCursorEl.classList.remove("hidden");
  }

  nextChar();
}

// Welcome line after boot
function showWelcomeMessage() {
  const welcome =
    "Agent-067 online. Short queries yield fast intel. Request 'explain in depth' for full mission lore.";
  addMessage(welcome, "bot");
}

// Start boot sequence
runBootSequence();

// ===== Event handlers ===== //

input.addEventListener("input", () => {
  autoResizeTextarea(input);
});

// Send on Enter (Shift+Enter = newline)
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();

  if (!DOGEOS_BOOTED) return;
  if (!text) return;

  // Show user message
  addMessage(text, "user");
  history.push({ role: "user", content: text });

  // Clear input
  input.value = "";
  autoResizeTextarea(input);

  // Call backend
  setLoading(true);

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    const replyText =
      (data.reply || "").trim() || "such silence, much empty.";
    const audioBase64 = data.audioBase64 || null;
    const audioFormat = data.audioFormat || "mp3";

    // Show bot reply as terminal line with typewriter
    addMessage(replyText, "bot");

    // Update history
    history.push({ role: "assistant", content: replyText });

    // Play TTS if available
    if (audioBase64) {
      playReplyAudio(audioBase64, audioFormat);
    }
  } catch (err) {
    console.error(err);
    addMessage(
      "SYSTEM> Doge Agent confused. Network broke or backend failed. Try again.",
      "system"
    );
  } finally {
    setLoading(false);
  }
});
