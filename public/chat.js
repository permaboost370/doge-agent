// Simple full-width chat frontend for Agent-067
// Uses the existing /chat endpoint and ElevenLabs audio you already wired.

const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messagesEl = document.getElementById("messages");
const typingIndicator = document.getElementById("typing-indicator");
const sendBtn = document.getElementById("send-btn");

// Conversation history that we send to the backend
// Each item: { role: "user" | "assistant", content: "..." }
const history = [];

// ===== Helpers ===== //

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function createMessageRow(role, text) {
  const row = document.createElement("div");
  row.classList.add("message-row", role);

  // system messages are just centered text with no avatar
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
  avatar.textContent = role === "user" ? "You" : "D";

  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble", role === "user" ? "user" : "bot");
  bubble.textContent = text;

  if (role === "bot") {
    row.appendChild(avatar);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);
  }

  return row;
}

function addMessage(text, role = "bot") {
  const row = createMessageRow(role, text);
  messagesEl.appendChild(row);
  scrollMessagesToBottom();
}

function setLoading(isLoading) {
  if (!typingIndicator) return;
  typingIndicator.classList.toggle("hidden", !isLoading);
  input.disabled = isLoading;
  sendBtn.disabled = isLoading;
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

// ===== Initial welcome message ===== //

function showWelcomeMessage() {
  const welcome =
    "Welcome to DogeOS Agent-067.\n" +
    "I am deployed to serve the Doge and assist your operations.\n" +
    "Ask concise questions for fast replies, or say 'explain in depth' when you want full lore.";
  addMessage(welcome, "bot");
}

showWelcomeMessage();

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
        history,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    const replyText = (data.reply || "").trim() || "Such silence. Much empty.";
    const audioBase64 = data.audioBase64 || null;
    const audioFormat = data.audioFormat || "mp3";

    // Show bot reply in UI
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
