// ================= CONFIG =================
const STYLE_LIMITS = { masc: 300, fem: 60 };
let lockedStyle = null;
let markovChain = null;
const usedSlots = new Set();
let redditCorpus = null;

// ================= STYLE DETECTION =================
function detectStyle(text) {
  let masc = 0, fem = 0;

  if (text.match(/\b(must|should|fix|obvious|why)\b/)) masc += 2;
  if (text.match(/\b(maybe|i think|i feel|sorry|just)\b/)) fem += 2;

  if (text.includes("!")) masc++;
  if (text.includes("?") || text.includes("...")) fem++;

  return masc >= fem ? "masc" : "fem";
}

// Apply style to document & set max character per input
function applyStyle(style) {
  document.documentElement.classList.add(`mode-${style}`);
  document.querySelectorAll(".editable").forEach(el => {
    el.dataset.max = STYLE_LIMITS[style];
  });
}

// Helper to place caret at end
function placeCaretAtEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ================= MARKOV FUNCTIONS =================
function buildMarkov(text) {
  const words = text.trim().split(/\s+/);
  const chain = {};
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (!chain[w]) chain[w] = [];
    chain[w].push(next);
  }
  return chain;
}

function generate(chain, length = 6) {
  const keys = Object.keys(chain);
  if (!keys.length) return "";
  let word = keys[Math.floor(Math.random() * keys.length)];
  let result = [word];
  for (let i = 0; i < length; i++) {
    const nexts = chain[word];
    if (!nexts) break;
    word = nexts[Math.floor(Math.random() * nexts.length)];
    result.push(word);
  }
  return " " + result.join(" ");
}

// ================= FETCH LOCAL JSON =================
fetch("redditSample.json")
  .then(res => res.json())
  .then(data => {
    const posts = data.data.children;
    redditCorpus = posts
      .map(p => `${p.data.title} ${p.data.selftext}`)
      .join(" ")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, "");

    console.log("Reddit corpus loaded");
    console.log("Sample:", redditCorpus.slice(0, 200));
    console.log("Word count:", redditCorpus.split(/\s+/).length);
  })
  .catch(err => console.error("FETCH ERROR:", err));

// ================= INPUT HANDLING =================
document.querySelectorAll(".editable").forEach(editable => {
  // Enforce character limit while typing
  editable.addEventListener("input", () => {
    if (!lockedStyle) return;
    const max = parseInt(editable.dataset.max, 10);
    if (!max) return;
    if (editable.innerText.length > max) {
      editable.innerText = editable.innerText.slice(0, max);
      placeCaretAtEnd(editable);
    }
  });

  editable.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const slot = editable.dataset.slot;
    if (usedSlots.has(slot)) return;

    const text = editable.innerText.trim().toLowerCase();
    if (!text) return;

    // Lock style and build Markov on first Enter
    if (!lockedStyle) {
      lockedStyle = detectStyle(text);
      applyStyle(lockedStyle);
      markovChain = redditCorpus ? buildMarkov(redditCorpus) : buildMarkov("default fallback text");
    }

    const prediction = generate(markovChain);

    const predEl = document.querySelector(`.predicted[data-slot="${slot}"]`);
    predEl.textContent = prediction;

    usedSlots.add(slot);
  });
});
