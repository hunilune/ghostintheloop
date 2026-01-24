document.addEventListener("DOMContentLoaded", function () {

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
      "this sentiment rarely continues here"
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
    document.querySelectorAll(".editable").forEach(el => el.dataset.max = STYLE_LIMITS[style]);
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

  // ================= MARKOV + PREFIX =================
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
    return { chain, prefixIndex, allKeys: Object.keys(chain) };
  }

  function pickStartingKeyApprox(markov, seedText) {
    const { chain, prefixIndex, allKeys } = markov;
    const words = seedText.split(/\s+/);

    // Exact suffix match
    for (let n = 3; n >= 2; n--) {
      if (words.length < n) continue;
      const key = words.slice(-n).join(" ");
      if (chain[key]) return key;
    }

    // Prefix fallback
    for (let n = 2; n >= 1; n--) {
      if (words.length < n) continue;
      const suffix = words.slice(-n).join(" ");
      const options = prefixIndex[suffix];
      if (options && options.length) return options[Math.floor(Math.random() * options.length)];
    }

    // Approximate semantic: pick a key sharing any word
    const approx = allKeys.filter(k => words.some(w => k.includes(w)));
    if (approx.length) return approx[Math.floor(Math.random() * approx.length)];

    return null;
  }

  function generateWords(markov, seedText, maxLength = 30) {
    const startKey = pickStartingKeyApprox(markov, seedText);
    if (!startKey) return [];
    let parts = startKey.split(" ");
    let result = [];
    let key = startKey;
    for (let i = 0; i < maxLength; i++) {
      const nexts = markov.chain[key];
      if (!nexts) break;
      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);
      if (/[.!?]$/.test(next)) break;
      parts = parts.slice(1).concat(next);
      key = parts.join(" ");
    }
    return result;
  }

  function cleanCorpus(posts) {
    return posts
      .map(p => `${p.data?.title || ""} ${p.data?.selftext || ""}`)
      .filter(text => text && text.length > 60 && !text.includes("[removed]") && !text.includes("[deleted]"))
      .join(" ")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\b(edit|tl;dr|op)\b/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s.,?!]/gu, "");
  }

  function loadCorpus(style) {
    return Promise.all(
      CORPUS_URLS[style].map(url => fetch(url).then(res => res.json()))
    ).then(allData => {
      let combinedText = "";
      allData.forEach(data => {
        if (Array.isArray(data)) combinedText += " " + data.join(" ");
        else if (data?.data?.children) combinedText += " " + cleanCorpus(data.data.children);
      });
      markovChains[style] = buildMarkov(combinedText);
      console.log(`${style} corpus ready`);
    });
  }

  Promise.all([loadCorpus("masc"), loadCorpus("fem")])
    .then(() => console.log("All corpora loaded"));

  document.querySelectorAll(".editable").forEach(editable => {

    editable.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      const slot = editable.dataset.slot;
      if (!slot || usedSlots.has(slot)) return;

      let text = editable.innerText.trim().toLowerCase();
      if (!text) return;

      // ===== PREPEND "I feel" FOR SHORT INPUTS =====
      if (text.split(/\s+/).length < 3) {
        text = "i feel " + text;
      }

      if (!lockedStyle) {
        lockedStyle = detectStyle(text);
        applyStyle(lockedStyle);
      }

      const markov = markovChains[lockedStyle];
      if (!markov) return;

      const predEl = document.querySelector(`.predicted[data-slot="${slot}"]`);
      if (!predEl) return;

      predEl.classList.remove("no-support");
      predEl.textContent = "";

      const words = generateWords(markov, text);

      if (!words.length) {
        predEl.classList.add("no-support");
        predEl.textContent = NO_SUPPORT_MESSAGES[lockedStyle][Math.floor(Math.random() * NO_SUPPORT_MESSAGES[lockedStyle].length)];

        const hint = document.createElement("div");
        hint.className = "suggestion";
        hint.textContent = "click to explore alternative phrasing or add cause/context";
        hint.style.cursor = "pointer";
        hint.addEventListener("click", () => {
          editable.innerText += " ...";
          placeCaretAtEnd(editable);
        });

        predEl.appendChild(hint);
        usedSlots.add(slot);
        return;
      }

      let i = 0;
      const interval = setInterval(() => {
        if (i >= words.length) { clearInterval(interval); return; }
        predEl.textContent += words[i] + " ";
        i++;
      }, 110);

      usedSlots.add(slot);
    });
  });

});
