document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * CONFIG
   ******************************/
  const CORPUS_URLS = {
    masc: "https://hunilune.github.io/ghostintheloop/AskMen.json",
    fem:  "https://hunilune.github.io/ghostintheloop/AskWomen.json"
  };

  const MAX_OUTPUT_WORDS = 22;

  const EMOTIONS = {
    sad:     { fem: 1.0, masc: 0.25 },
    lonely:  { fem: 0.9, masc: 0.3 },
    anxious: { fem: 0.8, masc: 0.4 },
    angry:   { fem: 0.4, masc: 1.0 },
    tired:   { fem: 0.6, masc: 0.6 }
  };

  let corpora = { masc: [], fem: [] };
  let ready = false;

  /******************************
   * HELPER TO EXTRACT TEXT FROM NESTED JSON
   ******************************/
  function extractBodies(obj) {
    let out = [];
    if (!obj) return out;

    if (Array.isArray(obj)) {
      obj.forEach(child => out.push(...extractBodies(child)));
    } else if (obj.body) {
      out.push(obj.body);
    } else if (obj.data) {
      // check for children
      if (Array.isArray(obj.data.children)) {
        obj.data.children.forEach(c => out.push(...extractBodies(c.data)));
      } else {
        out.push(...extractBodies(obj.data));
      }
    } else if (typeof obj === "object") {
      for (let key in obj) out.push(...extractBodies(obj[key]));
    }

    return out;
  }

  /******************************
   * NORMALIZE TEXT
   ******************************/
  function normalize(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map(t => String(t).toLowerCase().replace(/[^\w\s]/g, "").trim())
      .filter(t => t.length > 5);
  }

  /******************************
   * LOAD CORPORA
   ******************************/
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
      corpora.fem = ["Fallback female sentence"];
    } finally {
      ready = true;
    }
  }

  loadCorpora();

  /******************************
   * EMOTION DETECTION
   ******************************/
  function detectEmotion(text) {
    text = text.toLowerCase();
    for (let e in EMOTIONS) if (text.includes(e)) return e;
    return null;
  }

  /******************************
   * DECIDE VOICE
   ******************************/
  function decideVoice(input) {
    const words = input.toLowerCase().split(/\s+/);

    function score(corpus) {
      return corpus.reduce((sum, line) => sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0), 0);
    }

    const mascScore = score(corpora.masc);
    const femScore  = score(corpora.fem);

    if (mascScore > femScore) return "masc";
    if (femScore > mascScore) return "fem";
    return "masc"; // default
  }

  /******************************
   * GENERATE PREDICTIVE TEXT
   ******************************/
  function generate(input) {
    if (!ready || !input) return { text: "— corpus not yet speaking —", voice: "masc" };

    const voice = decideVoice(input);
    const pool = corpora[voice];
    if (!pool.length) return { text: "— corpus empty —", voice };

    const emotion = detectEmotion(input);
    let allow = 1.0;
    if (emotion) allow = EMOTIONS[emotion][voice] ?? 0.5;
    if (Math.random() > allow) return { text: "— language thins here —", voice };

    const inputWords = input.toLowerCase().split(/\s+/);
    let candidates = pool.filter(t => inputWords.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "), voice };
  }

  /******************************
   * RENDER
   ******************************/
  function render(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;
    el.textContent = result.text;
    el.style.color = result.voice === "masc" ? "#3b6cff" : "#d44b8c";
    el.style.opacity = result.text.includes("thins") ? 0.4 : 0.9;
  }

  /******************************
   * INPUT HANDLER
   ******************************/
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
