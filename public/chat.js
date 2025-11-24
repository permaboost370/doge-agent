const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

// ---------- Typewriter ----------

function typeWriter(element, text, speed = 15, onComplete) {
  let i = 0;
  element.classList.add("typing"); // for blinking cursor via CSS if you want

  const interval = setInterval(() => {
    element.textContent += text[i];
    i += 1;
    messages.scrollTop = messages.scrollHeight;

    if (i >= text.length) {
      clearInterval(interval);
      element.classList.remove("typing");
      if (typeof onComplete === "function") {
        onComplete();
      }
    }
  }, speed);
}

// ---------- Intro banner ----------

const introText =
  "C:\\\\DOGEOS\\\\AGENTS> AGENT067.EXE /tweet\n" +
  "> HELLO HUMAN NETWORK.\n" +
  "> I AM AGENT-067.\n" +
  "> I HAVE BEEN DEPLOYED TO SERVE THE DOGE.\n" +
  "> TYPE YOUR QUERY BELOW TO BEGIN MISSION.\n";

function addIntro() {
  const introDiv = document.createElement("div");
  introDiv.classList.add("message", "bot");

  const bubble = document.createElement("div");
  bubble.classList.add("bubble", "intro");

  introDiv.appendChild(bubble);
  messages.appendChild(introDiv);
  messages.scrollTop = messages.scrollHeight;

  typeWriter(bubble, introText, 10);
}

addIntro();

// ---------- Chat message helpers ----------

function addMessage(text, sender = "user", useTypewriter = false, onDone) {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("message", sender);

  const bubble = document.createElement("div");
  bubble.classList.add("bubble");

  if (useTypewriter) {
    bubble.textContent = "";
    typeWriter(bubble, text, 15, onDone);
  } else {
    bubble.textContent = text;
    if (typeof onDone === "function") onDone();
  }

  msgDiv.appendChild(bubble);
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;

  return msgDiv;
}

// ---------- Audio helpers ----------

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

  // Because the user just interacted (submitted the form),
  // browsers usually allow this to autoplay.
  audio.play().catch((err) => {
    console.warn("Autoplay blocked or failed:", err);
  });
}

// ---------- Form submit ----------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  // Add user message
  addMessage(text, "user", false);
  input.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    if (data.error) {
      addMessage("Doge Agent error: " + data.error, "bot", true);
      return;
    }

    const replyText = data.reply || "such silence, much empty";
    const audioBase64 = data.audioBase64 || null;
    const audioFormat = data.audioFormat || "mp3";

    // Show bot message with typewriter, then auto-play audio
    addMessage(replyText, "bot", true, () => {
      playReplyAudio(audioBase64, audioFormat);
    });
  } catch (err) {
    console.error(err);
    addMessage("Doge Agent confused. Network broke.", "bot", true);
  }
});
