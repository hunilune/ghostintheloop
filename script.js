document.addEventListener("DOMContentLoaded", () => {
  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  const MAX_OUTPUT_WORDS = 20;

  const EMOTIONS = {
    sad:     { fem: 1.0, masc: 0.25 },
    lonely:  { fem: 0.9, masc: 0.3 },
    anxious: { fem: 0.8, masc: 0.4 },
    angry:   { fem: 0.4, masc: 1.0 },
    tired:   { fem: 0.6, masc: 0.6 }
  };

  let corpora = { masc: [], fem: [] };
  let markovChains = { masc: {}, fem: {} };
  let ready = false;

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadCorpus(url) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      return extractText(json);
    } catch (e) {
      console.error("Error loading corpus:", e);
      return [];
    }
  }

  async function initCorpora() {
    const [mascData, femData] = await Promise.all([
      loadCorpus(CORPUS_URLS.masc),
      loadCorpus(CORPUS_URLS.fem)
    ]);

    corpora.masc = normalize(mascData);
    corpora.fem  = normalize(femData);

    markovChains.masc = buildMarkov(corpora.masc.join(" "));
    markovChains.fem  = buildMarkov(corpora.fem.join(" "));

    console.log("Corpora loaded:", corpora.masc.length, corpora.fem.length);
    ready = true;
  }

  initCorpora();

  /******************************
   * EXTRACT TEXT FROM REDDIT JSON
   ******************************/
  function extractText(src) {
    if (!src?.data?.children) return [];
    return src.data.children
      .map(c => c.data?.selftext || c.data?.title || "")
      .filter(t => t && t.length > 20);
  }

  /******************************
   * NORMALIZE TEXT
   ******************************/
  function normalize(arr) {
    return arr.map(t => t.toLowerCase().replace(/\s+/g, " ").trim());
  }

  /******************************
   * EMOTION DETECTION
   ******************************/
  function detectEmotion(input) {
    input = input.toLowerCase();
    for (let e in EMOTIONS) if (input.includes(e)) return e;
    return null;
  }

  /******************************
   * DECIDE VOICE (MASC/FEM)
   ******************************/
  function decideVoice(input, emotion) {
    const words = input.toLowerCase().split(/\s+/);
    const scores = { masc: 0, fem: 0 };

    for (let v of ["masc", "fem"]) {
      for (let line of corpora[v]) {
        for (let w of words) {
          if (line.includes(w)) scores[v]++;
        }
      }
    }

    // boost with emotion
    if (emotion) {
      scores.masc *= EMOTIONS[emotion].masc;
      scores.fem  *= EMOTIONS[emotion].fem;
    }

    return scores.masc >= scores.fem ? "masc" : "fem";
  }

  /******************************
   * MARKOV CHAIN GENERATION
   ******************************/
  function buildMarkov(text) {
    const words = text.split(/\s+/);
    const chain = {};
    for (let i = 0; i < words.length - 1; i++) {
      const w = words[i];
      const next = words[i + 1];
      if (!chain[w]) chain[w] = [];
      chain[w].push(next);
    }
    return chain;
  }

  function generateFromMarkov(chain, startWords, maxWords = 15) {
    let result = [];
    let last = startWords[startWords.length - 1] || startWords[0];
    for (let i = 0; i < maxWords; i++) {
      if (!last) break;
      const nexts = chain[last];
      if (!nexts || nexts.length === 0) break;
      const next = nexts[Math.floor(Math.random() * nexts.length)];
      result.push(next);
      last = next;
    }
    return result.join(" ");
  }

  /******************************
   * GENERATE PREDICTIVE TEXT
   ******************************/
  function generate(input) {
    if (!ready || !input) return { text: "— corpus not yet speaking —", voice: "masc" };

    const emotion = detectEmotion(input);
    const voice = decideVoice(input, emotion);
    const chain = markovChains[voice];

    const inputWords = input.toLowerCase().split(/\s+/).slice(-2);
    let prediction = generateFromMarkov(chain, inputWords, MAX_OUTPUT_WORDS);

    if (!prediction) prediction = "— language thins here —";

    return { text: prediction, voice };
  }

  /******************************
   * INLINE RENDER
   ******************************/
  document.querySelectorAll(".editable").forEach(editable => {
    editable.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!ready) return;

      const input = editable.textContent.trim();
      if (!input) return;

      const result = generate(input);

      // append prediction inline
      const span = document.createElement("span");
      span.textContent = " " + result.text;
      span.style.color = result.voice === "masc" ? "#3b6cff" : "#d44b8c";

      editable.appendChild(span);

      // move cursor to end
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
  });
});
