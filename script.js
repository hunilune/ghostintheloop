document.addEventListener("DOMContentLoaded", () => {

  /* Corpus URLs */
  
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

  const MASC_KEYWORDS = ["he", "him", "man", "male", "boy", "father", "brother"];
  const FEM_KEYWORDS  = ["sad", "her", "woman", "female", "girl", "mother", "sister"];

  /* Initiliase */
  
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

  /* Load corpora */
  
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

  /* Extract */
  
  function extractText(src) {
    if (Array.isArray(src)) return src;
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }
    return [];
  }

  /* Normalise */

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

  /* Rotating suggestions */
  
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
editor.innerText = "I am ";
editor.append(" ", word);
    placeCaretAtEnd(editor);
    typeCount = 1;
    updatePrediction();
  }

  /* Prediction */
  
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

  function generatePrediction(input) {
    if (!ready || !input) return "";

    updateActiveVoice(input);

    const voice = activeVoice;
    const pool = corpora[voice];
    const words = cleanText(input).split(/\s+/);

    let candidates = pool.filter(t => words.some(w => cleanText(t).includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

return cleanText(chosen)
  .split(/\s+/)
  .slice(0, MAX_OUTPUT_WORDS)
  .join(" ");
  }

  function showPrediction(text) {
    predictionEl.innerHTML = "";
    if (!text) return;

    text.split(/\s+/).forEach((word, i) => {
    const span = document.createElement("span");
    span.textContent = word + " ";
    span.className = `word ${activeVoice}`;
    span.style.animationDelay = `${i * 60}ms`;
    predictionEl.appendChild(span);
  });
}

function acceptPrediction() {
  const needsSpace = !editor.innerText.endsWith(" ");

  if (needsSpace) {
    editor.append(" ");
  }

  const frag = document.createDocumentFragment();
  Array.from(predictionEl.children).forEach(node => {
    frag.appendChild(document.createTextNode(node.textContent.trim()));
  });

  editor.appendChild(frag);
  predictionEl.innerHTML = "";
  placeCaretAtEnd(editor);
  typeCount++;
}

  /* Caret */
  function placeCaretAtEnd(el) {
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.addRange(range);
  }

  /* Updating the prediction */
  
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

  /* Input behaviour */
  
 editor.addEventListener("input", () => {
  predictionEl.innerHTML = ""; // ← add this line

  const text = editor.innerText;
if (text.trim() === "I am") startRotating();
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
