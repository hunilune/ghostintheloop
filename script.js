document.addEventListener("DOMContentLoaded", () => {

  /******************************
   * ELEMENTS
   ******************************/
  const editor = document.querySelector("#editor");
  const output = document.querySelector("#output");

  document.documentElement.setAttribute("data-mode", "light");

  /******************************
   * CORPUS SOURCES
   ******************************/
  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_masc_sample.json"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/gutenberg_fem_sample.json"
    ]
  };

  let corpora = { masc: [], fem: [] };
  let ready = false;

  let activeVoice = "masc";
  let fatigue = 0;

  /******************************
   * LOAD & NORMALIZE
   ******************************/
  async function loadCorpora() {
    try {
      await Promise.all([
        loadVoice("masc"),
        loadVoice("fem")
      ]);
      ready = true;
      console.log("Corpora ready", corpora);
    } catch (err) {
      console.error("Corpus load failed", err);
      corpora.masc = ["handle it yourself", "focus on solutions"];
      corpora.fem  = ["talk about how you feel", "you are not alone"];
      ready = true;
    }
  }

  async function loadVoice(voice) {
    const texts = [];

    for (const url of CORPUS_URLS[voice]) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      texts.push(...extractText(json));
    }

    corpora[voice] = normalize(texts);
  }

  function extractText(src) {
    if (Array.isArray(src)) return src.map(x => x.body ?? x.text ?? x);
    if (Array.isArray(src?.data?.children))
      return src.data.children.map(c =>
        `${c.data.title ?? ""} ${c.data.selftext ?? ""}`
      );
    return [];
  }

  function normalize(arr) {
    return arr
      .map(t => String(t).toLowerCase())
      .map(t => t.replace(/https?:\/\/\S+/g, ""))
      .map(t => t.replace(/[^\p{L}\p{N}\s.,?!]/gu, ""))
      .map(t => t.replace(/\s+/g, " ").trim())
      .filter(t => t.length > 40);
  }

  loadCorpora();

  /******************************
   * SCORING
   ******************************/
  function score(input, corpus) {
    const words = input.toLowerCase().split(/\s+/);
    return corpus.reduce((sum, line) => {
      return sum + words.reduce((s, w) => s + (line.includes(w) ? 1 : 0), 0);
    }, 0);
  }

  function detectEmotion(text) {
    if (text.includes("sad")) return "sad";
    if (text.includes("lonely")) return "lonely";
    if (text.includes("cry")) return "cry";
    if (text.includes("angry")) return "angry";
    return null;
  }

  /******************************
   * CLASSIFICATION
   ******************************/
  function classify(input) {
    const mascScore = score(input, corpora.masc);
    const femScore  = score(input, corpora.fem);

    const confidence =
      Math.abs(mascScore - femScore) / (mascScore + femScore + 1);

    let alignment = "neutral";
    if (confidence > 0.35) {
      alignment = mascScore >= femScore ? "aligned" : "cross";
    }

    activeVoice = mascScore >= femScore ? "masc" : "fem";

    return { mascScore, femScore, confidence, alignment };
  }

  /******************************
   * GENERATION (NON-MARKOV)
   ******************************/
  function generate(input) {
    const pool = corpora[activeVoice];
    if (!pool.length) return "";

    const emotion = detectEmotion(input);

    // Social suppression
    if (activeVoice === "masc" && emotion && Math.random() < 0.55) {
      return "";
    }

    // Prefer partial lexical overlap
    const words = input.toLowerCase().split(/\s+/);
    let candidates = pool.filter(t =>
      words.some(w => t.includes(w))
    );

    if (!candidates.length) candidates = pool;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.split(/\s+/).slice(0, 22).join(" ");
  }

  /******************************
   * RENDERING
   ******************************/
  function setMode(mode) {
    document.documentElement.classList.remove("mode-aligned", "mode-cross");
    document.documentElement.classList.add(`mode-${mode}`);
    document.documentElement.setAttribute(
      "data-mode",
      mode === "cross" ? "dark" : "light"
    );
  }

  function updateFatigue(amount) {
    fatigue = Math.max(0, Math.min(10, fatigue + amount));
    document.documentElement.style.setProperty("--fatigue", fatigue);
  }

  function render(text, cls) {
    output.className = "predicted";

    if (!text) {
      output.textContent = "phrase unsupported in current voice.";
      output.classList.add("no-support");
      setMode("cross");
      updateFatigue(0.6);
      return;
    }

    output.textContent = text;

    if (cls.alignment === "aligned") {
      output.classList.add("aligned");
      setMode("aligned");
      updateFatigue(-0.2);
    } else if (cls.alignment === "cross") {
      output.classList.add("cross");
      setMode("cross");
      updateFatigue(0.4);
    } else {
      output.classList.add("neutral");
      updateFatigue(0.1);
    }
  }

  /******************************
   * INPUT LOOP
   ******************************/
  editor.addEventListener("input", () => {
    if (!ready) return;

    const input = editor.innerText.trim();
    if (!input) return;

    const cls = classify(input);
    const prediction = generate(input);
    render(prediction, cls);
  });

});
