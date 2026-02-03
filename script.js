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

  const MASC_KEYWORDS = [
    "he", "him", "man", "male", "boy", "guy", "father", "brother",
    "strong", "brave", "angry", "confident", "competitive",
    "ambitious", "independent", "assertive", "bold", "dominant",
    "tough", "leader", "risk", "courageous", "powerful", "proud",
    "work", "challenged", "adventure", "adventurous", "victorious", "fearless",
    "focused", "strategic", "stoic", "protective",
    "honour", "honor", "strong", "strength", "win", "winner", "boastful", "goal", "responsible", "fighter",
    "decision", "determined", "bravery", "aggressive", "competitive",
    "challenge", "action", "drive", "ambition", "dominance", "dominant", "mastery",
    "endurance", "achievement", "control", "authority", "boldness",
    "fearless", "risk-taking", "adventurous", "leader", "powerful",
    "pride", "resolve", "focus", "courageous", "toughness", "handsome",
    "protector", "defend", "responsibility", "responsible"
  ];
  
  const FEM_KEYWORDS = [
    "she", "her", "woman", "female", "girl", "mother", "sister",
    "sad", "lonely", "lost", "fearful", "worried", "soft", "tender",
    "sensitive", "emotional", "gentle", "nurturing", "caring",
    "shy", "beautiful", "loving", "compassionate", "intuitive",
    "delicate", "vulnerable", "romantic", "affection", "dream",
    "fragile", "sentimental", "cry", "soft-spoken", "fear", "helpless",
    "graceful", "affectionate", "whisper", "happiness", "nurture",
    "empathetic", "sensitive", "cooperative", "emotional", "docile"
  ];

  /* Initiliase */
  
  const editor = document.querySelector("#editor");
  const rotatingEl = document.querySelector("#rotating-suggestion");

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let typeCount = 0;
  let activeVoice = "masc";

  let rotating = false;
  let rotateIndex = 0;
  let rotateTimer = null;
  let predictionTimer = null;

  if (!editor || !rotatingEl) return;

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

  buildNextWordMap(corpora.masc, "masc");
  buildNextWordMap(corpora.fem, "fem");

    ready = true;
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
  }

  loadCorpora();

  /* Word map */

  let nextWordMap = { masc: {}, fem: {} };

function buildNextWordMap(texts, voice) {
  const map = {};

  texts.forEach(sentence => {
    const words = sentence.split(/\s+/);

    for (let i = 0; i < words.length - 1; i++) {
      const key = words[i];               // 1-gram
      const next = words[i + 1];

      if (!map[key]) map[key] = [];
      map[key].push(next);
    }

    for (let i = 0; i < words.length - 2; i++) {
      const key = words[i] + " " + words[i + 1]; // 2-gram
      const next = words[i + 2];

      if (!map[key]) map[key] = [];
      map[key].push(next);
    }
  });

  nextWordMap[voice] = map;
}

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
    const map = nextWordMap[voice];
    const words = cleanText(input).split(/\s+/);
  
    const lastTwo = words.slice(-2).join(" ");
    const lastOne = words.slice(-1)[0];
  
    let candidates =
      map[lastTwo] ||
      map[lastOne] ||
      [];
  
    if (!candidates.length) return "";
  
    // pick 1–3 words
    const result = [];
    let currentKey = lastTwo;
  
    for (let i = 0; i < 3; i++) {
      const options = map[currentKey] || map[lastOne];
      if (!options || !options.length) break;
  
      const next = options[Math.floor(Math.random() * options.length)];
      result.push(next);
  
      currentKey = currentKey.split(" ").slice(-1).concat(next).join(" ");
    }
  
    return result.join(" ");
  }

  function showPrediction(text) {
    removeGhost();
    if (!text) return;
  
    const ghost = document.createElement("span");
    ghost.className = `ghost ${activeVoice}`; // apply masc/fem to the ghost container
    ghost.contentEditable = "false";
  
    text.split(/\s+/).forEach((word, i) => {
      const w = document.createElement("span");
      w.className = `ghost-word ${activeVoice}`; // apply masc/fem per word
      w.textContent = word + " ";
      w.style.animationDelay = `${i * 40}ms`; // stagger animation like before
      ghost.appendChild(w);
    });
  
    editor.appendChild(ghost);
    placeCaretAtEnd(editor);
  }
  

  function acceptPrediction() {
    const ghost = editor.querySelector(".ghost");
    if (!ghost) return;
  
    Array.from(ghost.children).forEach(w => {
      // Make sure it has the expected classes
      w.classList.add("committed");
      w.classList.add("word"); // ← add this!
      // remove ghost-specific animation styles
      w.style.animation = "none";
      w.style.opacity = "";
      w.style.filter = "";
      editor.appendChild(w);
    });
  
    ghost.remove();
    editor.appendChild(document.createTextNode(" "));
    placeCaretAtEnd(editor);
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
    if (rotating || !ready) return;
  
    const text = editor.innerText.replace(/\s+/g, " ").trim();
    if (!text) return;
  
    clearTimeout(predictionTimer);
    predictionTimer = setTimeout(() => {
      const prediction = generatePrediction(text);
      showPrediction(prediction);
    }, PREDICTION_DELAY);
  }
  
  /* Input behaviour */
  
  editor.addEventListener("input", () => {
    const text = editor.innerText.replace(/\s+/g, " ").trim();
  
    if (text === "I am") {
      startRotating();
      return; // ← stop here
    }
  
    stopRotating();
    removeGhost();
    updatePrediction();
  });  

function removeGhost() {
  const ghost = editor.querySelector(".ghost");
  if (ghost) ghost.remove();
}


  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptPrediction();
      updatePrediction();
    }
  });

  if (editor.innerText.trim() === "I am") startRotating();

});
