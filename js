const corpora = {
  pressure: `
    obligation responsibility burden expectation duty compliance
    systems demand performance evaluation structure hierarchy
    measured outcomes standardized behavior monitored compliance
  `,
  identity: `
    self becoming reflection naming belonging memory difference
    voice interior narrative experience ambiguity transition
  `,
  default: `
    language moves forward thought follows pattern repetition
цвет
    anticipation continuation momentum habit
  `
};

function buildMarkov(text) {
  const words = text.trim().split(/\s+/);
  const chain = {};

  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (!chain[w]) chain[w] = [];
    chain[w].push(next);
  }
  return chain;
}

function generate(chain, length = 6) {
  const keys = Object.keys(chain);
  let word = keys[Math.floor(Math.random() * keys.length)];
  let result = [word];

  for (let i = 0; i < length; i++) {
    const nexts = chain[word];
    if (!nexts) break;
    word = nexts[Math.floor(Math.random() * nexts.length)];
    result.push(word);
  }
  return " " + result.join(" ");
}

const keywords = {
  pressure: ["pressure", "expected", "burden", "responsibility"],
  identity: ["identity", "self", "role"]
};

function detectTheme(text) {
  for (let theme in keywords) {
    if (keywords[theme].some(w => text.includes(w))) return theme;
  }
  return "default";
}

let lockedTheme = null;
let markovChain = null;
const usedSlots = new Set();

document.querySelectorAll(".editable").forEach(editable => {
  editable.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const slot = editable.dataset.slot;
    if (usedSlots.has(slot)) return;

    const text = editable.innerText.trim().toLowerCase();
    if (!text) return;

    // LOCK ON FIRST ENTER
    if (!lockedTheme) {
      lockedTheme = detectTheme(text);
      markovChain = buildMarkov(corpora[lockedTheme]);
    }

    const prediction = generate(markovChain);

    const predEl = document.querySelector(
      `.predicted[data-slot="${slot}"]`
    );
    predEl.textContent = prediction;

    usedSlots.add(slot);
  });
});
