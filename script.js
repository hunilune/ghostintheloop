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
    masc: ["Fallback male sentence for testing"],
    fem: ["Fallback female sentence for testing"]
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

  let predictionTimer = null;
  const PREDICTION_DELAY = 2000;

  let rotatingTimer = null;
  let rotatingIndex = 0;
  const firstSentenceSuggestions = ["sad", "lonely", "angry"];
  let rotatingActive = false;

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
        console.warn("Skipped corpus:", url);
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
  }

  loadCorpora();

  /******************************
   * EXTRACT & NORMALIZE
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

  function normalize(arr) {
    return arr
      .map(t => decodeHTMLEntities(t))
      .map(t => t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ""))
      .map(t => t.trim().replace(/\s+/g, " "))
      .filter(t => t.length > 20);
  }

  function decodeHTMLEntities(str) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = str;
    return textarea.value;
  }

  /******************************
   * EMOTION / VOICE
   ******************************/
  function detectEmotion(text) {
    for (const e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  function decideVoice(input) {
    const words = input.split(/\s+/);
    const firstInput = typeCount === 0;
    const emotion = detectEmotion(input);

    if (firstInput && emotion && EMOTIONS[emotion]?.fem > 0.7) return "fem";

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

  /******************************
   * GENERATION
   ******************************/
  function generate(input) {
    if (!ready || !input) return null;

    const voice = decideVoice(input);
    activeVoice = voice;

    const pool = corpora[voice];
    const words = input.split(/\s+/);

    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "),
      voice
    };
  }

  /******************************
   * SHOW PREDICTION
   ******************************/
  function showSuggestion(prediction) {
    if (!editor || !prediction?.text) return;

    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
suggestionSpan.className = "suggestion";
suggestionSpan.contentEditable = "false"; 
editor.appendChild(suggestionSpan);
    }

    suggestionSpan.innerHTML = "";
    setMode(prediction.voice);

    prediction.text.split(/\s+/).forEach((word, i) => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className = "word";
      span.style.opacity = 0;
      span.style.transition = "opacity 0.4s ease";

      if (prediction.voice === "masc") {
        span.style.fontWeight = 600;
        span.style.color = "#000";
      } else {
        span.style.fontWeight = 400;
        span.style.opacity = 0.45;
      }

      suggestionSpan.appendChild(span);
      setTimeout(() => span.style.opacity = 1, i * 120);
    });
  }

  /******************************
   * ACCEPT
   ******************************/
  function acceptSuggestion() {
    if (!suggestionSpan) return;

    const frag = document.createDocumentFragment();
    Array.from(suggestionSpan.children).forEach(n =>
      frag.appendChild(document.createTextNode(n.textContent))
    );

    suggestionSpan.remove();
    suggestionSpan = null;
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
   * ROTATING GHOST
   ******************************/
  function startRotatingSuggestions() {
    if (rotatingActive || !editor) return;
    rotatingActive = true;

    suggestionSpan = document.createElement("span");
suggestionSpan.className = "suggestion";
suggestionSpan.contentEditable = "false"; 
editor.appendChild(suggestionSpan);

    firstSentenceSuggestions.forEach(word => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className = "word";
      span.style.opacity = 0;
      suggestionSpan.appendChild(span);
    });

    function cycle() {
      if (!rotatingActive) return;
      const spans = [...suggestionSpan.children];
      spans.forEach(s => s.style.opacity = 0);
      spans[rotatingIndex].style.opacity = 1;
      rotatingIndex = (rotatingIndex + 1) % spans.length;
      rotatingTimer = setTimeout(cycle, 1000);
    }

    cycle();
  }

  function stopRotatingSuggestions() {
    rotatingActive = false;
    if (rotatingTimer) clearTimeout(rotatingTimer);
    rotatingTimer = null;
  }

  /******************************
   * MODE
   ******************************/
  function setMode(voice) {
    document.body.classList.remove("mode-masc", "mode-fem");
    document.body.classList.add(`mode-${voice}`);
  }

  /******************************
   * INPUT EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    if (predictionTimer) {
      clearTimeout(predictionTimer);
      predictionTimer = null;
    }

    if (suggestionSpan) suggestionSpan.innerHTML = "";

    const text = editor.innerText;

    if (rotatingActive && text !== "I am") stopRotatingSuggestions();

    if (!rotatingActive && text.endsWith(" ") && text.trim().length > 3) {
      predictionTimer = setTimeout(() => {
        const prediction = generate(text.trim());
        showSuggestion(prediction);
      }, PREDICTION_DELAY);
    }
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (predictionTimer) clearTimeout(predictionTimer);
      acceptSuggestion();
    }
  });

  if (editor && editor.innerText.trim() === "I am") {
    startRotatingSuggestions();
  }

});
