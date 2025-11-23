const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

// Typewriter function (for bot responses and intro)
function typeWriter(element, text, speed = 15) {
  let i = 0;
  element.classList.add("typing"); // blinking cursor via CSS

  const interval = setInterval(() => {
    element.textContent += text[i];
    i += 1;
    messages.scrollTop = messages.scrollHeight;

    if (i >= text.length) {
      clearInterval(interval);
      element.classList.remove("typing"); // stop blinking cursor
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

// ----- ADD MESSAGE -----
function addMessage(text, who, typeEffect = false) {
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
      typeWriter(div, boxedText, 10); // SPEED here (lower = slower)
    } else {
      div.textContent = boxedText;
    }
  } else {
    // User or system message
    if (typeEffect) {
      typeWriter(div, text, 10);
    } else {
      div.textContent = text;
    }
  }

  messages.scrollTop = messages.scrollHeight;
}

// ----- CHAT LOGIC -----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    if (data.error) {
      addMessage("Doge Agent error: " + data.error, "bot", true);
    } else {
      addMessage(data.reply || "such silence, much empty", "bot", true); // enabled typewriter
    }
  } catch (err) {
    console.error(err);
    addMessage("Doge Agent confused. Network broke.", "bot", true);
  }
});
