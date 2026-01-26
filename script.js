document.addEventListener("DOMContentLoaded", () => {

  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  let ACTIVE_VOICE = "masc";
  const MAX_OUTPUT_WORDS = 22;

  let corpora = { masc: [], fem: [] };

  /******************************
   * LOAD CORPORA
   *****************************/
  async function loadCorpora() {
    const [m, f] = await Promise.all([
      fetch(CORPUS_URLS.masc).then(r => r.json()),
      fetch(CORPUS_URLS.fem).then(r => r.json())
    ]);

    corpora.masc = normalize(m.data || []);
    corpora.fem  = normalize(f.data || []);
  }

  loadCorpora();

  /******************************
   * NORMALIZE TEXT
   ******************************/
  function normalize(arr) {
    return arr
      .map(t =>
        t
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .trim()
      )
      .filter(t => t.length > 20);
  }

  /******************************
   * GENERATE (continuation-first)
   ******************************/
  function generate(input) {
    const cleanInput = input
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim();

    const same = corpora[ACTIVE_VOICE];
    if (!same.length) return { mode: "unsupported" };

    /* 1. Try direct continuation */
    const directHits = same.filter(line =>
      line.includes(cleanInput)
    );

    if (directHits.length) {
      const hit = directHits[Math.floor(Math.random() * directHits.length)];
      const continuation = hit
        .slice(hit.indexOf(cleanInput) + cleanInput.length)
        .trim()
        .split(/\s+/)
        .slice(0, MAX_OUTPUT_WORDS)
        .join(" ");

      if (continuation.length > 5) {
        return { mode: "expanded", text: continuation };
      }
    }

    /* 2. Soft similarity fallback */
    const inputWords = cleanInput.split(/\s+/);

    const scored = same.map(line => {
      const score = inputWords.filter(w => line.includes(w)).length;
      return { line, score };
    });

    const viable = scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!viable.length) {
      // LAST resort: random continuation fragment
      const fallback = same[Math.floor(Math.random() * same.length)];
      return {
        mode: "expanded",
        text: fallback.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ")
      };
    }

    const chosen = viable[0].line;
    return {
      mode: "expanded",
      text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" ")
    };
  }

  /******************************
   * RENDER
   ******************************/
  function renderPrediction(editableEl, result) {
    const slot = editableEl.dataset.slot;
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;

    // clear old state so retry works
    el.textContent = "";
    el.style.opacity = "1";
    el.style.transform = "scale(1)";

    if (!result.text) {
      el.textContent = "— no matching text available —";
      el.style.opacity = "0.35";
      return;
    }

    el.textContent = result.text;
    el.style.color = ACTIVE_VOICE === "masc" ? "#3a6cff" : "#d94a8c";
    el.style.transform = "scale(1.05)";
  }

  /******************************
   * INPUT
   ******************************/
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    const el = document.activeElement;
    if (!el.classList.contains("editable")) return;

    e.preventDefault();

    const input = el.textContent.trim();
    if (input.split(/\s+/).length < 2) return;

    const result = generate(input);
    renderPrediction(el, result);
  });

});
