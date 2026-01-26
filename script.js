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
  const BASE_ABSENCE_PROB = 0.07;
  const MEMORY_WEIGHT = 0.12;

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

      console.log("Corpora ready:", corpora.masc.length, corpora.fem.length);
    } catch (e) {
      console.error("Corpus load failed", e);
    }
  }

  loadCorpora();

  /******************************
   * NORMALIZE
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
   * ROLE INFERENCE
   ******************************/
  function inferRole(text) {
    if (/i feel|i am|im feeling|feeling/i.test(text)) return "emotion";
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
    const inputWords = input.split(/\s+/);

    const same = corpora[ACTIVE_VOICE];
    const opposite = corpora[ACTIVE_VOICE === "masc" ? "fem" : "masc"];

    const cross = opposite.some(t =>
      inputWords.some(w => t.includes(w))
    );

    let absenceProb = BASE_ABSENCE_PROB;
    if (suppressedMemory.some(m => input.includes(m))) {
      absenceProb += MEMORY_WEIGHT;
    }

    if (cross && Math.random() < absenceProb) {
      suppressionCount++;
      suppressedMemory.push(input);
      degradeInterface();
      return { mode: "unsupported" };
    }

    let scored = same
      .map(line => ({ line, score: scoreLine(line, inputWords) }))
      .filter(o => o.score > 0);

    if (!scored.length) {
      scored = same
        .filter(t => semanticFit(t, role))
        .map(t => ({ line: t, score: 1 }));
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
      mode: cross ? "thinned" : "expanded",
      text,
      voice: ACTIVE_VOICE
    };
  }

  /******************************
   * SEMANTIC FILTER
   ******************************/
  function semanticFit(t, role) {
    if (role === "emotion") return /(and|but|because|when|that)/i.test(t);
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

    el.textContent = "";

    if (result.mode === "unsupported") {
      el.textContent = "— language thins here —";
      el.style.opacity = "0.35";
      el.style.color = "#999";
      return;
    }

    el.textContent = result.text;
    el.style.opacity = result.mode === "thinned" ? "0.5" : "1";
    el.style.color = result.voice === "masc" ? "#3b6cff" : "#d44b8c";
  }

  /******************************
   * INPUT HANDLING
   ******************************/
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    const active = document.activeElement;
    if (!active?.classList.contains("editable")) return;

    const slot = active.getAttribute("data-slot");
    const input = active.textContent.toLowerCase().trim();

    if (input.split(/\s+/).length < 2) return;

    const result = generate(input);
    renderInline(slot, result);
  });

});
