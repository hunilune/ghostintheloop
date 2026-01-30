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
        if (!res.ok) {
          console.warn("Failed to fetch:", url);
          continue;
        }
        const json = await res.json();
        const extracted = extractText(json);
        collected.push(...extracted);
      } catch (err) {
        console.warn("Skipped corpus due to error:", url, err);
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
    // If it's already an array
    if (Array.isArray(src)) {
      return src.map(item => {
        if (typeof item === "string") return item;
        if (item.title || item.selftext) return `${item.title || ""} ${item.selftext || ""}`;
        return "";
      }).filter(Boolean);
    }

    // Reddit-style
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
      .map(t => String(t).trim().replace(/\s+/g, " "))
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
          sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0.1), 0),
        0
      );
    }

    const mScore = score(corpora.masc);
    const fScore = score(corpora.fem);

    if (mScore > fScore) return "masc";
    if (fScore > mScore) return "fem";
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
   ******************************/function showSuggestion(prediction) {
  if (!editor) return;

  // Create suggestion container if it doesn't exist
  if (!suggestionSpan) {
    suggestionSpan = document.createElement("span");
    suggestionSpan.className = "suggestion";
    editor.appendChild(suggestionSpan);
  }

  // Clear previous suggestion
  suggestionSpan.innerHTML = "";

  // Split into words for dynamic effects
  const words = prediction.text.split(/\s+/).map((word, i) => {
    const span = document.createElement("span");
    span.textContent = word.toLowerCase() + " "; // lowercase
    span.className = "word";

    // Dynamic scaling and color by voice
    if (prediction.voice === "masc") {
      span.style.color = "#3b6cff";
      const scale = 1 + typeCount * 0.02 + 0.05; // slightly bigger
      span.style.transform = `scale(${scale})`;
      span.style.fontWeight = `${600 + typeCount * 5}`;
    } else {
      span.style.color = "#d44b8c";
      const scale = Math.max(0.85, 1 - typeCount * 0.02); // slightly smaller
      span.style.transform = `scale(${scale})`;
      span.style.fontWeight = "500";
    }

    // Match editor font and line-height
    span.style.fontFamily = "inherit";
    span.style.fontSize = "inherit";
    span.style.lineHeight = "inherit";

    // Add blur-in / fade-in effect
    span.style.opacity = "0";
    span.style.transition = "opacity 0.4s ease, transform 0.4s ease";
    setTimeout(() => span.classList.add("visible"), 10);

    return span;
  });

  // Append all words to the suggestion container
  words.forEach(w => suggestionSpan.appendChild(w));
}

/******************************
 * HTML ENTITY DECODER
 ******************************/
function decodeHTMLEntities(str) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
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
    Array.from(suggestionSpan.childNodes).forEach(node => {
      frag.appendChild(node.cloneNode(true));
    });

    range.insertNode(frag);
    suggestionSpan.remove();
    suggestionSpan = null;

    typeCount++;
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
