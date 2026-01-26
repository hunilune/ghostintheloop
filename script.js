document.addEventListener("DOMContentLoaded", () => {
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  let corpora = { masc: [], fem: [] };
  let ready = false;

  // Recursively find all "body" strings in the JSON
  function extractBodies(obj) {
    const out = [];

    function recurse(o) {
      if (!o) return;
      if (Array.isArray(o)) {
        o.forEach(item => recurse(item));
      } else if (typeof o === "object") {
        if ("body" in o && typeof o.body === "string") {
          out.push(o.body);
        }
        for (let k in o) recurse(o[k]);
      }
    }

    recurse(obj);
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
      corpora.fem  = normalize(extractBodies(fJson));

      console.log("Loaded corpora:", corpora.masc.length, corpora.fem.length);
    } catch (err) {
      console.error("Failed to load corpora:", err);
      corpora.masc = ["Fallback male sentence"];
      corpora.fem  = ["Fallback female sentence"];
    } finally {
      ready = true;
    }
  }

  loadCorpora();

  function generate(input) {
    if (!ready || !input) return { text: "— corpus not yet speaking —", voice: "masc" };

    // crude way to pick voice: whichever corpus has more words in common
    const words = input.toLowerCase().split(/\s+/);
    const mascScore = corpora.masc.reduce((sum, line) => sum + words.reduce((s,w)=>s+(line.includes(w)?1:0),0), 0);
    const femScore  = corpora.fem.reduce((sum, line) => sum + words.reduce((s,w)=>s+(line.includes(w)?1:0),0), 0);

    const voice = mascScore >= femScore ? "masc" : "fem";
    let pool = corpora[voice];
    if (!pool.length) return { text: "— corpus empty —", voice };

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
