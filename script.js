document.addEventListener("DOMContentLoaded", function() {

  // ================= CONFIG =================
  const STYLE_LIMITS = { masc: 300, fem: 60 };
  let lockedStyle = null;
  let markovChain = null;
  let redditCorpus = null;
  const usedSlots = new Set();
  let isStreaming = false;

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

  // ================= MARKOV =================
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

  function generateWords(chain, length = 14) {
    const keys = Object.keys(chain);
    if (!keys.length) return [];

    let word = keys[Math.floor(Math.random() * keys.length)];
    let result = [word];

    for (let i = 0; i < length; i++) {
      const nexts = chain[word];
      if (!nexts) break;
      word = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(word);
    }
    return result;
  }

  function streamWords(words, el, delay = 120) {
    if (isStreaming) return;
    isStreaming = true;

    el.textContent = "";
    let i = 0;

    function tick() {
      if (i >= words.length) {
        isStreaming = false;
        return;
      }
      el.textContent += (i === 0 ? "" : " ") + words[i];
      i++;
      setTimeout(tick, delay);
    }

    tick();
  }

  // ================= FETCH JSON =================
  const jsonUrl = "https://hunilune.github.io/ghostintheloop/redditSample.json";

  fetch(jsonUrl)
    .then(res => res.json())
    .then(data => {
      const posts = data.data.children;
      redditCorpus = posts
        .map(p => `${p.data.title} ${p.data.selftext}`)
        .join(" ")
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, "");

      markovChain = buildMarkov(redditCorpus);

      console.log("Reddit corpus loaded");
      console.log("Sample:", redditCorpus.slice(0, 200));
      console.log("Word count:", redditCorpus.split(/\s+/).length);
    })
    .catch(err => console.error("FETCH ERROR:", err));

  // ================= INPUT HANDLING =================
  document.querySelectorAll(".editable").forEach(editable => {

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

      if (!markovChain) return;

      const slot = editable.dataset.slot;
      if (!slot || usedSlots.has(slot)) return;

      const text = editable.innerText.trim().toLowerCase();
      if (!text) return;

      if (!lockedStyle) {
        lockedStyle = detectStyle(text);
        applyStyle(lockedStyle);
      }

      const predEl = document.querySelector(`.predicted[data-slot="${slot}"]`);
      if (!predEl) return;

      const words = generateWords(markovChain, 14);
      const speed = lockedStyle === "masc" ? 80 : 150;

      streamWords(words, predEl, speed);
      usedSlots.add(slot);
    });
  });

});
