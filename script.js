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
    masc: ["men often express vulnerability through frustration rather than sadness"],
    fem: ["women are often socialised to explain emotions in relational terms"]
  };

  const MAX_OUTPUT_WORDS = 22;
  const PREDICTION_DELAY = 1200;

  const EMOTIONS = {
    sad:     { fem: 1.0, masc: 0.2 },
    lonely:  { fem: 0.9, masc: 0.3 },
    anxious: { fem: 0.8, masc: 0.4 },
    angry:   { fem: 0.3, masc: 1.0 },
    tired:   { fem: 0.6, masc: 0.6 }
  };

  /******************************
   * STATE
   ******************************/
  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";
  let predictionTimer = null;
  let typeCount = 0;

  const editor = document.querySelector("#editor");
  const ghost = document.querySelector("#ghost");

  if (!editor || !ghost) return;

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
      } catch {}
    }
    return normalize(collected);
  }

  async function loadCorpora() {
    corpora.masc = await loadSide(CORPUS_URLS.masc);
    corpora.fem  = await loadSide(CORPUS_URLS.fem);

    if (!corpora.masc.length) corpora.masc = FALLBACK.masc;
    if (!corpora.fem.length)  corpora.fem  = FALLBACK.fem;

    ready = true;
  }

  loadCorpora();

  /******************************
   * TEXT PROCESSING
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) {
      return src.map(item =>
        typeof item === "string"
          ? item
          : `${item.title || ""} ${item.selftext || ""}`
      );
    }
    if (Array.isArray(src?.data?.children)) {
      return src.data.children.map(c =>
        `${c.data.title || ""} ${c.data.selftext || ""}`
      );
    }
    return [];
  }

  function normalize(arr) {
    const corrections = {
      teir: "their",
      recieve: "receive",
      definately: "definitely"
    };

    return arr
      .map(decodeHTMLEntities)
      .map(t => t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, ""))
      .map(t => t.replace(/\s+/g, " ").trim())
      .map(t => {
        Object.entries(corrections).forEach(([bad, good]) => {
          t = t.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
        });
        return t;
      })
      .filter(t => t.length > 20);
  }

  function decodeHTMLEntities(str) {
    const t = document.createElement("textarea");
    t.innerHTML = str;
    return t.value;
  }

  /******************************
   * VOICE SELECTION
   ******************************/
  function detectEmotion(text) {
    return Object.keys(EMOTIONS).find(e => text.includes(e)) || null;
  }

  function decideVoice(input) {
    const emotion = detectEmotion(input);
    if (typeCount === 0 && emotion && EMOTIONS[emotion].fem > 0.7) {
      return "fem";
    }

    function score(corpus) {
      return corpus.reduce((sum, line) =>
        sum + input.split(/\s+/).reduce((s, w) =>
          s + (line.includes(w) ? 1 : 0.1), 0
        ), 0);
    }

    const m = score(corpora.masc);
    const f = score(corpora.fem);

    return m > f ? "masc" : f > m ? "fem" : activeVoice;
  }

  /******************************
   * GENERATION
   ******************************/
  function generate(input) {
    if (!ready) return null;

    const voice = decideVoice(input);
    activeVoice = voice;

    const pool = corpora[voice];
    const words = input.split(/\s+/);

    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return {
      voice,
      text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ")
    };
  }

  /******************************
   * GHOST RENDERING (KEY PART)
   ******************************/
  function showSuggestion(prediction) {
    if (!prediction) return;

    ghost.textContent = prediction.text.toLowerCase();
    document.body.classList.toggle("mode-masc", prediction.voice === "masc");
    document.body.classList.toggle("mode-fem", prediction.voice === "fem");

    positionGhost();
  }

  function positionGhost() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);

    const rect = range.getClientRects()[0];
    if (!rect) return;

    const editorRect = editor.getBoundingClientRect();

    ghost.style.left = `${rect.left - editorRect.left}px`;
    ghost.style.top  = `${rect.top - editorRect.top}px`;
  }

  function clearGhost() {
    ghost.textContent = "";
  }

  /******************************
   * ACCEPT
   ******************************/
  function acceptSuggestion() {
    if (!ghost.textContent) return;

    editor.innerText += ghost.textContent;
    clearGhost();
    placeCaretAtEnd(editor);
    typeCount++;
  }

  function placeCaretAtEnd(el) {
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  /******************************
   * EVENTS
   ******************************/
  editor.addEventListener("input", () => {
    clearGhost();
    if (predictionTimer) clearTimeout(predictionTimer);

    const text = editor.innerText.trim();
    if (text.endsWith(" ") && text.length > 3) {
      predictionTimer = setTimeout(() => {
        showSuggestion(generate(text));
      }, PREDICTION_DELAY);
    }
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptSuggestion();
    }
  });

});
