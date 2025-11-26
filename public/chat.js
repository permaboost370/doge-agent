// Full-screen DOS / CRT DogeOS Agent-067 frontend
// Uses /chat backend (OpenAI + ElevenLabs) exactly as before.

const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");
const sendBtn = document.getElementById("send-btn");
const bootScreen = document.getElementById("boot-screen");
const bootTextEl = document.getElementById("boot-text");
const bootCursorEl = document.querySelector(".boot-cursor");

// Conversation history that we send to the backend
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

// Play a short "keyboard click" sound (low-volume blip)
function playTypingClick() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 300 + Math.random() * 100; // slight variation
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

  // System messages: centered text, no avatar
  if (role === "system") {
    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble", "system");
    bubble.textContent = text;
    row.appendChild(bubble);
    return row;
  }

  const avatar = document.createElement("div");
  avatar.classList.add("message-avatar");
  if (role === "user") avatar.classList.add("user");
  avatar.textContent = role === "user" ? "YOU" : "D";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", role === "user" ? "user" : "bot");

  // For user messages we set the text immediately
  if (role === "user") {
    bubble.textContent = text;
  }

  if (role === "bot") {
    row.appendChild(avatar);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
  }

  return row;
}

// Typewriter effect for bot messages (with typing sound)
function typeBotText(bubbleEl, fullText, onDone) {
  let i = 0;

  function step() {
    if (i >= fullText.length) {
      if (onDone) onDone();
      return;
    }
    // Append next char
    bubbleEl.textContent += fullText.charAt(i);
    i++;

    // Play click every few characters
    if (i % 3 === 0) {
      playTypingClick();
    }

    scrollMessagesToBottom();
    setTimeout(step, 18); // fast-ish typewriter
  }

  step();
}

function addMessage(text, role = "bot") {
  const row = createMessageRow(role, text);
  const isBot = role === "bot";

  messagesEl.appendChild(row);
  scrollMessagesToBottom();

  if (isBot) {
    const bubble = row.querySelector(".message-bubble.bot");
    if (!bubble) return row;
    bubble.textContent = ""; // we will type it in
    typeBotText(bubble, text, () => {
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

// Auto-grow textarea vertically
function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
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
      // Done
      bootCursorEl && bootCursorEl.classList.remove("hidden");
      setTimeout(() => {
        if (bootScreen) {
          bootScreen.classList.add("boot-hide");
        }
        DOGEOS_BOOTED = true;
        input.disabled = false;
        sendBtn.disabled = false;
        input.placeholder = "Ask Agent-067 anything...";
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

  // Ensure cursor visible during boot
  if (bootCursorEl) {
    bootCursorEl.classList.remove("hidden");
  }

  nextChar();
}

// ===== Initial welcome message (after boot) ===== //

function showWelcomeMessage() {
  const welcome =
    "Agent-067 online.\n" +
    "Short queries yield fast intel. Request 'explain in depth' when you want full mission lore.";
  addMessage(welcome, "bot");
}

// Run boot sequence on load
runBootSequence();

// ===== Event handlers ===== //

// Auto-resize on input
input.addEventListener("input", () => {
  autoResizeTextarea(input);
});

// Send on Enter (but allow Shift+Enter for newline)
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();

  if (!DOGEOS_BOOTED) {
    // Ignore input until boot done
    return;
  }

  if (!text) return;

  // Show user message in UI
  addMessage(text, "user");
  history.push({ role: "user", content: text });

  // Reset input
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
      (data.reply || "").trim() || "Such silence. Much empty.";
    const audioBase64 = data.audioBase64 || null;
    const audioFormat = data.audioFormat || "mp3";

    // Show bot reply in UI (with typewriter + sounds)
    addMessage(replyText, "bot");

    // Update local history
    history.push({ role: "assistant", content: replyText });

    // Play voice if available
    if (audioBase64) {
      playReplyAudio(audioBase64, audioFormat);
    }
  } catch (err) {
    console.error(err);
    addMessage(
      "Doge Agent confused. Network broke or backend failed. Try again in a moment.",
      "system"
    );
  } finally {
    setLoading(false);
  }
});
