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

  let lockedStyle = null;
  let markovChains = { masc: {}, fem: {} };
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

  // ================= MARKOV (3-GRAM CHAIN) =================
  function buildMarkov(text) {
    const words = text.split(/\s+/);
    const chain = {};

    for (let i = 0; i < words.length - 3; i++) {
      const key = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      const next = words[i + 3];
      if (!chain[key]) chain[key] = [];
      chain[key].push(next);
    }
    return chain;
  }

  // ================= CONTROLLED BACKOFF PICKER =================
  function pickStartingKeyBackoff(chain, seedText) {
    const words = seedText.split(/\s+/);

    // Try 3-word → 2-word suffixes
    for (let n = 3; n >= 2; n--) {
      if (words.length < n) continue;
      const key = words.slice(-n).join(" ");
      if (chain[key]) return key;
    }

    return null; // clean failure
  }

  // ================= GENERATION =================
  function generateWords(chain, seedText, maxLength = 30) {
    const startKey = pickStartingKeyBackoff(chain, seedText);
    if (!startKey) return [];

    let parts = startKey.split(" ");
    let result = [];
    let key = startKey;

    for (let i = 0; i < maxLength; i++) {
      const nexts = chain[key];
      if (!nexts) break;

      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);

      if (/[.!?]$/.test(next)) break;

      parts = parts.slice(1).concat(next);
      key = parts.join(" ");
    }

    return result;
  }

  // ================= CORPUS CLEANING =================
  function cleanCorpus(posts) {
    return posts
      .map(p => `${p.data?.title || ""} ${p.data?.selftext || ""}`)
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

  // ================= LOAD MULTIPLE JSONs =================
  function loadCorpus(style) {
    const urls = CORPUS_URLS[style];

    return Promise.all(
      urls.map(url =>
        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
      )
    ).then(allData => {
      let combinedText = "";

      allData.forEach(data => {
        if (Array.isArray(data)) {
          combinedText += " " + data.join(" ");
        } else if (data?.data?.children) {
          combinedText += " " + cleanCorpus(data.data.children);
        }
      });

      markovChains[style] = buildMarkov(combinedText);
      console.log(
        `${style} corpus ready — ${combinedText.split(/\s+/).length} words`
      );
    });
  }

  Promise.all([loadCorpus("masc"), loadCorpus("fem")])
    .then(() => console.log("All corpora loaded"))
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

      const slot = editable.dataset.slot;
      if (!slot || usedSlots.has(slot)) return;

      const text = editable.innerText.trim().toLowerCase();
      if (!text) return;

      if (!lockedStyle) {
        lockedStyle = detectStyle(text);
        applyStyle(lockedStyle);
        console.log("Locked style:", lockedStyle);
      }

      const chain = markovChains[lockedStyle];
      if (!chain) return;

      const predEl = document.querySelector(`.predicted[data-slot="${slot}"]`);
      if (!predEl) return;

      const words = generateWords(chain, text);
      predEl.textContent = "";

      // Clean failure = empty parentheses
      if (!words.length) {
        predEl.textContent = "";
        usedSlots.add(slot);
        return;
      }

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
