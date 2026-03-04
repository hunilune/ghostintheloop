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
    masc: ["Try again."],
    fem: ["Are you sure?"]
  };

  const MAX_OUTPUT_WORDS = 22;
  const PREDICTION_DELAY = 1000;

  const MASC_KEYWORDS = [
    "he", "him", "man", "male", "boy", "guy", "father", "brother",
    "strong", "brave", "angry", "confident", "competitive",
    "ambitious", "independent", "assertive", "bold", "dominant",
    "tough", "leader", "risk", "courageous", "powerful", "proud",
    "work", "challenged", "adventure", "adventurous", "victorious", "fearless",
    "focused", "strategic", "stoic", "protective", "rage", "cold",
    "honour", "honor", "strength", "win", "winner", "boastful", "goal", "responsible", "fighter",
    "decision", "determined", "bravery", "aggressive",
    "challenge", "action", "drive", "ambition", "dominance", "mastery",
    "endurance", "achievement", "control", "authority", "boldness",
    "risk-taking", "pride", "resolve", "focus", "toughness", "handsome",
    "protector", "defend", "responsibility"
  ];
  
  const FEM_KEYWORDS = [
    "she", "her", "woman", "female", "girl", "mother", "sister",
    "sad", "lonely", "lost", "fearful", "worried", "soft", "tender",
    "sensitive", "emotional", "gentle", "nurturing", "caring",
    "shy", "beautiful", "loving", "compassionate", "intuitive",
    "delicate", "vulnerable", "romantic", "affection", "dream", "odd",
    "fragile", "sentimental", "cry", "soft-spoken", "fear", "helpless",
    "graceful", "affectionate", "whisper", "happiness", "nurture",
    "empathetic", "cooperative", "docile"
  ];

  /* Initialize */
  
  const editor = document.querySelector("#editor");

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";
  let predictionTimer = null;
  
  let fatigueLevel = 0;
  let femFatigue = 0;

  function increaseFatigue() {
    fatigueLevel = Math.min(fatigueLevel + 0.4, 5);
    femFatigue = Math.min(femFatigue + 0.4, 5); 
    document.documentElement.style.setProperty('--fatigue', fatigueLevel);
    document.documentElement.style.setProperty('--fem-fatigue', femFatigue);
  }

  if (!editor) return;

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
        const key = words[i];
        const next = words[i + 1];

        if (!map[key]) map[key] = [];
        map[key].push(next);
      }

      for (let i = 0; i < words.length - 2; i++) {
        const key = words[i] + " " + words[i + 1];
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

  function showPrediction(text) {
  removeGhost();
  if (!text) return;

  const ghost = document.createElement("span");
  ghost.className = `ghost ${activeVoice}`; 
  ghost.contentEditable = "false";

  // Add intensity class for masculine
  if (activeVoice === 'masc') {
    ghost.classList.add('intense');
  }

  text.split(/\s+/).forEach((word, i) => {
    const w = document.createElement("span");
    w.className = `ghost-word ${activeVoice}`; 
    w.textContent = word + " ";
    w.style.setProperty('--i', i); 
    ghost.appendChild(w);
  });

  editor.appendChild(ghost);
  placeCaretAtEnd(editor);
}
  
  /* Prediction */
  
  function cleanText(text) {
    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
      .replace(/&[a-z]+;/gi, "")
      .replace(/\n/g, " ")
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
    const words = cleanText(input).split(/\s+/).filter(w => w.length > 0);
  
    if (words.length === 0) return "";
  
    const lastTwo = words.slice(-2).join(" ");
    const lastOne = words.slice(-1)[0];
  
    let candidates =
      map[lastTwo] ||
      map[lastOne] ||
      [];
  
    if (!candidates.length) return "";
  
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

  function removeGhost() {
    const ghost = editor.querySelector(".ghost");
    if (ghost) ghost.remove();
  }

  function showPrediction(text) {
    removeGhost();
    if (!text) return;

    const ghost = document.createElement("span");
    ghost.className = `ghost ${activeVoice}`; 
    ghost.contentEditable = "false";

    text.split(/\s+/).forEach((word, i) => {
      const w = document.createElement("span");
      w.className = `ghost-word ${activeVoice}`; 
      w.textContent = word + " ";
      w.style.setProperty('--i', i); 
      ghost.appendChild(w);
    });

    editor.appendChild(ghost);
    placeCaretAtEnd(editor);
  }
function acceptPrediction() {
    const ghost = editor.querySelector(".ghost");
    if (!ghost) return;

    increaseFatigue();

    const isFemPrediction = ghost.classList.contains('fem');

    Array.from(ghost.children).forEach((w, i, arr) => {
        const isFem = w.classList.contains('fem');
        const isMasc = w.classList.contains('masc');

        w.classList.add("committed", "word");
        if (isFem) w.classList.add('fem');
        if (isMasc) w.classList.add('masc');

        w.style.animation = "none";
        editor.appendChild(w);
    });

    ghost.remove();

    // Add uncertainty punctuation after feminine predictions
    if (isFemPrediction) {
        const punct = document.createElement("span");
        punct.className = "word committed fem uncertainty";
        punct.textContent = Math.random() > 0.5 ? "?" : ",";
        editor.appendChild(punct);
    }

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
    if (!ready) return;
  
    const text = editor.innerText.replace(/\s+/g, " ").trim();
    if (!text) return;
  
    clearTimeout(predictionTimer);
    predictionTimer = setTimeout(() => {
      const prediction = generatePrediction(text);
      showPrediction(prediction);
    }, PREDICTION_DELAY);
  }
  
  /* Input behaviour */
  
  let firstInput = true;

  editor.addEventListener("input", () => {
    // Remove blinking cursor on first input
    if (firstInput) {
      const cursorSpan = editor.querySelector('.cursor-blink');
      if (cursorSpan) cursorSpan.remove();
      firstInput = false;
    }
    
    removeGhost();
    updatePrediction();
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptPrediction();
      updatePrediction();
    }
  });

});
