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
  const PREDICTION_DELAY = 1200;
  const MAX_OUTPUT_WORDS = 22;

  /******************************
   * STATE
   ******************************/
  const editor = document.querySelector("#editor");
  const ghost = document.querySelector("#ghost");
  const ghostRotate = document.querySelector("#ghost-rotate");

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";
  let typeCount = 0;

  let rotating = false;
  let rotateIndex = 0;
  let rotateTimer = null;
  let predictionTimer = null;

  if (!editor || !ghost || !ghostRotate) return;

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
        // Flatten JSON to text array
        collected.push(...json.map(item => item.title || item.selftext || item));
      } catch (err) {
        console.warn("Skipped corpus", url, err);
      }
    }
    return collected.length ? collected : [];
  }

  async function loadCorpora() {
    corpora.masc = await loadSide(CORPUS_URLS.masc);
    corpora.fem  = await loadSide(CORPUS_URLS.fem);

    if (!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if (!corpora.fem.length)  corpora.fem = [...FALLBACK.fem];

    ready = true;
    console.log("Corpora ready:", { masc: corpora.masc.length, fem: corpora.fem.length });
  }

  loadCorpora();

  /******************************
   * POSITIONING
   ******************************/
  function positionOverlay(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getClientRects()[0];
    if (!rect) return;
    const editorRect = editor.getBoundingClientRect();
    el.style.left = `${rect.left - editorRect.left}px`;
    el.style.top  = `${rect.top - editorRect.top}px`;
  }

  /******************************
   * ROTATING SUGGESTIONS
   ******************************/
  function startRotating() {
    if (rotating) return;
    rotating = true;
    rotateIndex = 0;

    ghostRotate.style.opacity = 0.4;
    ghostRotate.textContent = firstSentenceSuggestions[0];
    positionOverlay(ghostRotate);

    function cycle() {
      if (!rotating) return;
      ghostRotate.textContent = firstSentenceSuggestions[rotateIndex];
      ghostRotate.style.opacity = 0.4;
      ghostRotate.style.transform = "scale(1.05)";
      positionOverlay(ghostRotate);

      rotateIndex = (rotateIndex + 1) % firstSentenceSuggestions.length;
      rotateTimer = setTimeout(cycle, 900);
    }

    cycle();
  }

  function stopRotating() {
    rotating = false;
    clearTimeout(rotateTimer);
    ghostRotate.textContent = "";
    ghostRotate.style.opacity = 0;
  }

  ghostRotate.addEventListener("click", () => {
    insertRotatingSuggestion(ghostRotate.textContent);
  });

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
    if (!ready || !input || input.trim().length < 4) return "";

    const words = input.trim().split(/\s+/);

    // Decide voice based on corpora match
    function score(corpus) {
      return corpus.reduce((sum, line) => sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0.1), 0), 0);
    }

    const mScore = score(corpora.masc);
    const fScore = score(corpora.fem);
    activeVoice = mScore > fScore ? "masc" : (fScore > mScore ? "fem" : activeVoice);

    const pool = corpora[activeVoice];
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ");
  }

  function showPrediction(text) {
    if (!text) {
      ghost.textContent = "";
      return;
    }
    ghost.textContent = text;
    ghost.style.opacity = activeVoice === "masc" ? 0.7 : 0.35;
    ghost.style.fontWeight = activeVoice === "masc" ? 600 : 300;
    positionOverlay(ghost);
  }

  function acceptPrediction() {
    if (!ghost.textContent) return;
    editor.innerText += ghost.textContent;
    ghost.textContent = "";
    placeCaretAtEnd(editor);
    typeCount++;
  }

  /******************************
   * CARET
   ******************************/
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
   * EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    const text = editor.innerText.trim();

    if (text === "I am") {
      startRotating();
      return;
    } else {
      stopRotating();
    }

    clearTimeout(predictionTimer);
    if (text.endsWith(" ") && text.length > 3) {
      predictionTimer = setTimeout(() => {
        const prediction = generatePrediction(text);
        showPrediction(prediction);
      }, PREDICTION_DELAY);
    } else {
      ghost.textContent = "";
    }
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptPrediction();
    }
  });

  // Start rotating suggestions on load if content is "I am"
  if (editor.innerText.trim() === "I am") {
    startRotating();
  }

});
