document.addEventListener("DOMContentLoaded", () => {
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  let corpora = { masc: [], fem: [] };
  let ready = false;
  const MAX_OUTPUT_WORDS = 20;

  async function loadCorpora() {
    try {
      const [mRes, fRes] = await Promise.all([fetch(CORPUS_URLS.masc), fetch(CORPUS_URLS.fem)]);
      const mJson = await mRes.json();
      const fJson = await fRes.json();

      corpora.masc = normalize(extractText(mJson));
      corpora.fem  = normalize(extractText(fJson));
      console.log("Loaded corpora:", corpora.masc.length, corpora.fem.length);
    } catch (err) {
      console.error("Failed to load corpora:", err);
      corpora.masc = ["Fallback male sentence for testing."];
      corpora.fem  = ["Fallback female sentence for testing."];
    } finally {
      ready = true;
    }
  }

  loadCorpora();

  function extractText(obj) {
    const out = [];
    function recurse(o) {
      if (!o) return;
      if (Array.isArray(o)) o.forEach(item => recurse(item));
      else if (typeof o === "object") {
        if ("selftext" in o && o.selftext) out.push(o.selftext);
        if ("body" in o && o.body) out.push(o.body);
        for (let k in o) recurse(o[k]);
      }
    }
    recurse(obj);
    return out;
  }

  function normalize(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(t => String(t).trim().replace(/\s+/g, " "))
      .filter(t => t.length > 20);
  }

  // -------------------------
  // MARKOV CHAIN GENERATOR
  // -------------------------
  function buildMarkov(textArray) {
    const chain = {};
    textArray.forEach(line => {
      const words = line.split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        const w = words[i].toLowerCase();
        const next = words[i + 1];
        if (!chain[w]) chain[w] = [];
        chain[w].push(next);
      }
    });
    return chain;
  }

  function generateFromChain(chain, lastWord, maxWords = MAX_OUTPUT_WORDS) {
    const result = [];
    let word = lastWord.toLowerCase();
    for (let i = 0; i < maxWords; i++) {
      const nextWords = chain[word];
      if (!nextWords || nextWords.length === 0) break;
      word = nextWords[Math.floor(Math.random() * nextWords.length)];
      result.push(word);
    }
    return result.join(" ");
  }

  // -------------------------
  // DECIDE VOICE
  // -------------------------
  function decideVoice(input) {
    const words = input.toLowerCase().split(/\s+/);
    function score(corpus) {
      return corpus.reduce((sum, line) => sum + words.reduce((s, w) => s + (line.toLowerCase().includes(w) ? 1 : 0), 0), 0);
    }
    const mascScore = score(corpora.masc);
    const femScore  = score(corpora.fem);
    return mascScore >= femScore ? "masc" : "fem";
  }

  // -------------------------
  // GENERATE INLINE PREDICTION
  // -------------------------
  function generate(input) {
    if (!ready || !input) return { text: "", voice: "masc" };

    const voice = decideVoice(input);
    const chain = buildMarkov(corpora[voice]);
    const words = input.split(/\s+/);
    const lastWord = words[words.length - 1];
    const continuation = generateFromChain(chain, lastWord, MAX_OUTPUT_WORDS);

    return { text: continuation, voice };
  }

  // -------------------------
  // RENDER INLINE
  // -------------------------
  function render(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = result.text;
    el.style.color = result.voice === "masc" ? "#3b6cff" : "#d44b8c";
    el.style.opacity = 0.85;
  }

  // -------------------------
  // INPUT HANDLER
  // -------------------------
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
