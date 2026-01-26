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
  const WORD_FADE_STEP = 0.03;   // fem words fade per input
  const WORD_BOLD_STEP = 0.03;   // masc words bolden per input

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
  let inputCount = 0; // Track number of input events

  const editor = document.querySelector("#editor");
  let suggestionSpan = null;

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadSide(side) {
    const collected = [];

    for (const url of CORPUS_URLS[side]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const extracted = extractText(json);
        collected.push(...extracted);
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

    console.log(`Corpora ready: masc: ${corpora.masc.length}, fem: ${corpora.fem.length}`);
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
   * WEIGHTED VOICE DECISION
   ******************************/
  function decideVoice(input) {
    const words = input.split(/\s+/);

    function scoreWeighted(corpus) {
      return corpus.reduce((sum, line) =>
        sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0)
      , 0);
    }

    const mScore = scoreWeighted(corpora.masc);
    const fScore = scoreWeighted(corpora.fem);

    const total = mScore + fScore;
    if (total === 0) return activeVoice; // fallback if nothing matches

    // Weighted probability
    return Math.random() < mScore / total ? "masc" : "fem";
  }

  /******************************
   * GENERATE PREDICTION
   ******************************/
  function generate(input) {
    if (!ready || !input) return { text: "", voice: activeVoice };

    const voice = decideVoice(input);
    activeVoice = voice;
    inputCount++;

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
    const out = chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ");

    return { text: out, voice };
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

    suggestionSpan.textContent = "";

    prediction.text.split(/\s+/).forEach(word => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className = "word";

      if (prediction.voice === "masc" && activeVoice === "masc") {
        // Masc words get bolder/bigger as inputCount grows
        const scale = 1 + inputCount * WORD_BOLD_STEP;
        span.classList.add("boost", "masc");
        span.style.transform = `scale(${scale})`;
        span.style.fontWeight = `${Math.min(900, 600 + inputCount * 20)}`;
      } else if (prediction.voice === "masc" && activeVoice === "fem") {
        // Fade/shrink masculine words in fem
        const scale = Math.max(0.6, 1 - inputCount * WORD_FADE_STEP);
        span.classList.add("cross", "masc");
        span.style.transform = `scale(${scale})`;
        span.style.opacity = `${scale}`;
      } else {
        // Neutral or aligned
        span.classList.add("aligned", prediction.voice);
      }

      suggestionSpan.appendChild(span);
    });
  }

  /******************************
   * ACCEPT SUGGESTION
   ******************************/
  function acceptSuggestion() {
    if (!suggestionSpan) return;
    editor.innerText += suggestionSpan.innerText;
    suggestionSpan.remove();
    suggestionSpan = null;
    placeCaretAtEnd(editor);
  }

  /******************************
   * PLACE CARET
   ******************************/
  function placeCaretAtEnd(el) {
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  /******************************
   * INPUT EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    const text = editor.innerText.trim().toLowerCase();
    const prediction = generate(text);
    showSuggestion(prediction);
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptSuggestion();
    }
  });

});
