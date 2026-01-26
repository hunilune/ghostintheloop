document.addEventListener("DOMContentLoaded", () => {

  /* Configuration */
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  let ACTIVE_VOICE = "masc"; // "masc" or "fem"
  const MAX_OUTPUT_WORDS = 22;
  const BASE_ABSENCE_PROB = 0.25;
  const MEMORY_WEIGHT = 0.15;

  /******************************
   * STATE
   ******************************/
  let corpora = { masc: [], fem: [] };
  let suppressionCount = 0;
  let suppressedMemory = [];

  /******************************
   * LOAD CORPORA SAFELY
   *****************************/
  async function loadCorpora() {
    try {
      const [mascRes, femRes] = await Promise.all([
        fetch(CORPUS_URLS.masc),
        fetch(CORPUS_URLS.fem)
      ]);

      if (!mascRes.ok) throw new Error(`Failed to fetch masc corpus: ${mascRes.status}`);
      if (!femRes.ok)  throw new Error(`Failed to fetch fem corpus: ${femRes.status}`);

      let mascData = await mascRes.json();
      let femData  = await femRes.json();

      // Ensure it is an array (in case JSON is wrapped in an object)
      if (!Array.isArray(mascData)) mascData = mascData.data || [];
      if (!Array.isArray(femData))  femData  = femData.data || [];

      corpora.masc = normalize(mascData);
      corpora.fem  = normalize(femData);

      console.log("All corpora loaded successfully");
    } catch (err) {
      console.error("Error loading corpora:", err);

      // Fallback corpus to keep script functional
      corpora.masc = normalize([
        "Fallback male sentence for testing.",
        "Another example of male input text."
      ]);
      corpora.fem = normalize([
        "Fallback female sentence for testing.",
        "Another example of female input text."
      ]);
    }
  }

  loadCorpora();

  /******************************
   * NORMALIZATION
   ******************************/
  function normalize(arr) {
    return arr
      .map(t => t.toLowerCase().trim())
      .filter(t =>
        t.length > 30 &&
        !t.match(/moderator|rules|subreddit|invalid|media|tv|film/i)
      );
  }

  /******************************
   * ROLE INFERENCE
   ******************************/
  function inferRole(text) {
    if (/i feel|i am feeling|feeling/i.test(text)) return "emotion";
    if (/\?$/.test(text)) return "question";
    if (/because|since|due to/i.test(text)) return "cause";
    return "statement";
  }

  /******************************
   * MEMORY CHECK
   ******************************/
  function resemblesSuppressed(text) {
    return suppressedMemory.some(mem =>
      mem.split(" ").some(w => text.includes(w))
    );
  }

  /******************************
   * GENERATION
   ******************************/
  function generate(input) {
    const role = inferRole(input);
    const same = corpora[ACTIVE_VOICE];
    const opposite = corpora[ACTIVE_VOICE === "masc" ? "fem" : "masc"];

    const cross = opposite.some(t =>
      input.split(/\s+/).some(w => t.includes(w))
    );

    let absenceProb = BASE_ABSENCE_PROB;
    if (resemblesSuppressed(input)) absenceProb += MEMORY_WEIGHT;

    if (cross && Math.random() < absenceProb) {
      suppressionCount++;
      suppressedMemory.push(input);
      degradeInterface();
      return { mode: "suppressed" };
    }

    const pool = same.filter(t => semanticFit(t, role));
    if (!pool.length) {
      suppressionCount++;
      suppressedMemory.push(input);
      degradeInterface();
      return { mode: "unsupported" };
    }

    const text = pool[Math.floor(Math.random() * pool.length)]
      .split(/\s+/)
      .slice(0, MAX_OUTPUT_WORDS)
      .join(" ");

    return { mode: cross ? "thinned" : "expanded", text };
  }

  /******************************
   * SEMANTIC FILTER
   ******************************/
  function semanticFit(t, role) {
    if (role === "emotion") return /(but|and|because|when|that)/i.test(t);
    if (role === "cause") return /(this|that|it|which)/i.test(t);
    return true;
  }

  /******************************
   * INTERFACE DEGRADATION
   ******************************/
  function degradeInterface() {
    const root = document.documentElement;
    root.style.setProperty("--fatigue", suppressionCount);
  }

  /******************************
   * RENDER
   ******************************/
  function render(result) {
    const el = document.createElement("div");
    el.className = "predicted";

    if (result.mode === "expanded") {
      el.style.opacity = "1";
      el.style.transform = "scale(1.05)";
      el.textContent = result.text;
    } else if (result.mode === "thinned") {
      el.style.opacity = "0.45";
      el.style.transform = "scale(0.95)";
      el.textContent = result.text;
    } else if (result.mode === "suppressed") {
      el.style.opacity = "0.25";
      el.textContent = "— continuation unavailable in this voice —";
    } else if (result.mode === "unsupported") {
      el.style.opacity = "0.35";
      el.textContent = "— language thins here —";
    }

    document.body.appendChild(el);
  }

  /******************************
   * INPUT
   ******************************/
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    const input = document.activeElement.value?.toLowerCase().trim();
    if (!input || input.split(/\s+/).length < 2) return;

    const result = generate(input);
    render(result);
  });

});
