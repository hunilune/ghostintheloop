document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/AskMenOver30.json",
      "https://hunilune.github.io/ghostintheloop/MensRights.json",
      "https://hunilune.github.io/ghostintheloop/PurplePillDebate.json"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/AskFeminists.json",
      "https://hunilune.github.io/ghostintheloop/Feminism.json",
      "https://hunilune.github.io/ghostintheloop/TwoXChromosomes.json"
    ]
  };

  const FALLBACK = {
    masc: ["fallback male sentence"],
    fem: ["fallback female sentence"]
  };

  const firstSentenceSuggestions = ["sad", "lonely", "angry"];
  const MAX_OUTPUT_WORDS = 22;
  const PREDICTION_DELAY = 1000;

  const EMOTIONS = {
    sad:     { fem: 1.0, masc: 0.25 },
    lonely:  { fem: 0.9, masc: 0.3 },
    anxious: { fem: 0.8, masc: 0.4 },
    angry:   { fem: 0.4, masc: 1.0 },
    tired:   { fem: 0.6, masc: 0.6 }
  };

  const MASC_KEYWORDS = ["he", "him", "man", "male", "boy", "father", "brother"];
  const FEM_KEYWORDS  = ["she", "her", "woman", "female", "girl", "mother", "sister"];

  /******************************
   * STATE
   ******************************/
  const editor = document.querySelector("#editor");
  const rotatingEl = document.querySelector("#rotating-suggestion");
  const predictionEl = document.querySelector("#prediction-suggestion");

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let typeCount = 0;
  let activeVoice = "masc";

  let rotating = false;
  let rotateIndex = 0;
  let rotateTimer = null;
  let predictionTimer = null;

  if (!editor || !rotatingEl || !predictionEl) return;

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadSide(urls) {
    const collected = [];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const texts = extractText(json);
        collected.push(...texts);
      } catch (e) {
        console.warn("Skipped corpus", url, e);
      }
    }
    return normalize(collected);
  }

  async function loadCorpora() {
    corpora.masc = await loadSide(CORPUS_URLS.masc);
    corpora.fem  = await loadSide(CORPUS_URLS.fem);

    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length)  corpora.fem  = [...FALLBACK.fem];

    ready = true;
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
  }

  loadCorpora();

  /******************************
   * EXTRACT & NORMALIZE
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src;
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }
    return [];
  }

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
   * ROTATING SUGGESTIONS
   ******************************/
  function startRotating() {
    if (rotating) return;
    rotating = true;
    rotateIndex = 0;
    cycleRotate();
  }

  function cycleRotate() {
    if (!rotating) return;
    rotatingEl.textContent = firstSentenceSuggestions[rotateIndex] + " ";
    rotateIndex = (rotateIndex + 1) % firstSentenceSuggestions.length;
    rotateTimer = setTimeout(cycleRotate, 900);
  }

  function stopRotating() {
    rotating = false;
    clearTimeout(rotateTimer);
    rotatingEl.textContent = "";
  }

  function insertRotatingSuggestion(word) {
    stopRotating();
    editor.innerText = "I am " + word + " ";
    placeCaretAtEnd(editor);
    typeCount = 1;
    updatePrediction();
  }

  /******************************
   * PREDICTION
   ******************************/
  function cleanText(text) {
    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
      .replace(/&[a-z]+;/gi, "")
      .toLowerCase()
      .trim();
  }

  function updateActiveVoice(text) {
    const words = cleanText(text).split(/\s+/);
    for (let w of words.slice(-3)) {
      if (MASC_KEYWORDS.includes(w)) { activeVoice = "masc"; return; }
      if (FEM_KEYWORDS.includes(w))  { activeVoice = "fem";  return; }
    }
  }

  function detectEmotion(text) {
    for (const e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  function generatePrediction(input) {
    if (!ready || !input) return "";

    updateActiveVoice(input);

    const voice = activeVoice;
    const pool = corpora[voice];
    const words = cleanText(input).split(/\s+/);

    let candidates = pool.filter(t => words.some(w => cleanText(t).includes(w)));
    if (!candidates.length) candidates = pool;

    const emotion = detectEmotion(input);
    if (emotion) {
      const allow = EMOTIONS[emotion]?.[voice] ?? 0.5;
      if (Math.random() > allow) return "";
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return cleanText(chosen).split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ") + " ";
  }

  function showPrediction(text) {
    predictionEl.innerHTML = "";
    if (!text) return;
    text.split(/\s+/).forEach(word => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className = "word";
      predictionEl.appendChild(span);
    });
  }

  function acceptPrediction() {
    const frag = document.createDocumentFragment();
    Array.from(predictionEl.children).forEach(node => frag.appendChild(document.createTextNode(node.textContent)));
    predictionEl.innerHTML = "";
    editor.appendChild(frag);
    placeCaretAtEnd(editor);
    typeCount++;
  }

  /******************************
   * CARET
   ******************************/
  function placeCaretAtEnd(el) {
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.addRange(range);
  }

  /******************************
   * UPDATE PREDICTION
   ******************************/
  function updatePrediction() {
    const text = editor.innerText;
    if (!rotating && text.trim().length > 0) {
      clearTimeout(predictionTimer);
      predictionTimer = setTimeout(() => {
        const prediction = generatePrediction(text.trim());
        showPrediction(prediction);
      }, PREDICTION_DELAY);
    }
  }

  /******************************
   * INPUT EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    const text = editor.innerText;
    if (text === "I am ") startRotating();
    else stopRotating();
    updatePrediction();
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptPrediction();
      updatePrediction();
    }
  });

  if (editor.innerText.trim() === "I am") startRotating();

});
