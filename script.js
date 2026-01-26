document.addEventListener("DOMContentLoaded", () => {

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

  const editor = document.querySelector("#editor");
  let suggestionSpan = null;
  let typeCount = 0; // track input to scale words

  /******************************
   * Load corpora
   ******************************/
  async function loadSide(side) {
    const collected = [];
    for (const url of CORPUS_URLS[side]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        collected.push(...extractText(json));
      } catch {
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

    ready = true;
    console.log("Corpora ready:", corpora);
  }

  loadCorpora();

  /******************************
   * Extract & normalize
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src;
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c =>
        `${c.data.title || ""} ${c.data.selftext || ""}`
      );
    }
    return [];
  }

  function normalize(arr) {
    return arr
      .map(t => String(t).toLowerCase().replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim())
      .filter(t => t.length > 20);
  }

  /******************************
   * Emotion detection
   ******************************/
  function detectEmotion(text) {
    for (const e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  /******************************
   * Voice scoring (weighted)
   ******************************/
  function decideVoice(input) {
    const words = input.split(/\s+/);

    function score(corpus) {
      return corpus.reduce(
        (sum, line) => sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0),
        0
      );
    }

    const mascScore = score(corpora.masc);
    const femScore  = score(corpora.fem);

    const weightedMasc = mascScore * 1.0; // can adjust weights
    const weightedFem  = femScore * 1.0;

    if (weightedMasc > weightedFem) return "masc";
    if (weightedFem > weightedMasc) return "fem";
    return activeVoice;
  }

  /******************************
   * Generate prediction
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
    const out = chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ");

    return { text: out, voice };
  }

  /******************************
   * Render suggestion with dynamic scaling
   ******************************/
  function showSuggestion(prediction) {
    if (!editor) return;

    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
      suggestionSpan.className = "suggestion";
      editor.appendChild(suggestionSpan);
    }

    typeCount += 1; // increment each time new input

    const words = prediction.text.split(/\s+/).map(w => {
      const span = document.createElement("span");
      span.textContent = w + " ";
      span.className = "word";

      // scale/fade dynamically
      let scale = 1, weight = 600, letterSpacing = 0;

      if (prediction.voice === "masc" && activeVoice === "masc") {
        span.classList.add("boost", "masc");
        scale = 1 + 0.02 * typeCount;           // grow gradually
        weight = 600 + Math.min(typeCount*5, 100);
        letterSpacing = 0.01 * typeCount;       // prevent overlap
      } else if (prediction.voice === "masc" && activeVoice === "fem") {
        span.classList.add("cross", "masc");
        scale = 1 - 0.015 * typeCount;          // shrink gradually
        weight = 300;
        letterSpacing = -0.005 * typeCount;     // tighter
      } else {
        span.classList.add("aligned", prediction.voice);
      }

      span.style.transform = `scale(${scale})`;
      span.style.fontWeight = weight;
      span.style.letterSpacing = `${letterSpacing}em`;

      return span;
    });

    suggestionSpan.textContent = "";
    words.forEach(w => suggestionSpan.appendChild(w));
  }

  /******************************
   * Accept suggestion
   ******************************/
  function acceptSuggestion() {
    if (!suggestionSpan) return;

    // Append suggestion without duplicating
    const insertText = suggestionSpan.innerText;
    const cursorPos = window.getSelection().anchorOffset;
    const textBefore = editor.innerText.slice(0, cursorPos);
    const textAfter = editor.innerText.slice(cursorPos);

    editor.innerText = textBefore + insertText + textAfter;

    // Remove suggestion span
    suggestionSpan.remove();
    suggestionSpan = null;

    placeCaretAtEnd(editor);
  }

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
   * Input events
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
