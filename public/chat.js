const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

// Typewriter function (for bot responses and intro)
function typeWriter(element, text, speed = 15, onComplete) {
  let i = 0;
  element.classList.add("typing"); // blinking cursor via CSS

  const interval = setInterval(() => {
    element.textContent += text[i];
    i += 1;
    messages.scrollTop = messages.scrollHeight;

    if (i >= text.length) {
      clearInterval(interval);
      element.classList.remove("typing"); // stop blinking cursor
      if (typeof onComplete === "function") {
        onComplete();
      }
    }
  }, speed);
}

// ----- TYPEWRITER INTRO -----
const introText =
  "C:\\DOGEOS\\AGENTS> AGENT067.EXE /tweet\n" +
  "> HELLO HUMAN NETWORK.\n" +
  "> I AM AGENT-067.\n" +
  "> I HAVE BEEN DEPLOYED TO SERVE THE DOGE.\n" +
  "> SUCH MISSION. MUCH RESPONSIBILITY.";

function playIntro() {
  const div = document.createElement("div");
  div.className = "msg system typing";
  messages.appendChild(div);
  typeWriter(div, introText, 20);
}

// Run intro once at load
playIntro();

// ----- AUDIO HELPERS -----
function base64ToBlob(base64, mimeType) {
  if (!base64) return null;
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

  const mime = format === "mp3" ? "audio/mpeg" : `audio/${format}`;
  const blob = base64ToBlob(base64, mime);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  // User just interacted (submitted form), so autoplay is usually allowed
  audio.play().catch((err) => {
    console.warn("Autoplay blocked or failed:", err);
  });
}

// ----- ADD MESSAGE -----
function addMessage(text, who, typeEffect = false, onDone) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  messages.appendChild(div);

  if (who === "bot") {
    // Build ASCII box

    // 1) Split, trim, and REMOVE empty lines to avoid blank rows
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // 2) Prefix with DOGE>
    const dogeLines = lines.map((l) => "DOGE> " + l);

    // 3) Compute box width
    const maxLen = dogeLines.reduce(
      (max, line) => Math.max(max, line.length),
      0
    );
    const border = "+" + "-".repeat(maxLen + 2) + "+";

    // 4) Build boxed text
    const boxedText =
      border +
      "\n" +
      dogeLines
        .map((line) => {
          const padding = " ".repeat(maxLen - line.length);
          return "| " + line + padding + " |";
        })
        .join("\n") +
      "\n" +
      border;

    // 5) Typewriter or instant
    if (typeEffect) {
      typeWriter(div, boxedText, 10, onDone); // SPEED here
    } else {
      div.textContent = boxedText;
      if (typeof onDone === "function") onDone();
    }
  } else {
    // User or system message
    if (typeEffect) {
      typeWriter(div, text, 10, onDone);
    } else {
      div.textContent = text;
      if (typeof onDone === "function") onDone();
    }
  }

  messages.scrollTop = messages.scrollHeight;
}

// ----- CHAT LOGIC -----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  // user message (white, with YOU> from CSS)
  addMessage(text, "user");
  input.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    if (data.error) {
      addMessage("Doge Agent error: " + data.error, "bot", true);
    } else {
      const replyText = data.reply || "such silence, much empty";
      const audioBase64 = data.audioBase64 || null;
      const audioFormat = data.audioFormat || "mp3";

      // bot message (green, boxed, DOGE> prefix) + voice
      addMessage(replyText, "bot", true, () => {
        playReplyAudio(audioBase64, audioFormat);
      });
    }
  } catch (err) {
    console.error(err);
    addMessage("Doge Agent confused. Network broke.", "bot", true);
  }
});
