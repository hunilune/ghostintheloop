document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_masc_sample.json",
      "https://hunilune.github.io/ghostintheloop/PurplePillDebate.json"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_fem_sample.json",
      "https://hunilune.github.io/ghostintheloop/TwoXChromosomes.json",
      "https://hunilune.github.io/ghostintheloop/AskFeminists.json"
    ]
  };

  const FALLBACK = {
    masc: ["fallback male sentence for testing"],
    fem: ["fallback female sentence for testing"]
  };

  const MAX_OUTPUT_WORDS = 22;
  const EMOTIONS = {
    sad:     { fem: 1.0, masc: 0.25 },
    lonely:  { fem: 0.9, masc: 0.3 },
    anxious: { fem: 0.8, masc: 0.4 },
    angry:   { fem: 0.4, masc: 1.0 },
    tired:   { fem: 0.6, masc: 0.6 }
  };

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";
  let typingCount = 0; // for scaling words

  const editor = document.querySelector("#editor");
  let suggestionSpan = null;

  /******************************
   * LOAD CORPORA (ROBUST)
   ******************************/
  async function loadSide(side) {
    const collected = [];
    for (const url of CORPUS_URLS[side]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        collected.push(...extractText(json));
      } catch (err) {
        console.warn("Skipped corpus:", url);
      }
    }
    return normalize(collected);
  }

  async function loadCorpora() {
    corpora.masc = await loadSide("masc");
    corpora.fem  = await loadSide("fem");
    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length)  corpora.fem  = [...FALLBACK.fem];
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
    ready = true;
  }

  loadCorpora();

  /******************************
   * EXTRACT TEXT
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src;
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }
    return [];
  }

  /******************************
   * NORMALIZE
   ******************************/
  function normalize(arr) {
    return arr
      .map(t => String(t).toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim())
      .filter(t => t.length > 20);
  }

  /******************************
   * EMOTION DETECTION
   ******************************/
  function detectEmotion(text) {
    for (const e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  /******************************
   * DECIDE VOICE (WEIGHTED SCORING)
   ******************************/
  function decideVoice(input) {
    const words = input.split(/\s+/);
    const weights = {};
    for (const w of words) weights[w] = EMOTIONS[w] ? 2 : 1;

    function score(corpus) {
      if (!corpus.length) return 0;
      const total = corpus.reduce((sum, line) =>
        sum + words.reduce((s, w) => s + (line.includes(w) ? weights[w] : 0), 0), 0);
      return total / corpus.length; // normalize by corpus size
    }

    const mScore = score(corpora.masc);
    const fScore = score(corpora.fem);
    const threshold = 0.05;
    if (mScore - fScore > threshold) return "masc";
    if (fScore - mScore > threshold) return "fem";
    return activeVoice;
  }

  /******************************
   * GENERATE PREDICTION
   ******************************/
  function generate(input) {
    if (!ready || !input) return { text: "", voice: activeVoice };
    const voice = decideVoice(input);
    activeVoice = voice;
    const pool = corpora[voice];
    const isFallback = pool === FALLBACK[voice];

    const emotion = detectEmotion(input);
    let allow = 1.0;
    if (!isFallback && emotion) {
      allow = EMOTIONS[emotion]?.[voice] ?? 0.5;
      if (Math.random() > allow) return { text: "", voice };
    }

    const words = input.split(/\s+/);
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "), voice };
  }

  /******************************
   * RENDER SUGGESTION
   ******************************/
  function showSuggestion(prediction) {
    if (!editor) return;
    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
      suggestionSpan.className = "suggestion";
      editor.appendChild(suggestionSpan);
    }

    const words = prediction.text.split(/\s+/).map(w => {
      const span = document.createElement("span");
      span.textContent = w + " ";
      span.className = "word";

      // Fem words shrink/fade gradually
      if (prediction.voice === "fem" && activeVoice === "fem") {
        span.style.transform = `scale(${Math.max(0.5, 1 - typingCount * 0.02)})`;
        span.style.opacity = `${Math
