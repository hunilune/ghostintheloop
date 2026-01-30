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
    masc: ["Fallback male sentence"],
    fem: ["Fallback female sentence"]
  };

  const firstSentenceSuggestions = ["sad", "lonely", "angry"];
  const MAX_OUTPUT_WORDS = 22;
  const PREDICTION_DELAY = 1200;

  /******************************
   * STATE
   ******************************/
  const editor = document.querySelector("#editor");
  const suggestionSpan = editor.querySelector(".suggestion");

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let typeCount = 0;
  let activeVoice = "masc";
  let rotating = false;
  let rotateIndex = 0;
  let rotateTimer = null;
  let predictionTimer = null;

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
        let texts = [];
        if (Array.isArray(json)) {
          texts = json.map(i => typeof i === "string" ? i : (i.title || "") + " " + (i.selftext || "")).filter(Boolean);
        } else if (json?.data?.children) {
          texts = json.data.children.map(c => `${c.data.title || ""} ${c.data.selftext || ""}`).filter(Boolean);
        }
        collected.push(...texts);
      } catch (e) {
        console.warn("Skipped corpus", url, e);
      }
    }
    return collected.length ? collected : [];
  }

  async function loadCorpora() {
    editor.style.visibility = "hidden"; // hide editor until corpora ready
    corpora.masc = await loadSide(CORPUS_URLS.masc);
    corpora.fem  = await loadSide(CORPUS_URLS.fem);
    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length) corpora.fem = [...FALLBACK.fem];
    ready = true;
    editor.style.visibility = "visible"; // show editor now
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
  }
  loadCorpora();

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
    suggestionSpan.textContent = firstSentenceSuggestions[rotateIndex] + " ";
    rotateIndex = (rotateIndex + 1) % firstSentenceSuggestions.length;
    rotateTimer = setTimeout(cycleRotate, 900);
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
   * PREDICTION
   ******************************/
  function generatePrediction(input) {
    if (!ready || !input) return "";

    const voice = activeVoice;
    const pool = corpora[voice];
    const words = input.split(/\s+/);
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ") + " ";
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
   * INPUT EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    const text = editor.innerText;

    if (!ready) return; // ignore input until corpora ready

    if (text === "I am ") startRotating();
    else stopRotating();

    if (text.endsWith(" ") && text.trim().length > 3) {
      clearTimeout(predictionTimer);
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

  if (editor.innerText.trim() === "I am") startRotating();
});
