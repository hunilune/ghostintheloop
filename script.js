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

  // Delayed prediction
  let predictionTimer = null;
  const PREDICTION_DELAY = 2000;

  // Rotating ghost suggestions
  let rotatingTimer = null;
  let rotatingIndex = 0;
  const firstSentenceSuggestions = ["sad ", "lonely ", "wondering"];
  let rotatingActive = false;

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
        collected.push(...extractText(json));
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
   * EXTRACT & NORMALIZE TEXT
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
   * GENERATE PREDICTION
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
    setMode(prediction.voice);

    prediction.text.split(/\s+/).forEach((word, i) => {
      const span = document.createElement("span");
      // lowercase for corpus predictions
      span.textContent = word.toLowerCase() + " "; 
      span.style.fontFamily = "Office Times, serif";
      span.style.lineHeight = "1.4";
      span.style.opacity = 0;
      span.style.transition = "opacity 0.4s ease, transform 0.4s ease, color 0.4s ease";

      if (prediction.voice === "masc") {
        span.style.fontWeight = 700;
        span.style.color = "rgba(0,0,0,0.7)";
        span.style.transform = "scale(1.1)";
      } else {
        span.style.fontWeight = 300;
        span.style.color = "rgba(0,0,0,0.25)";
        span.style.transform = "scale(0.9)";
      }

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
    Array.from(suggestionSpan.childNodes).forEach(node => {
      frag.appendChild(document.createTextNode(node.textContent));
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
   * ROTATING GHOST SUGGESTIONS
   ******************************/
  function startRotatingSuggestions() {
    if (!editor || rotatingActive) return;
    rotatingActive = true;

    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
      suggestionSpan.className = "suggestion";
      editor.appendChild(suggestionSpan);
    }

    suggestionSpan.innerHTML = "";
    firstSentenceSuggestions.forEach(word => {
      const span = document.createElement("span");
      span.textContent = word; 
      span.style.opacity = 0;
      span.style.fontWeight = 500;
      span.style.fontFamily = "Office Times, serif";
      span.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      span.style.cursor = "pointer";

      // Click to start typing
      span.addEventListener("click", () => insertRotatingSuggestion(span));

      suggestionSpan.appendChild(span);
    });

    function cycle() {
      if (!rotatingActive) return;
      const spans = Array.from(suggestionSpan.children);
      spans.forEach(s => s.style.opacity = 0);
      spans[rotatingIndex].style.opacity = 1;
      spans[rotatingIndex].style.transform = "scale(1.05)";
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
   * INSERT CLICKED ROTATING SUGGESTION
   ******************************/
  function insertRotatingSuggestion(span) {
    stopRotatingSuggestions();
    if (suggestionSpan) suggestionSpan.remove();
    suggestionSpan = null;

    // Reset "I am " placeholder
    editor.innerText = "I am ";
    placeCaretAtEnd(editor);

    // Insert clicked word after "I am "
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(span.textContent));
    range.insertNode(frag);

    // Move cursor after inserted word
    range.setStartAfter(range.endContainer);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    editor.focus();
    typeCount = 0; // start first word
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
  if (editor && editor.innerText.trim() === "I am") startRotatingSuggestions();

  editor.addEventListener("focus", () => stopRotatingSuggestions());

  editor.addEventListener("input", () => {
    const text = editor.innerText.trim();
    if (rotatingActive && text !== "I am") stopRotatingSuggestions();

    if (!rotatingActive && text) {
      if (predictionTimer) clearTimeout(predictionTimer);
      predictionTimer = setTimeout(() => {
        const prediction = generate(text);
        showSuggestion(prediction);
      }, PREDICTION_DELAY);
    }
  });

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (rotatingActive && suggestionSpan) {
        const visibleSpan = Array.from(suggestionSpan.children)
          .find(s => parseFloat(s.style.opacity) > 0);
        if (visibleSpan) insertRotatingSuggestion(visibleSpan);
      } else {
        if (predictionTimer) clearTimeout(predictionTimer);
        acceptSuggestion();
      }
    }
  });

});
