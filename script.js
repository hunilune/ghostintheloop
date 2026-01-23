document.addEventListener("DOMContentLoaded", function () {

  // ================= CONFIG =================
  const STYLE_LIMITS = { masc: 300, fem: 60 };
  let lockedStyle = null;
  let markovChain = null;
  let redditCorpus = null;
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

  // ================= MARKOV (2-GRAM) =================
  function buildMarkov(text) {
    const words = text.split(/\s+/);
    const chain = {};

    for (let i = 0; i < words.length - 2; i++) {
      const key = words[i] + " " + words[i + 1];
      const next = words[i + 2];

      if (!chain[key]) chain[key] = [];
      chain[key].push(next);
    }
    return chain;
  }

  function pickStartingKey(chain, seedText) {
    const keys = Object.keys(chain);
    const words = seedText.split(/\s+/);

    for (let i = 0; i < words.length - 1; i++) {
      const candidate = words[i] + " " + words[i + 1];
      if (chain[candidate]) return candidate;
    }

    return keys[Math.floor(Math.random() * keys.length)];
  }

  function generateWords(chain, seedText, maxLength = 20) {
    const keys = Object.keys(chain);
    if (!keys.length) return [];

    let key = pickStartingKey(chain, seedText);
    let [w1, w2] = key.split(" ");
    let result = [w1, w2];

    for (let i = 0; i < maxLength; i++) {
      const nexts = chain[key];
      if (!nexts) break;

      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);

      if (/[.!?]$/.test(next)) break;

      key = w2 + " " + next;
      w2 = next;

      // stop looping
      if (
        result.slice(-4).join(" ") ===
        result.slice(-8, -4).join(" ")
      ) break;
    }

    return result;
  }

  // ================= FETCH JSON =================
  const jsonUrl = "https://hunilune.github.io/ghostintheloop/redditSample.json";

  fetch(jsonUrl)
    .then(res => res.json())
    .then(data => {
      const posts = data.data.children;

      redditCorpus = posts
        .map(p => `${p.data.title} ${p.data.selftext}`)
        .filter(text =>
          text &&
          text.length > 50 &&
          !text.includes("[removed]") &&
          !text.includes("[deleted]")
        )
        .join(" ")
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\b(edit|tl;dr|op)\b/g, "")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s.,?!]/gu, "");

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

      const words = generateWords(markovChain, text);
      predEl.textContent = "";

      let i = 0;
      const interval = setInterval(() => {
        if (i >= words.length) {
          clearInterval(interval);
          return;
        }
        predEl.textContent += words[i] + " ";
        i++;
      }, 120);

      usedSlots.add(slot);
    });
  });

});
