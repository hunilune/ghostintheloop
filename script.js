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
   * STATE
   ******************************/
  let corpora = { masc: [], fem: [] };

  /******************************
   * LOAD CORPORA (ROBUST)
   ******************************/
  async function loadCorpora() {
    try {
      const [mRes, fRes] = await Promise.all([
        fetch(CORPUS_URLS.masc),
        fetch(CORPUS_URLS.fem)
      ]);

      const mJson = await mRes.json();
      const fJson = await fRes.json();

      corpora.masc = normalize(extractTextArray(mJson));
      corpora.fem  = normalize(extractTextArray(fJson));

      console.log("Loaded:", corpora.masc.length, corpora.fem.length);

    } catch (err) {
      console.error("Corpus load failed:", err);
    }
  }

  loadCorpora();

  /******************************
   * EXTRACT TEXT FROM ANY SHAPE
   ******************************/
  function extractTextArray(source) {
    if (Array.isArray(source)) {
      // array of strings OR objects
      return source.map(x =>
        typeof x === "string" ? x :
        x?.body || x?.text || ""
      );
    }

    if (Array.isArray(source?.data)) {
      return source.data.map(x =>
        typeof x === "string" ? x :
        x?.body || x?.text || ""
      );
    }

    if (Array.isArray(source?.comments)) {
      return source.comments.map(x =>
        typeof x === "string" ? x :
        x?.body || x?.text || ""
      );
    }

    return [];
  }

  /******************************
   * NORMALIZE
   ******************************/
  function normalize(arr) {
    if (!Array.isArray(arr)) return [];

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
   * SIMPLE EMOTION DETECTION
   ******************************/
  function isEmotion(text) {
    return /(feel|feeling|sad|angry|lonely|tired|anxious|empty)/i.test(text);
  }

  /******************************
   * GENERATE (SAFE)
   ******************************/
  function generate(input) {
    const pool = corpora[ACTIVE_VOICE];

    // 🚨 Hard guard: corpus not ready
    if (!pool || pool.length === 0) {
      return {
        text: "— corpus not yet speaking —",
        voice: ACTIVE_VOICE
      };
    }

    // Prefer emotional structure if emotion detected
    let candidates = isEmotion(input)
      ? pool.filter(t => /(but|because|when|that|and)/i.test(t))
      : pool;

    if (!candidates.length) {
      candidates = pool;
    }

    const chosen =
      candidates[Math.floor(Math.random() * candidates.length)];

    return {
      text: chosen.split(/\s+/).slice(0, MAX_OUTPUT_WORDS).join(" "),
      voice: ACTIVE_VOICE
    };
  }

  /******************************
   * RENDER
   ******************************/
  function render(slot, result) {
    const el = document.querySelector(`.predicted[data-slot="${slot}"]`);
    if (!el) return;

    el.textContent = result.text;
    el.style.color =
      result.voice === "masc" ? "#3b6cff" : "#d44b8c";
    el.style.opacity = "0.9";
  }

  /******************************
   * INPUT HANDLER
   ******************************/
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;

    const active = document.activeElement;
    if (!active?.classList.contains("editable")) return;

    const slot = active.getAttribute("data-slot");
    const input = active.textContent.trim();
    if (!input) return;

    const result = generate(input);
    render(slot, result);
  });

});
