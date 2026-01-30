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
    if (!corpora.fem.length)  corpora.fem = [...FALLBACK.fem];

    ready = true;
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
  }

  loadCorpora();

  /******************************
   * EXTRACT TEXT
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) {
      return src.map(item => {
        if (typeof item === "string") return item;
        if (item.title || item.selftext) return `${item.title || ""} ${item.selftext || ""}`;
        return "";
      }).filter(Boolean);
    }
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }
    return [];
  }

  /******************************
   * NORMALIZE TEXT
   ******************************/
  function normalize(arr) {
    const corrections = { teir: "their", recieve: "receive", definately: "definitely" };
    return arr
      .map(t => decodeHTMLEntities(t))
      .map(t => t.replace(/&[a-z]+;/gi, m => (m === "&amp;" ? "&" : "")))
      .map(t => t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ""))
      .map(t => String(t).trim().replace(/\s+/g, " "))
      .map(t => {
        Object.keys(corrections).forEach(key => {
          const re = new RegExp(`\\b${key}\\b`, "gi");
          t = t.replace(re, corrections[key]);
        });
        return t;
      })
      .filter(t => t.length > 20);
  }

  function decodeHTMLEntities(str) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = str;
    return textarea.value;
  }

  /******************************
   * EMOTION DETECTION
   ******************************/
  function detectEmotion(text) {
    for (const e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  /******************************
   * VOICE DECISION
   ******************************/
  function decideVoice(input) {
    const words = input.split(/\s+/);
    const firstInput = typeCount === 0;
    const emotion = detectEmotion(input);

    if (firstInput && emotion && EMOTIONS[emotion]?.fem > 0.7) return "fem";

    function score(corpus) {
      return corpus.reduce((sum, line) => sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0.1), 0), 0);
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
    const words = input.split(/\s+/);
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const out = chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ");
    return { text: out, voice };
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
    setMode(prediction.voice);
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.textContent = word.toLowerCase() + " ";
      span.className = "word";
      if (prediction.voice === "masc") {
        span.style.fontWeight = 600;
        span.style.transform = `scale(${1 + typeCount * 0.02 + 0.05})`;
      } else {
        span.style.fontWeight = 500;
        span.style.transform = `scale(${Math.max(0.85, 1 - typeCount * 0.02)})`;
      }
      span.style.fontFamily = "Office Times, serif";
      span.style.opacity = 0;
      span.style.transition = "opacity 0.4s ease, transform 0.4s ease, color 0.4s ease";
      suggestionSpan.appendChild(span);
      setTimeout(() => {
        span.style.opacity = 1;
        span.style.transform = "scale(1)";
      }, i * 120);
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
   * MODE STYLING
   ******************************/
  function setMode(voice) {
    document.body.classList.remove("mode-masc", "mode-fem");
    document.body.classList.add(`mode-${voice}`);
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
