document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_masc_sample.json",
      "https://hunilune.github.io/ghostintheloop/PurplePillDebate.json"
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
  let ready = false;
  let biasAccumulator = 0;

  const editor = document.querySelector("#editor");
  const container = document.documentElement;

  let suggestionSpan = null;

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadCorpora() {
    try {
      const [mRes, fRes] = await Promise.all([
        Promise.all(CORPUS_URLS.masc.map(u => fetch(u).then(r => r.json()))),
        Promise.all(CORPUS_URLS.fem.map(u => fetch(u).then(r => r.json())))
      ]);

      corpora.masc = normalize(mRes.flatMap(extractText));
      corpora.fem  = normalize(fRes.flatMap(extractText));
    } catch (err) {
      console.warn("Corpus load failed, using fallback.");
      corpora.masc = ["fallback male sentence for testing"];
      corpora.fem  = ["fallback female sentence for testing"];
    } finally {
      ready = true;
    }
  }

  loadCorpora();

  /******************************
   * HELPERS
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src.map(x => x.body ?? x.text ?? "");
    if (src?.data?.children)
      return src.data.children.map(c => c.data.selftext ?? c.data.title ?? "");
    return [];
  }

  function normalize(arr) {
    return arr
      .map(t => String(t).toLowerCase().replace(/[^\w\s]/g, "").trim())
      .filter(t => t.length > 20);
  }

  function detectEmotion(text) {
    for (let e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  /******************************
   * CLASSIFICATION (continuous)
   ******************************/
  function classify(input) {
    const words = input.toLowerCase().split(/\s+/);

    function score(corpus) {
      return corpus.reduce((sum, line) =>
        sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0)
      , 0);
    }

    let masc = score(corpora.masc);
    let fem  = score(corpora.fem);

    masc += biasAccumulator;

    const total = masc + fem || 1;

    const result = {
      masc: masc / total,
      fem: fem / total,
      confidence: Math.abs(masc - fem) / total
    };

    biasAccumulator += (result.masc - result.fem) * 0.05;

    return result;
  }

  /******************************
   * GENERATE TEXT OR ABSENCE
   ******************************/
  function generate(input, cls) {
    const emotion = detectEmotion(input);
    let allow = 1.0;

    if (emotion) {
      allow = EMOTIONS[emotion][cls.masc > cls.fem ? "masc" : "fem"] ?? 0.5;
    }

    if (Math.random() > allow) return "";

    const pool = cls.masc > cls.fem ? corpora.masc : corpora.fem;
    if (!pool.length) return "";

    const inputWords = input.split(/\s+/);
    let candidates = pool.filter(t => inputWords.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    return candidates[Math.floor(Math.random() * candidates.length)]
      .split(/\s+/)
      .slice(0, MAX_OUTPUT_WORDS)
      .join(" ");
  }

  /******************************
   * APPLY VISUAL HIERARCHY
   ******************************/
  function applyVisuals(cls) {
    container.dataset.mode = cls.masc > cls.fem ? "dark" : "light";

    const scale = 0.85 + cls.confidence * 0.5;
    suggestionSpan.style.transform = `scale(${scale})`;
    suggestionSpan.style.opacity = 0.3 + cls.confidence;

    if (cls.confidence < 0.2) {
      suggestionSpan.classList.add("uncertain");
    } else {
      suggestionSpan.classList.remove("uncertain");
    }
  }

  /******************************
   * RENDER
   ******************************/
  function showSuggestion(text, cls) {
    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
      suggestionSpan.className = "suggestion";
      editor.appendChild(suggestionSpan);
    }

    if (!text) {
      suggestionSpan.textContent = "—";
      suggestionSpan.classList.add("absence");
    } else {
      suggestionSpan.textContent = text;
      suggestionSpan.classList.remove("absence");
    }

    applyVisuals(cls);
  }

  /******************************
   * INPUT
   ******************************/
  editor.addEventListener("input", () => {
    if (!ready) return;
    const input = editor.innerText.trim();
    if (!input) return;

    const cls = classify(input);
    const text = generate(input, cls);
    showSuggestion(text, cls);
  });

});
