const form = document.getElementById("chat-form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

// Add normal messages (user / bot / system)
function addMessage(text, who) {
  const div = document.createElement("div");

  if (who === "bot") {
    // ASCII box for Doge replies

    // Split into lines in case the model returns multi-line text
    const lines = text.split("\n").map(l => l.trim());
    const dogeLines = lines.map(l => "DOGE> " + l);

    // Get max line length to size the box
    const maxLen = dogeLines.reduce(
      (max, line) => Math.max(max, line.length),
      0
    );

    const border = "+" + "-".repeat(maxLen + 2) + "+";

    const boxedText =
      border +
      "\n" +
      dogeLines
        .map(line => {
          const padding = " ".repeat(maxLen - line.length);
          return "| " + line + padding + " |";
        })
        .join("\n") +
      "\n" +
      border;

    div.className = "msg bot";
    div.textContent = boxedText;
  } else {
    // user or system
    div.className = "msg " + who;
    div.textContent = text;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// ----- TYPEWRITER INTRO -----

const introText =
  "C:\\DOGEOS\\AGENTS> AGENT001.EXE /tweet\n" +
  "> HELLO HUMAN NETWORK.\n" +
  "> I AM AGENT-001.\n" +
  "> I HAVE BEEN DEPLOYED TO SERVE THE DOGE.\n" +
  "> SUCH MISSION. MUCH RESPONSIBILITY.";

function playIntro(speed = 30) {
  const div = document.createElement("div");
  div.className = "msg system typing"; // typing = show blinking cursor
  messages.appendChild(div);

  let i = 0;

  const interval = setInterval(() => {
    div.textContent += introText[i];
    i += 1;

    messages.scrollTop = messages.scrollHeight;

    if (i >= introText.length) {
      clearInterval(interval);
      div.classList.remove("typing"); // stop cursor when done
    }
  }, speed);
}

// Run intro once on page load
playIntro();

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
      addMessage("Doge Agent error: " + data.error, "bot");
    } else {
      addMessage(data.reply || "such silence, much empty", "bot");
    }
  } catch (err) {
    console.error(err);
    addMessage("Doge Agent confused. Network broke.", "bot");
  }
});
