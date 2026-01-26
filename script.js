document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
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
  let ready = false; // corpus loaded
  let markovFallback = null; // fallback Markov chain

  /******************************
   * UTILITIES
   ******************************/
  function extractText(src) {
    if (Array.isArray(src)) return src.map(x => x.body ?? x.text ?? x);
    if (Array.isArray(src?.data)) return src.data.map(x => x.body ?? x.text ?? x);
    return [];
  }

  function normalize(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(t => String(t).toLowerCase().replace(/[^\w\s]/g, "").trim())
      .filter(t => t.length > 20);
  }

  function detectEmotion(text) {
    text = text.toLowerCase();
    for (let e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

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

      console.log("Loaded corpora:", corpora.masc.length, corpora.fem.length);

      // build fallback Markov from combined corpora
      markovFallback = buildMarkov(corpora.masc.concat(corpora.fem));
    } catch (err) {
      console.error("Corpus load failed:", err);
      corpora.masc = ["Fallback male sentence for testing."];
      corpora.fem  = ["Fallback female sentence for testing."];
      markovFallback = buildMarkov(corpora.masc.concat(corpora.fem));
    } finally {
      ready = true;
      document.body.style.opacity = "1";
    }
  }

  loadCorpora();

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
    return "masc"; // default
  }

  /******************************
   * GENERATE PREDICTIVE TEXT
   ******************************/
  function generate(input) {
    if (!ready || !input) return { text: "— corpus not yet speaking —", voice: "masc" };

    const voice = decideVoice(input);
    const pool = corpora[voice];
    if (!pool.length) return { text: "— corpus empty —", voice };

    const emotion = detectEmotion(input);
    let allow = 1.0;
    if (emotion) allow = EMOTIONS[emotion][voice] ?? 0.5;
    if (Math.random() > allow) return { text: "— language thins here —", voice };

    // fuzzy matching
    const inputWords = input.toLowerCase().split(/\s+/);
    let candidates = pool.filter(t => inputWords.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (!chosen) {
      // fallback Markov
      return { text: markovFallback ? generateMarkov(markovFallback) : "— nothing generated —", voice };
    }

    return { text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "), voice };
  }

  /******************************
   * MARKOV FALLBACK
   ******************************/
  function buildMarkov(texts) {
    const words = texts.join(" ").split(/\s+/);
    const chain = {};
    for (let i = 0; i < words.length - 1; i++) {
      const w = words[i];
      const next = words[i + 1];
      if (!chain[w]) chain[w] = [];
      chain[w].push(next);
    }
    return chain;
  }

  function generateMarkov(chain, length = 10) {
    const keys = Object.keys(chain);
    let word = keys[Math.floor(Math.random() * keys.length)];
    let result = [word];
    for (let i = 0; i < length; i++) {
      const nexts = chain[word];
      if (!nexts) break;
      word = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(word);
    }
    return result.join(" ");
  }

  /******************************
   * RENDER
   ******************************/
  function render(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = result.text;
    el.style.color = result.voice === "masc" ? "#3b6cff" : "#d44b8c";
    el.style.opacity = result.text.includes("thins") ? 0.4 : 0.9;
  }

  /******************************
   * INPUT HANDLER
   ******************************/
  document.querySelectorAll(".editable").forEach(editable => {
    editable.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();

      if (!ready) return;
      const slot = editable.dataset.slot;
      const input = editable.textContent.trim();
      if (!input) return;

      const result = generate(input);
      render(slot, result);
    });
  });

});
