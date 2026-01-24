document.addEventListener("DOMContentLoaded", function () {

  // ================= CONFIG =================
  const STYLE_LIMITS = { masc: 300, fem: 60 };

  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_masc_sample.json"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_fem_sample.json"
    ]
  };

  const NO_SUPPORT_MESSAGES = {
    masc: [
      "this phrasing is uncommon in this voice",
      "language tends to turn away at this point",
      "this sentiment rarely continues here",
      "this thought is often redirected rather than expanded"
    ],
    fem: [
      "this thought is usually expanded differently",
      "language often softens or contextualizes here",
      "this phrasing tends to invite elaboration"
    ]
  };

  let lockedStyle = null;
  let markovChains = { masc: null, fem: null };
  const usedSlots = new Set();

  // ================= STYLE DETECTION =================
  function detectStyle(text) {
    let masc = 0, fem = 0;

    if (text.match(/\b(must|should|fix|obvious|why)\b/)) masc += 2;
    if (text.match(/\b(maybe|i think|i feel|sorry|just)\b/)) fem += 2;

    if (text.includes("!")) masc++;
    if (text.includes("?") || text.includes("...")) fem++;

    return masc >= fem ? "masc" : "fem";
  }

  function applyStyle(style) {
    document.documentElement.classList.add(`mode-${style}`);
    document.querySelectorAll(".editable").forEach(el => {
      el.dataset.max = STYLE_LIMITS[style];
    });
  }

  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // ================= MARKOV + PREFIX INDEX =================
  function buildMarkov(text) {
    const words = text.split(/\s+/);
    const chain = {};
    const prefixIndex = {};

    for (let i = 0; i < words.length - 3; i++) {
      const key = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      const next = words[i + 3];

      if (!chain[key]) chain[key] = [];
      chain[key].push(next);

      const p2 = `${words[i + 1]} ${words[i + 2]}`;
      const p1 = words[i + 2];

      if (!prefixIndex[p2]) prefixIndex[p2] = [];
      if (!prefixIndex[p1]) prefixIndex[p1] = [];

      prefixIndex[p2].push(key);
      prefixIndex[p1].push(key);
    }

    return { chain, prefixIndex };
  }

  // ================= BACKOFF PICKER =================
  function pickStartingKeyBackoff(markov, seedText) {
    const { chain, prefixIndex } = markov;
    const words = seedText.split(/\s+/);

    for (let n = 3; n >= 2; n--) {
      if (words.length < n) continue;
      const key = words.slice(-n).join(" ");
      if (chain[key]) return key;
    }

    for (let n = 2; n >= 1; n--) {
      if (words.length < n) continue;
      const suffix = words.slice(-n).join(" ");
      const options = prefixIndex[suffix];
      if (options && options.length) {
        return options[Math.floor(Math.random() * options.length)];
      }
    }

    return null;
  }

  // ================= GENERATION =================
  function generateWords(markov, seedText, maxLength = 30) {
    const startKey = pickStartingKeyBackoff(markov, seedText);
    if (!startKey) return [];

    let parts = startKey.split(" ");
    let result = [];
    let key = startKey;

    for (let i =
