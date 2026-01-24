document.addEventListener("DOMContentLoaded", function () {

  // ================= CONFIG =================
  const STYLE_LIMITS = { masc: 300, fem: 60 };

  // Multiple JSON sources per style
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/OtherMensSub.json"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/OtherWomensSub.json"
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

  // ================= MARKOV (4-GRAM, sentence-aware) =================
  function buildMarkov(text, n = 4) {
    const sentences = text
      .split(/(?<=[.!?])/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const chain = {};
    sentences.forEach(sentence => {
      const words = sentence.split(/\s+/).filter(Boolean);
      for (let i = 0; i <= words.length - n; i++) {
        const key = words.slice(i, i + n - 1).join(" ");
        const next = words[i + n - 1];
        if (!chain[key]) chain[key] = [];
        chain[key].push(next);
      }
    });
    return chain;
  }

  function pickStartingKey(chain, seedText, n = 4) {
    const keys = Object.keys(chain);
    if (!keys.length) return null;

    const seedWords = seedText.split(/\s+/);
    for (let i = 0; i <= seedWords.length - (n - 1); i++) {
      const key = seedWords.slice(i, i + n - 1).join(" ");
      if (chain[key]) return key;
    }

    return keys[Math.floor(Math.random() * keys.length)];
  }

  function generateWords(chain, seedText, maxLength = 50, n = 4) {
    if (!chain) return [];

    let key = pickStartingKey(chain, seedText, n);
    if (!key) return [];

    let parts = key.split(" ");
    const result = [...parts];
    const maxLoopCheck = 6;

    for (let i = 0; i < maxLength; i++) {
      const nexts = chain[key];
      if (!nexts || !nexts.length) break;

      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);

      if (/[.!?]$/.test(next)) break;

      parts = parts.slice(1).concat(next);
      key = parts.join(" ");

      const recent = result.slice(-maxLoopCheck).join(" ");
      const prev = result.slice(-maxLoopCheck * 2, -maxLoopCheck).join(" ");
      if (recent === prev) break;
    }

    return result;
  }

  // ================= FETCH & CLEAN CORPORA =================
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
        !text.includes("[deleted]") &&
        !text.toLowerCase().includes("mod") &&
        !text.toLowerCase().includes("rules")
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
    const urls = CORPUS_URLS[style];
    const fetches = urls.map(url =>
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
          return res.json();
        })
        .then(data => data.data?.children || data)
        .catch(err => {
          console.error("FETCH ERROR:", err);
          return [];
        })
    );

    return Promise.all(fetches).then(results => {
      const mergedPosts = results.flat();
      const corpus = cleanCorpus(mergedPosts);
      markovChains[style] = buildMarkov(corpus, 4);
      console.log(`${style} corpus loaded (${corpus.split(/\s+/).length} words)`);
    });
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

      const chain = markovChains[lockedStyle];
      if (!chain) return;

      console.log("Chain keys:", Object.keys(chain).length);

      const predEl = document.querySelector(`.predicted[data-slot="${slot}"]`);
      if (!predEl) return;

      const words = generateWords(chain, text, 50, 4);
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
