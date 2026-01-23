document.addEventListener("DOMContentLoaded", function () {

  // ================= CONFIG =================
  const STYLE_LIMITS = { masc: 300, fem: 60 };
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
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

  // ================= MARKOV (3-GRAM) =================
  function buildMarkov(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chain = {};

    for (let i = 0; i < words.length - 3; i++) {
      const key = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      const next = words[i + 3];
      if (!chain[key]) chain[key] = [];
      chain[key].push(next);
    }
    return chain;
  }

  function pickStartingKey(chain, seedText) {
    const keys = Object.keys(chain);
    if (!keys.length) return null;

    const seedWords = seedText.split(/\s+/);
    for (let i = 0; i < seedWords.length - 2; i++) {
      const key = `${seedWords[i]} ${seedWords[i + 1]} ${seedWords[i + 2]}`;
      if (chain[key]) return key;
    }

    return keys[Math.floor(Math.random() * keys.length)];
  }

  function generateWords(chain, seedText, maxLength = 24) {
    if (!chain) return [];

    let key = pickStartingKey(chain, seedText);
    if (!key) return [];

    let parts = key.split(" ");
    const result = [...parts];
    const maxLoopCheck = 6; // Number of words to check for repetition

    for (let i = 0; i < maxLength; i++) {
      const nexts = chain[key];
      if (!nexts || !nexts.length) break;

      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);

      // Stop at sentence end
      if (/[.!?]$/.test(next)) break;

      // Update key for next iteration
      parts = [parts[1], parts[2], next];
      key = parts.join(" ");

      // Prevent simple looping
      const recent = result.slice(-maxLoopCheck).join(" ");
      const prev = result.slice(-maxLoopCheck * 2, -maxLoopCheck).join(" ");
      if (recent === prev) break;
    }

    return result;
  }

  // ================= FETCH CORPORA =================
  function cleanCorpus(posts) {
    return posts
      .map(p => {
        if (p.data) return `${p.data.title || ""} ${p.data.selftext || ""}`;
        return p;
      })
      .filter(text =>
        text &&
        text.length > 60 &&
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
  }

  function loadCorpus(style) {
    return fetch(CORPUS_URLS[style])
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${style}`);
        return res.json();
      })
      .then(data => {
        const corpus = cleanCorpus(data.data?.children || data);
        markovChains[style] = buildMarkov(corpus);
        console.log(`${style} corpus loaded (${corpus.split(/\s+/).length} words)`);
      })
      .catch(err => console.error("FETCH ERROR:", err));
  }

  Promise.all([loadCorpus("masc"), loadCorpus("fem")])
    .then(() => console.log("All corpora ready"));

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

      const slot = editable.dataset.slot;
      if (!slot || usedSlots.has(slot)) return;

      const text = editable.innerText.trim().toLowerCase();
      if (!text) return;

      if (!lockedStyle) {
        lockedStyle = detectStyle(text);
        applyStyle(lockedStyle);
        console.log("ENTER pressed");
        console.log("Locked style:", lockedStyle);
      }

      const chain = markovChains[lockedStyle]; // ← declare before using
      if (!chain) return;

      console.log("Chain keys:", Object.keys(chain).length);

      const predEl = document.querySelector(`.predicted[data-slot="${slot}"]`);
      if (!predEl) return;

      const words = generateWords(chain, text);
      predEl.textContent = "";

      let i = 0;
      const interval = setInterval(() => {
        if (i >= words.length) {
          clearInterval(interval);
          return;
        }
        predEl.textContent += words[i] + " ";
        i++;
      }, 110);

      usedSlots.add(slot);
    });
  });

});
