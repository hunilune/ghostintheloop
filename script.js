document.addEventListener("DOMContentLoaded", () => {
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem: "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  let corpora = { masc: [], fem: [] };
  let ready = false;

  // Helper to recursively extract all "body" strings from nested Reddit-style JSON
  function extractBodies(obj) {
    let out = [];
    if (!obj) return out;

    if (Array.isArray(obj)) {
      obj.forEach(child => out.push(...extractBodies(child)));
    } else if (obj.body) {
      out.push(obj.body);
    } else if (obj.data) {
      if (Array.isArray(obj.data.children)) {
        obj.data.children.forEach(c => out.push(...extractBodies(c.data)));
      } else {
        out.push(...extractBodies(obj.data));
      }
    } else if (typeof obj === "object") {
      for (let k in obj) out.push(...extractBodies(obj[k]));
    }

    return out;
  }

  function normalize(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(t => String(t).toLowerCase().trim())
      .filter(t => t.length > 5);
  }

  async function loadCorpora() {
    try {
      const [mRes, fRes] = await Promise.all([
        fetch(CORPUS_URLS.masc),
        fetch(CORPUS_URLS.fem)
      ]);

      const mJson = await mRes.json();
      const fJson = await fRes.json();

      corpora.masc = normalize(extractBodies(mJson));
      corpora.fem = normalize(extractBodies(fJson));

      console.log("Loaded corpora:", corpora.masc.length, corpora.fem.length);
    } catch (err) {
      console.error("Failed to load corpora:", err);
      corpora.masc = ["Fallback male sentence"];
      corpora.fem = ["Fallback female sentence"];
    } finally {
      ready = true;
    }
  }

  loadCorpora();

  // Very simple generate function (just picks a random line from determined voice)
  function generate(input) {
    if (!ready) return { text: "— corpus not yet speaking —", voice: "masc" };

    const voice = corpora.masc.some(t => input.includes(t)) ? "masc" : "fem";
    const pool = corpora[voice];
    if (!pool.length) return { text: "— corpus empty —", voice };

    // simple fuzzy match: pick any line containing a word from input, or random
    const words = input.toLowerCase().split(/\s+/);
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { text: chosen.split(/\s+/).slice(0, 22).join(" "), voice };
  }

  function render(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = result.text;
    el.style.color = result.voice === "masc" ? "#3b6cff" : "#d44b8c";
    el.style.opacity = result.text.includes("—") ? 0.4 : 0.9;
  }

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
