document.addEventListener("DOMContentLoaded", () => {
  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_masc_sample.json",
      "https://hunilune.github.io/ghostintheloop/PurplePillDebate"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_fem_sample.json",
      "https://hunilune.github.io/ghostintheloop/TwoXChromosomes.json",
      "https://hunilune.github.io/ghostintheloop/AskFeminists.json"
    ]
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
  let ready = false; // corpora loaded
  let activeVoice = "masc"; // default

  const editor = document.querySelector("#editor");
  let suggestionSpan = null;

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadCorpora() {
    try {
      const [mRes, fRes] = await Promise.all([
        fetch(CORPUS_URLS.masc),
        fetch(CORPUS_URLS.fem)
      ]);
      const mJson = await mRes.json();
      const fJson = await fRes.json();
      corpora.masc = normalize(extractText(mJson));
      corpora.fem  = normalize(extractText(fJson));
      console.log("Corpora loaded:", corpora.masc.length, corpora.fem.length);
    } catch (err) {
      console.error("Corpus load failed:", err);
      corpora.masc = ["Fallback male sentence for testing."];
      corpora.fem  = ["Fallback female sentence for testing."];
    } finally {
      ready = true;
    }
  }

  loadCorpora();

  /******************************
   * EXTRACT TEXT ARRAY FROM JSON
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src.map(x => x.body ?? x.text ?? x);
    if (Array.isArray(src?.data?.children))
      return src.data.children.map(c => c.data.selftext ?? c.data.title ?? "");
    return [];
  }

  /******************************
   * NORMALIZE TEXT
   ******************************/
  function normalize(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(t => String(t).toLowerCase().replace(/[^\w\s]/g, "").trim())
      .filter(t => t.length > 20);
  }

  /******************************
   * DETECT EMOTION
   ******************************/
  function detectEmotion(text) {
    text = text.toLowerCase();
    for (let e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  /******************************
   * DECIDE VOICE
   ******************************/
  function decideVoice(input) {
    const words = input.toLowerCase().split(/\s+/);
    function score(corpus) {
      return corpus.reduce((sum, line) => {
        return sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0);
      }, 0);
    }
    const mascScore = score(corpora.masc);
    const femScore  = score(corpora.fem);
    if (mascScore > femScore) return "masc";
    if (femScore > mascScore) return "fem";
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
    if (!pool.length) return { text: "— corpus empty —", voice };

    const emotion = detectEmotion(input);
    let allow = 1.0;
    if (emotion) allow = EMOTIONS[emotion][voice] ?? 0.5;

    if (Math.random() > allow) return { text: "", voice };

    const inputWords = input.toLowerCase().split(/\s+/);
    let candidates = pool.filter(t => inputWords.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const nextWords = chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS);

    return { text: nextWords.join(" "), voice };
  }

  /******************************
   * RENDER INLINE SUGGESTION
   ******************************/
  function showSuggestion(prediction) {
    if (!editor) return;

    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
      suggestionSpan.className = "suggestion";
      editor.appendChild(suggestionSpan);
    }

    suggestionSpan.textContent = prediction.text;
    suggestionSpan.style.color = prediction.voice === "masc" ? "#3b6cff" : "#d44b8c";
  }

  function acceptSuggestion() {
    if (!suggestionSpan) return;
    // Insert suggestion text into editor
    suggestionSpan.removeAttribute("class");
    suggestionSpan = null;
    // Move cursor to end
    placeCaretAtEnd(editor);
  }

  /******************************
   * UTILITY: Place caret at end
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
   * INPUT HANDLING
   ******************************/
  editor.addEventListener("input", () => {
    const text = editor.innerText.trim();
    const prediction = generate(text);
    showSuggestion(prediction);
  });

  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      acceptSuggestion();
    }
  });
});
