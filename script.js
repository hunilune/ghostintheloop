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
  const BASE_ABSENCE_PROB = 0.05;
  const MEMORY_WEIGHT = 0.12;

  /******************************
   * GRADED, GENDERED EMOTIONS
   ******************************/
  const EMOTIONS = {
    masc: {
      mild: ["tired","stressed","annoyed","uneasy","off","fine"],
      medium: ["sad","angry","frustrated","lonely","worried","burnt"],
      intense: ["numb","empty","hopeless","exhausted","done","broken"]
    },
    fem: {
      mild: ["uneasy","low","off","sensitive","fragile"],
      medium: ["sad","anxious","overwhelmed","hurt","lonely","afraid"],
      intense: ["depressed","empty","grieving","despair","hopeless","unlovable"]
    }
  };

  /******************************
   * STATE
   ******************************/
  let corpora = { masc: [], fem: [] };
  let suppressionCount = 0;
  let suppressedMemory = [];

  /******************************
   * LOAD CORPORA
   ******************************/
  async function loadCorpora() {
    try {
      const [m, f] = await Promise.all([
        fetch(CORPUS_URLS.masc).then(r => r.json()),
        fetch(CORPUS_URLS.fem).then(r => r.json())
      ]);

      corpora.masc = normalize(m);
      corpora.fem  = normalize(f);

      console.log("Corpora loaded:", corpora.masc.length, corpora.fem.length);
    } catch (e) {
      console.error("Corpus load failed", e);
    }
  }

  loadCorpora();

  /******************************
   * NORMALIZATION
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
      .filter(t => t.length > 20);
  }

  /******************************
   * EMOTION DETECTION
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
   * ROLE INFERENCE
   ******************************/
  function inferRole(text) {
    if (
      /i feel|im feeling|i am feeling|feeling/i.test(text) ||
      detectEmotion(text)
    ) {
      return "emotion";
    }

    if (/because|since|due to/i.test(text)) return "cause";
    if (/\?$/.test(text)) return "question";
    return "statement";
  }

  /******************************
   * FUZZY SCORE
   ******************************/
  function scoreLine(line, inputWords) {
    const words = line.split(/\s+/);
    return words.reduce((s, w) => s + (inputWords.includes(w) ? 1 : 0), 0);
  }

  /******************************
   * GENERATION
   ******************************/
  function generate(input) {
    const role = inferRole(input);
    const emotionLevel = detectEmotion(input);
    const inputWords = input.split(/\s+/);

    const same = corpora[ACTIVE_VOICE];
    const opposite = corpora[ACTIVE_VOICE === "masc" ? "fem" : "masc"];

    const cross = opposite.some(t =>
      inputWords.some(w => t.includes(w))
    );

    // Emotion strength affects thinning
    let absenceProb = BASE_ABSENCE_PROB;
    if (emotionLevel === "intense") absenceProb *= 0.4;
    if (emotionLevel === "mild") absenceProb *= 1.4;

    if (suppressedMemory.some(m => input.includes(m))) {
      absenceProb += MEMORY_WEIGHT;
    }

    if (cross && Math.random() < absenceProb) {
      suppressionCount++;
      suppressedMemory.push(input);
      degradeInterface();
      return { mode: "unsupported" };
    }

    // 1️⃣ fuzzy overlap
    let scored = same
      .map(line => ({ line, score: scoreLine(line, inputWords) }))
      .filter(o => o.score > 0);

    // 2️⃣ semantic fallback
    if (!scored.length) {
      scored = same
        .filter(t => semanticFit(t, role))
        .map(t => ({ line: t, score: 1 }));
    }

    // 3️⃣ emotional intuition fallback (graded)
    if (!scored.length && role === "emotion") {
      const regex =
        emotionLevel === "intense"
          ? /(nothing|never|cant|empty|done|alone|end)/i
          : emotionLevel === "medium"
            ? /(but|because|when|that|and)/i
            : /(and|when|that)/i;

      scored = same
        .filter(t => regex.test(t))
        .map(t => ({ line: t, score: 0 }));
    }

    if (!scored.length) {
      return { mode: "unsupported" };
    }

    scored.sort((a, b) => b.score - a.score);

    const chosen =
      scored[Math.floor(Math.random() * Math.min(6, scored.length))].line;

    const text = chosen
      .split(/\s+/)
      .slice(0, MAX_OUTPUT_WORDS)
      .join(" ");

    return {
      mode:
        scored[0].score === 0
          ? "soft"
          : cross
            ? "thinned"
            : "expanded",
      text,
      voice: ACTIVE_VOICE,
      emotion: emotionLevel
    };
  }

  /******************************
   * SEMANTIC FILTER
   ******************************/
  function semanticFit(t, role) {
    if (role === "emotion") return /(and|but|when|because|that)/i.test(t);
    if (role === "cause") return /(this|that|it|which)/i.test(t);
    return true;
  }

  /******************************
   * INTERFACE FATIGUE
   ******************************/
  function degradeInterface() {
    document.documentElement.style.setProperty("--fatigue", suppressionCount);
  }

  /******************************
   * INLINE RENDER
   ******************************/
  function renderInline(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;

    if (result.mode === "unsupported") {
      el.textContent = "— language thins here —";
      el.style.opacity = "0.35";
      el.style.color = "#999";
      return;
    }

    el.textContent = result.text;

    // Emotion intensity subtly affects opacity
    if (result.emotion === "intense") el.style.opacity = "0.9";
    else if (result.emotion === "mild") el.style.opacity = "0.7";
    else el.style.opacity = "1";

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
    renderInline(slot, result);
  });

});
