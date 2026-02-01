document.addEventListener("DOMContentLoaded", async () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
  masc: [
    "https://www.reddit.com/r/AskMen.json",
    "https://www.reddit.com/r/AskMenOver30.json",
    "https://www.reddit.com/r/MensRights.json",
    "https://www.reddit.com/r/PurplePillDebate.json",
    "https://www.reddit.com/r/IncelTear.json"
  ],
  fem: [
    "https://www.reddit.com/r/AskWomen.json",
    "https://www.reddit.com/r/AskFeminists.json",
    "https://www.reddit.com/r/Feminism.json",
    "https://www.reddit.com/r/TwoXChromosomes.json",
    // optional Gutenberg samples can stay on GitHub
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
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn("Skipped corpus", url, err);
    return [];
  }
}

async function loadSide(urls) {
  const results = await Promise.all(
    urls.map(async (url) => {
      const json = await fetchJSON(url);

      // If it's a Reddit JSON object, extract posts
      if (json?.data?.children) {
        return json.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
      }

      // Otherwise, assume it's already an array of text
      if (Array.isArray(json)) return json;

      // fallback empty
      return [];
    })
  );

  // flatten array of arrays and normalize
  return normalize(results.flat());
}

  corpora.masc = await loadSide(CORPUS_URLS.masc);
corpora.fem  = await loadSide(CORPUS_URLS.fem);
  
ready = true;
  console.log("Corpora ready:", {
    masc: corpora.masc.length,
    fem: corpora.fem.length
  });

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
