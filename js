// Sample corpus (replace with larger text for better results)
const corpus = `
I often feel overwhelmed by expectations
Sometimes I wish I could take a break
Everyone seems to judge me
I try my best but it never feels enough
The pressure keeps building day by day
`;

// Build Markov chain
const words = corpus.split(/\s+/);
const markov = {};
for (let i = 0; i < words.length - 1; i++) {
  const word = words[i].toLowerCase();
  const next = words[i + 1].toLowerCase();
  if (!markov[word]) markov[word] = [];
  markov[word].push(next);
}

function predictNext(lastWord) {
  const options = markov[lastWord.toLowerCase()];
  if (!options) return null;
  return options[Math.floor(Math.random() * options.length)];
}

// DOM
const roleEl = document.getElementById("role");
const feelingEl = document.getElementById("feeling");
const generatedEl = document.getElementById("generated");
const generateBtn = document.getElementById("generate");

generateBtn.addEventListener("click", () => {
  let text = `As a ${roleEl.innerText.trim()}, I feel ${feelingEl.innerText.trim()}`;
  
  let lastWord = feelingEl.innerText.trim().split(/\s+/).pop();
  
  for (let i = 0; i < 50; i++) { // append 50 words for paragraph
    const next = predictNext(lastWord);
    if (!next) break;
    text += " " + next;
    lastWord = next;
  }
  
  generatedEl.innerText = text + ".";
});
