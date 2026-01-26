document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  let ACTIVE_VOICE = "masc";
  const MAX_OUTPUT_WORDS = 22;

  /******************************
   * GENDERED EMOTIONS (AUTHORITATIVE)
   ******************************/
  const EMOTIONS = {
    masc: {
      mild: ["tired","stressed","off","fine"],
      medium: ["sad","angry","lonely","frustrated"],
      intense: ["numb","empty","done","broken"]
    },
    fem: {
      mild: ["low","uneasy","sensitive"],
      medium: ["sad","anxious","overwhelmed","hurt"],
      intense: ["empty","hopeless","despair","unlovable"]
    }
  };

  /******************************
   * STATE
   ******************************/
  let corpora = { masc: [], fem: [] };

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadCorpora() {
    const [m, f] = await Promise.all([
      fetch(CORPUS_URLS.masc).then(r => r.json()),
      fetch(CORPUS_URLS.fem).then(r => r.json())
    ]);

    corpora.masc = normalize(m);
    corpora.fem  = normalize(f);

    console.log("Loaded:", corpora.masc.length, corpora.fem.length);
  }

  loadCorpora();

  /******************************
   * NORMALIZATION (BULLETPROOF)
   ******************************/
  function normalize(source) {
    const arr = Array.isArray(source)
      ? source
      : Array.isArray(source?.data)
        ? source.data
        : [];

    return arr
      .map(t =>
        String(t)
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .trim()
      )
      .filter(t => t.length > 15);
  }

  /******************************
   * EMOTION DETECTION (FIRST)
   ******************************/
  function detectEmotion(text) {
    const words = text.split(/\s+/);
    const vocab = EMOTIONS[ACTIVE_VOICE];

    for (const level of ["intense","medium","mild"]) {
      if (words.some(w => vocab[level].includes(w))) {
        return level;
      }
    }
    return null;
  }

  /******************************
   * FUZZY SIMILARITY
   ******************************/
  function overlapScore(line, inputWords) {
    return inputWords.reduce(
      (s, w) => s + (line.includes(w) ? 1 : 0),
      0
    );
  }

  /******************************
   * GENERATION (FIXED)
   ******************************/
  function generate(input) {
    const emotion = detectEmotion(input);
    const inputWords = input.split(/\s+/);
    const pool = corpora[ACTIVE_VOICE];

    // 1️⃣ If emotion detected → NEVER block
    if (emotion) {
      // Prefer emotionally structured sentences
      let emotionalPool = pool.filter(t =>
        /(but|because|when|that|and)/i.test(t)
      );

      if (!emotionalPool.length) {
        emotionalPool = pool;
      }

      const chosen =
        emotionalPool[Math.floor(Math.random() * emotionalPool.length)];

      return {
        text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "),
        voice: ACTIVE_VOICE,
        emotion
      };
    }

    // 2️⃣ Otherwise fuzzy continuation
    const scored = pool
      .map(t => ({ t, score: overlapScore(t, inputWords) }))
      .filter(o => o.score > 0);

    if (scored.length) {
      scored.sort((a, b) => b.score - a.score);
      const chosen =
        scored[Math.floor(Math.random() * Math.min(5, scored.length))].t;

      return {
        text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "),
        voice: ACTIVE_VOICE
      };
    }

    // 3️⃣ Absolute last resort (very rare)
    const fallback =
      pool[Math.floor(Math.random() * pool.length)];

    return {
      text: fallback.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "),
      voice: ACTIVE_VOICE
    };
  }

  /******************************
   * RENDER INLINE
   ******************************/
  function render(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;

    el.textContent = result.text;
    el.style.opacity =
      result.emotion === "intense" ? "0.9" :
      result.emotion === "mild"    ? "0.7" : "1";

    el.style.color =
      result.voice === "masc" ? "#3b6cff" : "#d44b8c";
  }

  /******************************
   * INPUT
   ******************************/
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    const active = document.activeElement;
    if (!active?.classList.contains("editable")) return;

    const slot = active.getAttribute("data-slot");
    const input = active.textContent.toLowerCase().trim();
    if (!input) return;

    const result = generate(input);
    render(slot, result);
  });

});
