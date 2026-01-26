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

    console.log("Corpora ready:", {
      masc: corpora.masc.length,
      fem: corpora.fem.length
    });

    ready = true;
  }

  loadCorpora();

  /******************************
   * EXTRACT TEXT
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

  /******************************
   * NORMALIZE
   ******************************/
  function normalize(arr) {
    return arr
      .map(t =>
        String(t)
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(t => t.length > 20);
  }

  /******************************
   * EMOTION DETECTION
   ******************************/
  function detectEmotion(text) {
    for (const e in EMOTIONS) {
      if (text.includes(e)) return e;
    }
    return null;
  }

  /******************************
   * VOICE DECISION
   ******************************/
  function decideVoice(input) {
    const words = input.split(/\s+/);

    function score(corpus) {
      return corpus.reduce(
        (sum, line) =>
          sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0),
        0
      );
    }

    const m = score(corpora.masc);
    const f = score(corpora.fem);

    if (m > f) return "masc";
    if (f > m) return "fem";
    return activeVoice;
  }

  /******************************
   * GENERATION
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
      if (Math.random() > allow) {
        return { text: "", voice };
      }
    }

    const words = input.split(/\s+/);
    let candidates = pool.filter(t =>
      words.some(w => t.includes(w))
    );

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

    const words = prediction.text.split(/\s+/).map(w => {
      const span = document.createElement("span");
      span.textContent = w + " ";
      span.className = "word";

      // Fade/shrink for masculine words in fem voice
      if (prediction.voice === "masc" && activeVoice === "fem") {
        span.classList.add("cross", "masc");
      } 
      // Boost for masculine words in masc voice
      else if (prediction.voice === "masc" && activeVoice === "masc") {
        span.classList.add("boost", "masc");
      } 
      // Aligned or neutral words
      else {
        span.classList.add("aligned", prediction.voice);
      }

      // Optional color coding
      span.style.color = prediction.voice === "masc" ? "#3b6cff" : "#d44b8c";

      return span;
    });

    suggestionSpan.textContent = "";
    words.forEach(w => suggestionSpan.appendChild(w));
  }

  /******************************
   * ACCEPT SUGGESTION
   ******************************/
  function acceptSuggestion() {
    if (!suggestionSpan) return;

    // Move all suggestion spans into editor, preserving styling
    while (suggestionSpan.firstChild) {
      editor.appendChild(suggestionSpan.firstChild);
    }

    // Remove empty suggestion span
    suggestionSpan.remove();
    suggestionSpan = null;

    // Move caret to end
    placeCaretAtEnd(editor);
  }

  /******************************
   * PLACE CARET
   ******************************/
  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
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
