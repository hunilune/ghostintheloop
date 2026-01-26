document.addEventListener("DOMContentLoaded", () => {

  // ================= CONFIG =================

  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  const ALIGN_THRESHOLD = 2; // how much stronger one corpus must be
  const MIN_SIGNAL = 2;      // minimum frequency to count

  let lockedStyle = null;
  let markovChains = { masc: null, fem: null };
  let freqMaps = { masc: null, fem: null };

  // ================= STYLE DETECTION =================

  function detectStyle(text) {
    let masc = 0, fem = 0;

    if (text.match(/\b(must|should|fix|prove|logic|handle)\b/)) masc += 2;
    if (text.match(/\b(feel|felt|sad|lonely|sorry|cry)\b/)) fem += 2;

    if (text.includes("!")) masc++;
    if (text.includes("?") || text.includes("...")) fem++;

    return masc >= fem ? "masc" : "fem";
  }

  function applyStyle(style) {
    document.documentElement.classList.add(`mode-${style}`);
  }

  // ================= CORPUS CLEANING =================

  function cleanCorpus(posts) {
    return posts
      .map(p => `${p.data.title} ${p.data.selftext}`)
      .filter(t =>
        t &&
        t.length > 60 &&
        !t.includes("[removed]") &&
        !t.includes("[deleted]")
      )
      .join(" ")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\b(edit|tl;dr|op)\b/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s.,?!]/gu, "");
  }

  // ================= MARKOV =================

  function buildMarkov(text) {
    const words = text.split(/\s+/);
    const chain = {};

    for (let i = 0; i < words.length - 3; i++) {
      const key = `${words[i]} ${words[i+1]} ${words[i+2]}`;
      const next = words[i+3];
      if (!chain[key]) chain[key] = [];
      chain[key].push(next);
    }
    return chain;
  }

  function pickKey(chain, seed) {
    const keys = Object.keys(chain);
    const words = seed.split(/\s+/);

    for (let i = words.length - 3; i >= 0; i--) {
      const key = `${words[i]} ${words[i+1]} ${words[i+2]}`;
      if (chain[key]) return key;
    }
    return keys[Math.floor(Math.random() * keys.length)];
  }

  function generate(chain, seed, max = 30) {
    const start = pickKey(chain, seed);
    if (!start) return "";

    let parts = start.split(" ");
    let result = [];

    for (let i = 0; i < max; i++) {
      const nexts = chain[parts.join(" ")];
      if (!nexts) break;
      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);
      if (/[.!?]$/.test(next)) break;
      parts = [parts[1], parts[2], next];
    }
    return result.join(" ");
  }

  // ================= FREQUENCY MAPS =================

  function buildFrequencyMap(text) {
    const map = {};
    text.split(/\s+/).forEach(w => {
      if (w.length < 2) return;
      if (!map[w]) map[w] = 0;
      map[w]++;
    });
    return map;
  }

  // ================= LOAD CORPORA =================

  function loadCorpus(style) {
    return fetch(CORPUS_URLS[style])
      .then(res => res.json())
      .then(data => {
        const text = cleanCorpus(data.data.children);
        markovChains[style] = buildMarkov(text);
        freqMaps[style] = buildFrequencyMap(text);
        console.log(`${style} corpus loaded`);
      });
  }

  Promise.all([loadCorpus("masc"), loadCorpus("fem")])
    .then(() => console.log("All corpora ready"));

  // ================= SOCIAL CLASSIFICATION =================

  function classifyWord(word) {
    const m = freqMaps.masc[word] || 0;
    const f = freqMaps.fem[word] || 0;

    if (m >= f * ALIGN_THRESHOLD && m >= MIN_SIGNAL) return "masc";
    if (f >= m * ALIGN_THRESHOLD && f >= MIN_SIGNAL) return "fem";
    return "neutral";
  }

  function annotateSentence(text) {
    const words = text.split(/\s+/);
    let mascScore = 0, femScore = 0;

    const annotated = words.map(w => {
      const clean = w.replace(/[^\p{L}\p{N}]/gu, "");
      const cls = classifyWord(clean);
      if (cls === "masc") mascScore++;
      if (cls === "fem") femScore++;
      return cls === "neutral" ? w : `<span class="word ${cls}">${w}</span>`;
    });

    let alignment = "neutral";

    if (lockedStyle === "masc") {
      if (mascScore > femScore) alignment = "aligned";
      else if (femScore > mascScore) alignment = "cross";
    }

    if (lockedStyle === "fem") {
      if (femScore > mascScore) alignment = "aligned";
      else if (mascScore > femScore) alignment = "cross";
    }

    return { html: annotated.join(" "), alignment };
  }

  function applyVisualHierarchy(el, annotated) {
    el.innerHTML = annotated.html;
    el.classList.remove("aligned", "cross", "neutral");
    el.classList.add(annotated.alignment);

    document.documentElement.classList.remove("mode-aligned", "mode-cross");
    if (annotated.alignment === "aligned")
      document.documentElement.classList.add("mode-aligned");
    if (annotated.alignment === "cross")
      document.documentElement.classList.add("mode-cross");
  }

  // ================= INPUT HANDLING =================

  document.querySelectorAll(".editable").forEach(editable => {
    editable.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      const text = editable.innerText.trim().toLowerCase();
      if (!text) return;

      if (!lockedStyle) {
        lockedStyle = detectStyle(text);
        applyStyle(lockedStyle);
      }

      const chain = markovChains[lockedStyle];
      if (!chain) return;

      const prediction = generate(chain, text);
      const predEl = document.querySelector(
        `.predicted[data-slot="${editable.dataset.slot}"]`
      );

      if (!predEl) return;

      const annotated = annotateSentence(prediction || text);
      applyVisualHierarchy(predEl, annotated);
    });
  });

});
