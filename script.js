document.addEventListener("DOMContentLoaded", () => {

  const CORPUS_URLS = {
    masc: [
      "https://hunilune.github.io/ghostintheloop/AskMen.json",
      "https://hunilune.github.io/ghostintheloop/AskMenOver30.json",
      "https://hunilune.github.io/ghostintheloop/MensRights.json",
      "https://hunilune.github.io/ghostintheloop/PurplePillDebate.json"
    ],
    fem: [
      "https://hunilune.github.io/ghostintheloop/AskWomen.json",
      "https://hunilune.github.io/ghostintheloop/AskFeminists.json",
      "https://hunilune.github.io/ghostintheloop/Feminism.json",
      "https://hunilune.github.io/ghostintheloop/TwoXChromosomes.json"
    ]
  };
  const FALLBACK = { masc: ["Fallback male sentence"], fem: ["Fallback female sentence"] };
  const MAX_OUTPUT_WORDS = 22;

  let corpora = { masc: [], fem: [] };
  let ready = false;
  let activeVoice = "masc";

  const editor = document.querySelector("#editor");
  let suggestionSpan = editor.querySelector(".suggestion");
  let predictionTimer = null;
  const PREDICTION_DELAY = 500;

  async function loadSide(urls) {
    const collected = [];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        collected.push(...json.map(i => i.title || i.selftext || i));
      } catch(e) { console.warn("Skipped corpus", url, e); }
    }
    return collected.length ? collected : [];
  }

  async function loadCorpora() {
    corpora.masc = await loadSide(CORPUS_URLS.masc);
    corpora.fem = await loadSide(CORPUS_URLS.fem);
    if(!corpora.masc.length) corpora.masc = [...FALLBACK.masc];
    if(!corpora.fem.length) corpora.fem = [...FALLBACK.fem];
    ready = true;
    console.log("Corpora loaded");
  }
  loadCorpora();

  function generate(input) {
    if (!ready || !input) return { text:"", voice: activeVoice };
    const pool = corpora[activeVoice];
    const words = input.split(/\s+/);
    let candidates = pool.filter(t => words.some(w => t.includes(w)));
    if (!candidates.length) candidates = pool;
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { text: chosen.split(/\s+/).slice(0,MAX_OUTPUT_WORDS).join(" "), voice: activeVoice };
  }

  function showSuggestion(prediction) {
    suggestionSpan.innerHTML = "";
    prediction.text.split(/\s+/).forEach((word,i)=>{
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.className = "word";
      span.style.opacity = 0;
      span.style.transform = "scale(0.96)";
      setTimeout(()=>{ span.style.opacity=1; span.style.transform="scale(1)"; }, i*120);
      suggestionSpan.appendChild(span);
    });
    document.body.classList.add(`mode-${prediction.voice}`);
  }

  function acceptSuggestion() {
    if (!suggestionSpan) return;
    const frag = document.createDocumentFragment();
    Array.from(suggestionSpan.children).forEach(node => frag.appendChild(document.createTextNode(node.textContent)));
    editor.appendChild(frag);
    suggestionSpan.innerHTML = "";
    placeCaretAtEnd(editor);
  }

  function placeCaretAtEnd(el) {
    el.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.addRange(range);
  }

  editor.addEventListener("input", ()=>{
    const text = editor.innerText;
    if(text.endsWith(" ") && text.trim().length > 3) {
      if(predictionTimer) clearTimeout(predictionTimer);
      predictionTimer = setTimeout(()=>{
        const prediction = generate(text.trim());
        showSuggestion(prediction);
      }, PREDICTION_DELAY);
    }
  });

  editor.addEventListener("keydown", e=>{
    if(e.key==="Enter"){ e.preventDefault(); acceptSuggestion(); }
  });

});
