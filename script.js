document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/AskMenOver30.json",
      "https://hunilune.github.io/ghostintheloop/MensRights.json",
      "https://hunilune.github.io/ghostintheloop/PurplePillDebate.json",
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/AskFeminists.json",
      "https://hunilune.github.io/ghostintheloop/Feminism.json",
      "https://hunilune.github.io/ghostintheloop/TwoXChromosomes.json",
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
  let typeCount = 0;

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
      } catch (err) { console.warn("Skipped corpus:", url); }
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

  /******************************
   * EXTRACT & NORMALIZE
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src.map(item => {
      if (typeof item === "string") return item;
      if (item.title || item.selftext) return `${item.title || ""} ${item.selftext || ""}`;
      return "";
    }).filter(Boolean);

    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }

    return [];
  }

  function normalize(arr) {
    return arr.map(t => String(t).trim().replace(/\s+/g, " ")).filter(t => t.length > 20);
  }

  /******************************
   * VOICE DECISION & GENERATION
   ******************************/
  function decideVoice(input) {
    const words = input.split(/\s+/);
    function score(corpus) {
      return corpus.reduce(
        (sum, line) => sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0.1), 0),
        0
      );
    }
    const mScore = score(corpora.masc);
    const fScore = score(corpora.fem);
    if (mScore > fScore) return "masc";
    if (fScore > mScore) return "fem";
    return activeVoice;
  }

  function generate(input) {
    if (!ready || !input) return { text: "", voice: activeVoice };
    const voice = decideVoice(input);
    activeVoice = voice;

    const pool = corpora[voice];
    const isFallback = pool === FALLBACK[voice];

    const emotion = input.split(/\s+/).find(w => EMOTIONS[w]);
    let allow = 1.0;
    if (!isFallback && emotion) allow = EMOTIONS[emotion][voice] ?? 0.5;
    if (!isFallback && Math.random() > allow) return { text: "", voice };

    const words = input.split(/\s+/);
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { text: chosen, voice };
  }

  /******************************
   * SHOW PREDICTION
   ******************************/
  
  function showSuggestion(prediction) {
  if (!editor) return;

  if (!suggestionSpan) {
    suggestionSpan = document.createElement("span");
    suggestionSpan.className = "suggestion";
    editor.appendChild(suggestionSpan);
  }

  suggestionSpan.innerHTML = "";

  const words = prediction.text.split(/\s+/);

  words.forEach((word, i) => {
    const span = document.createElement("span");
    span.textContent = word.toLowerCase() + " ";
    span.className = "word";

    // Male/female color and scale
    if (prediction.voice === "masc") {
      span.style.color = "#3b6cff";
      span.style.fontWeight = 600;
      span.style.transform = `scale(${1 + typeCount * 0.02 + 0.05})`;
    } else {
      span.style.color = "#d44b8c";
      span.style.fontWeight = 500;
      span.style.transform = `scale(${Math.max(0.85, 1 - typeCount * 0.02)})`;
    }

    // Match paragraph styling
    span.style.fontFamily = "Social, sans-serif";
    span.style.fontSize = "1rem";
    span.style.lineHeight = "1.4";

    // Append to suggestion container
    suggestionSpan.appendChild(span);

    // Fade-in sequentially
    setTimeout(() => {
      span.style.opacity = "1";
      span.style.transform = "scale(1)";
    }, i * 100); // 100ms per word
  });
}

  /******************************
   * ACCEPT SUGGESTION
   ******************************/
  function acceptSuggestion() {
    if (!suggestionSpan) return;

    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const frag = document.createDocumentFragment();
    Array.from(suggestionSpan.childNodes).forEach(node => frag.appendChild(node.cloneNode(true)));
    range.insertNode(frag);

    suggestionSpan.remove();
    suggestionSpan = null;
    typeCount++;
    editor.focus();
  }

  editor.addEventListener("input", () => {
    const text = editor.innerText.trim().toLowerCase();
    showSuggestion(generate(text));
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptSuggestion();
    }
  });

});
