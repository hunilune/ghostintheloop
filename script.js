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

  const FALLBACK = { masc: ["Fallback male sentence"], fem: ["Fallback female sentence"] };
  const MAX_OUTPUT_WORDS = 22;
  const firstSentenceSuggestions = ["sad", "lonely", "angry"];
  const PREDICTION_DELAY = 1200;

  /******************************
   * STATE
   ******************************/
  const editor = document.querySelector("#editor");
  const suggestionSpan = editor.querySelector(".suggestion");

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";
  let typeCount = 0;
  let rotateTimer = null;
  let rotateIndex = 0;
  let rotating = false;
  let predictionTimer = null;

  if (!editor || !suggestionSpan) return;

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
        collected.push(...extractText(json));
      } catch (err) {
        console.warn("Skipped corpus:", url, err);
      }
    }
    return collected.length ? normalize(collected) : [];
  }

  async function loadCorpora() {
    corpora.masc = await loadSide(CORPUS_URLS.masc);
    corpora.fem  = await loadSide(CORPUS_URLS.fem);
    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length) corpora.fem = [...FALLBACK.fem];
    ready = true;
  }

  function extractText(src) {
    if (Array.isArray(src)) {
      return src.map(item => (typeof item === "string" ? item : `${item.title || ""} ${item.selftext || ""}`)).filter(Boolean);
    }
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`);
    }
    return [];
  }

  function normalize(arr) {
    return arr.map(t => String(t).trim().replace(/\s+/g, " ")).filter(t => t.length > 20);
  }

  loadCorpora();

  /******************************
   * ROTATING SUGGESTIONS
   ******************************/
  function startRotating() {
    if (rotating) return;
    rotating = true;
    rotateIndex = 0;

    function cycle() {
      if (!rotating) return;
      suggestionSpan.textContent = firstSentenceSuggestions[rotateIndex] + " ";
      suggestionSpan.style.opacity = 0.25;
      suggestionSpan.style.fontWeight = 300;
      rotateIndex = (rotateIndex + 1) % firstSentenceSuggestions.length;
      rotateTimer = setTimeout(cycle, 900);
    }

    cycle();
  }

  function stopRotating() {
    rotating = false;
    clearTimeout(rotateTimer);
    suggestionSpan.textContent = "";
  }

  function insertRotatingSuggestion(word) {
    stopRotating();
    editor.innerText = "I am " + word + " ";
    placeCaretAtEnd(editor);
    typeCount = 1;
  }

  /******************************
   * PREDICTIVE TEXT
   ******************************/
  function generatePrediction(input) {
    if (!ready || !input || input.length < 4) return "";

    const words = input.split(/\s+/);
    const pool = corpora[activeVoice];
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ");
  }

  function showPrediction(text) {
    suggestionSpan.textContent = "";
    if (!text) return;

    text.split(/\s+/).forEach(word => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className = "word";
      suggestionSpan.appendChild(span);
    });

    // Styling based on voice
    if (activeVoice === "masc") {
      document.body.classList.add("mode-masc");
      document.body.classList.remove("mode-fem");
    } else {
      document.body.classList.add("mode-fem");
      document.body.classList.remove("mode-masc");
    }
  }

  function acceptPrediction() {
    if (!suggestionSpan) return;
    const frag = document.createDocumentFragment();
    Array.from(suggestionSpan.children).forEach(node => frag.appendChild(document.createTextNode(node.textContent)));
    suggestionSpan.textContent = "";
    editor.appendChild(frag);
    placeCaretAtEnd(editor);
    typeCount++;
  }

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
   * INPUT EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    const text = editor.innerText.trim();

    // Start rotating only for first "I am"
    if (text === "I am") {
      startRotating();
      return;
    }

    stopRotating();

    clearTimeout(predictionTimer);
    if (text.endsWith(" ") && text.trim().length > 3) {
      predictionTimer = setTimeout(() => {
        const prediction = generatePrediction(text.trim());
        showPrediction(prediction);
      }, PREDICTION_DELAY);
    }
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptPrediction();
    }
  });

  // Start rotation if editor already has "I am"
  if (editor.innerText.trim() === "I am") {
    startRotating();
  }

});
