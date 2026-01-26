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
  const CONTEXT_WINDOW = 5; // last N words of input for soft matching

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

      corpora.masc = normalize(Array.isArray(mascData.data) ? mascData.data : []);
      corpora.fem  = normalize(Array.isArray(femData.data)  ? femData.data  : []);

      console.log("All corpora loaded successfully");
    } catch (err) {
      console.error("Error loading corpora:", err);

      // Fallback small corpus
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
    if (!Array.isArray(arr)) return [];
    return arr
      .map(t => t.toLowerCase().trim())
      .filter(t =>
        t.length > 10 &&
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
   * SEMANTIC FILTER (optional)
   ******************************/
  function semanticFit(t, role) {
    // Uncomment to activate semantic filtering
    // if (role === "emotion") return /(but|and|because|when|that)/i.test(t);
    // if (role === "cause") return /(this|that|it|which)/i.test(t);
    return true; // by default, allow all lines
  }

  /******************************
   * GENERATION (soft matching, context aware)
   ******************************/
  function generate(input) {
    const role = inferRole(input);
    const same = corpora[ACTIVE_VOICE];
    const opposite = corpora[ACTIVE_VOICE === "masc" ? "fem" : "masc"];

    const inputWords = input.toLowerCase().split(/\s+/);
    const contextWords = inputWords.slice(-CONTEXT_WINDOW);

    // cross-coded detection
    const cross = opposite.some(t =>
      inputWords.some(w => t.includes(w))
    );

    let absenceProb = BASE_ABSENCE_PROB;
    if (resemblesSuppressed(input)) absenceProb += MEMORY_WEIGHT;

    if (cross && Math.random() < absenceProb) {
      suppressionCount++;
      suppressedMemory.push(input);
      degradeInterface();
      return { mode: "suppressed" };
    }

    // Score corpus lines by overlapping words in context
    let scoredPool = same.map(line => {
      const lineWords = line.toLowerCase().split(/\s+/);
      const score = lineWords.filter(w => contextWords.includes(w)).length;
      return { line, score };
    });

    // Keep lines with at least 1 overlap
    let pool = scoredPool.filter(obj => obj.score > 0).map(obj => obj.line);

    // fallback to entire corpus if nothing overlaps
    if (!pool.length) pool = same.length ? same : opposite;

    if (!pool.length) return { mode: "unsupported" };

    // Pick a random line from pool
    const text = pool[Math.floor(Math.random() * pool.length)]
      .split(/\s+/)
      .slice(0, MAX_OUTPUT_WORDS)
      .join(" ");

    return { mode: cross ? "thinned" : "expanded", text };
  }

  /******************************
   * INTERFACE DEGRADATION
   ******************************/
  function degradeInterface() {
    const root = document.documentElement;
    root.style.setProperty("--fatigue", suppressionCount);
  }

  /******************************
   * RENDER PREDICTION
   ******************************/
  function renderPrediction(editableEl, result) {
    const slot = editableEl.dataset.slot;
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;

    el.textContent = result.text || "";
    el.style.opacity = "1";

    // Color coding by voice
    el.style.color = ACTIVE_VOICE === "masc" ? "blue" : "pink";

    if (result.mode === "thinned") {
      el.style.opacity = "0.45";
      el.style.transform = "scale(0.95)";
    } else if (result.mode === "suppressed") {
      el.style.opacity = "0.25";
      el.textContent = "— continuation unavailable in this voice —";
    } else if (result.mode === "unsupported") {
      el.style.opacity = "0.35";
      el.textContent = "— no matching text available —";
    } else {
      el.style.opacity = "1";
      el.style.transform = "scale(1.05)";
    }
  }

  /******************************
   * INPUT HANDLER
   ******************************/
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    const el = document.activeElement;
    if (!el.classList.contains("editable")) return;

    e.preventDefault(); // prevent newline in contenteditable

    const input = el.textContent?.toLowerCase().trim();
    if (!input || input.split(/\s+/).length < 2) return;

    const result = generate(input);
    renderPrediction(el, result);
  });

});
