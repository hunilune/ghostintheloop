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
    masc: ["Fallback male sentence for testing."],
    fem: ["Fallback female sentence for testing."]
  };

  const MAX_OUTPUT_WORDS = 22;
  const PREDICTION_DELAY = 2000;
  const firstSentenceSuggestions = ["sad ", "lonely ", "angry"];

  /******************************
   * STATE
   ******************************/
  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";
  let typeCount = 0;
  let predictionTimer = null;
  let rotatingTimer = null;
  let rotatingIndex = 0;
  let rotatingActive = false;

  const editor = document.querySelector("#editor");
  let suggestionSpan = null;

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
    corpora.fem = await loadSide(CORPUS_URLS.fem);

    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length) corpora.fem = [...FALLBACK.fem];

    ready = true;
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
  }

  loadCorpora();

  function extractText(src) {
    if (Array.isArray(src)) {
      return src.map(i => {
        if (typeof i === "string") return i;
        if (i.title || i.selftext) return `${i.title || ""} ${i.selftext || ""}`;
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
      .map(t => String(t).trim().replace(/\s+/g, " "))
      .filter(t => t.length > 20);
  }

  /******************************
   * VOICE DECISION
   ******************************/
  function decideVoice(input) {
    return activeVoice; // can extend with scoring/emotion logic
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
    return { text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "), voice };
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
      span.textContent = word + " ";
      span.className = "word";
      span.style.opacity = 0;
      span.style.transform = "scale(0.96)";
      span.style.transition = "opacity 0.4s ease, transform 0.4s ease";

      if (prediction.voice === "masc") {
        span.style.fontWeight = 700;
        span.style.color = "rgba(0,0,0,0.7)";
      } else {
        span.style.fontWeight = 300;
        span.style.color = "rgba(0,0,0,0.25)";
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

    const frag = document.createDocumentFragment();
    Array.from(suggestionSpan.children).forEach(node => frag.appendChild(document.createTextNode(node.textContent)));

    suggestionSpan.innerHTML = "";
    editor.appendChild(frag);
    placeCaretAtEnd(editor);
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
    firstSentenceSuggestions.forEach((word, i) => {
      const span = document.createElement("span");
      span.textContent = i < firstSentenceSuggestions.length - 1 ? word + " " : word;
      span.className = "word";
      span.style.opacity = 0;
      span.style.transform = "scale(0.9)";
      span.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      span.style.cursor = "pointer";
      span.addEventListener("click", () => insertRotatingSuggestion(span));
      suggestionSpan.appendChild(span);
    });

    function cycle() {
      if (!rotatingActive) return;
      const spans = Array.from(suggestionSpan.children);
      spans.forEach(s => { s.style.opacity = 0; s.style.transform = "scale(0.9)"; });
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

  function insertRotatingSuggestion(span) {
    stopRotatingSuggestions();
    if (suggestionSpan) suggestionSpan.remove();
    suggestionSpan = null;

    editor.innerText = "I am ";
    placeCaretAtEnd(editor);

    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(span.textContent));
    range.insertNode(frag);
    range.setStartAfter(range.endContainer);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    editor.focus();
    typeCount = 0;
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

  editor.addEventListener("keydown", (e) => {
    if (rotatingActive && !["Enter"].includes(e.key)) stopRotatingSuggestions();

    if (e.key === "Enter") {
      e.preventDefault();
      acceptSuggestion();
      typeCount = 0;
      setMode(activeVoice); // preserve masc/fem styling
    }
  });

  editor.addEventListener("input", () => {
    const text = editor.innerText.replace(/\n/g, "");

    if (rotatingActive && text !== "I am") stopRotatingSuggestions();

    if (!rotatingActive && text.trim().length > 3) {
      // generate prediction on any trailing whitespace (space, tab)
      if (/\s$/.test(text)) {
        if (predictionTimer) clearTimeout(predictionTimer);
        predictionTimer = setTimeout(() => {
          const prediction = generate(text.trim());
          showSuggestion(prediction);
        }, PREDICTION_DELAY);
      }
    }
  });

});
