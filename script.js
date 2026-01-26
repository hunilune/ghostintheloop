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
  function inferRol
