document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
  masc: [
    "AskMen.json",
    "AskMenOver30.json",
    "MensRights.json",
    "PurplePillDebate.json",
    "IncelTear.json"
  ],
  fem: [
    "AskWomen.json",
    "AskFeminists.json",
    "Feminism.json",
    "TwoXChromosomes.json",
    "gutenberg_fem_sample.json"
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
  const FEM_KEYWORDS  = ["sad", "lonely", "depressed", "scared", "girl", "mother", "sister"];

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
/******************************
 * LOAD CORPORA FROM GITHUB API
 ******************************/
const BASE_API_URL = "https://api.github.com/repos/hunilune/ghostintheloop/contents/";

async function fetchJSONFromGitHub(file) {
  try {
    const res = await fetch(BASE_API_URL + file);
    if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);

    const apiData = await res.json();

    // content is Base64 encoded, decode it
    if (!apiData.content) throw new Error(`No content for ${file}`);
    const decoded = atob(apiData.content.replace(/\n/g, ""));
    return JSON.parse(decoded);  // return actual JSON object
  } catch (err) {
    console.warn("Skipped corpus", file, err);
    return []; // return empty array on failure to avoid breaking
  }
}

async function loadSide(files) {
  // fetch all files in parallel
  const results = await Promise.all(
    files.map(async (file) => {
      const json = await fetchJSONFromGitHub(file);
      return extractText(json);  // use your existing extractText function
    })
  );

  // flatten array of arrays and normalize
  return normalize(results.flat());
}

async function loadCorpora() {
  corpora.masc = await loadSide(CORPUS_URLS.masc);
  corpora.fem  = await loadSide(CORPUS_URLS.fem);

  // fallback if empty
  if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
  if (!corpora.fem.length)  corpora.fem  = [...FALLBACK.fem];

  ready = true;
  console.log("Corpora ready:", {
    masc: corpora.masc.length,
    fem: corpora.fem.length
  });
}

// start loading corpora
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
editor.innerText = "I am ";
editor.append(" ", word);
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
  const frag = document.createDocumentFragment();

  Array.from(predictionEl.children).forEach(node => {
    // clone the word span
    const clone = node.cloneNode(true);

    // mark as committed
    clone.classList.add("committed");

    // remove animation and reset opacity/filter
    clone.style.animation = "none";
    clone.style.opacity = "";
    clone.style.filter = "";

    frag.appendChild(clone);
  });

  predictionEl.innerHTML = "";
  editor.appendChild(frag);

  // insert a space after the prediction
  editor.appendChild(document.createTextNode(" "));

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
