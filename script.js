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
  const WORD_FADE_STEP = 0.03;
  const WORD_BOLD_STEP = 0.03;

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
  let inputCount = 0;

  const editor = document.querySelector("#editor");
  let suggestionSpan = null;

  async function loadSide(side) {
    const collected = [];
    for (const url of CORPUS_URLS[side]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        collected.push(...extractText(json));
      } catch {}
    }
    return normalize(collected);
  }

  async function loadCorpora() {
    corpora.masc = await loadSide("masc");
    corpora.fem  = await loadSide("fem");

    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length)  corpora.fem  = [...FALLBACK.fem];

    ready = true;
  }

  loadCorpora();

  function extractText(src) {
    if (Array.isArray(src)) return src;
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }
    return [];
  }

  function normalize(arr) {
    return arr.map(t => String(t).toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim())
              .filter(t => t.length > 20);
  }

  function detectEmotion(text) {
    for (const e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

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
    if (total === 0) return activeVoice;

    return Math.random() < mScore / total ? "masc" : "fem";
  }

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
    return { text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "), voice };
  }

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
        const scale = 1 + inputCount * WORD_BOLD_STEP;
        span.classList.add("boost", "masc");
        span.style.transform = `scale(${scale})`;
        span.style.fontWeight = `${Math.min(900, 600 + inputCount * 20)}`;
        span.style.color = "#3b6cff";
      } else if (prediction.voice === "masc" && activeVoice === "fem") {
        const scale = Math.max(0.6, 1 - inputCount * WORD_FADE_STEP);
        span.classList.add("cross", "masc");
        span.style.transform = `scale(${scale})`;
        span.style.opacity = `${scale}`;
        span.style.color = "#3b6cff";
      } else {
        span.classList.add("aligned", prediction.voice);
        span.style.color = prediction.voice === "masc" ? "#3b6cff" : "#d44b8c";
      }

      suggestionSpan.appendChild(span);
    });
  }

  function acceptSuggestion() {
    if (!suggestionSpan) return;

    // Only insert the **suggestion spans**, not previous editor content
    const fragments = document.createDocumentFragment();
    suggestionSpan.childNodes.forEach(node => {
      fragments.appendChild(node.cloneNode(true));
    });
    editor.appendChild(fragments);

    suggestionSpan.remove();
    suggestionSpan = null;
    placeCaretAtEnd(editor);
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
