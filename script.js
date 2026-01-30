document.addEventListener("DOMContentLoaded", () => {
  const editor = document.querySelector("#editor");
  let suggestionSpan = null;
  let typeCount = 0;

  // Rotating ghost suggestions
  let rotatingTimer = null;
  let rotatingIndex = 0;
  const firstSentenceSuggestions = ["sad", "lonely", "wondering"];
  let rotatingActive = false;

  /******************************
   * ROTATING SUGGESTIONS
   ******************************/
  function startRotatingSuggestions() {
    if (!editor || rotatingActive) return;
    rotatingActive = true;

    if (!suggestionSpan) {
      suggestionSpan = document.createElement("span");
      suggestionSpan.className = "suggestion";
      editor.appendChild(suggestionSpan);
    }

    suggestionSpan.innerHTML = "";
    firstSentenceSuggestions.forEach(word => {
      const span = document.createElement("span");
      span.textContent = word + " ";
      span.style.opacity = 0;
      span.style.fontWeight = 500;
      span.style.fontFamily = "Office Times, serif";
      span.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      span.style.cursor = "pointer"; // clickable
      suggestionSpan.appendChild(span);

      // Click to insert this suggestion
      span.addEventListener("click", () => {
        insertSuggestion(span);
      });
    });

    // Cycle through suggestions
    function cycle() {
      if (!rotatingActive) return;
      const spans = Array.from(suggestionSpan.children);
      spans.forEach(s => s.style.opacity = 0);
      spans[rotatingIndex].style.opacity = 1;
      spans[rotatingIndex].style.transform = "scale(1.05)";
      rotatingIndex = (rotatingIndex + 1) % spans.length;
      rotatingTimer = setTimeout(cycle, 1000);
    }

    cycle();
  }

  function stopRotatingSuggestions() {
    rotatingActive = false;
    if (rotatingTimer) clearTimeout(rotatingTimer);
    rotatingTimer = null;
  }

  function insertSuggestion(span) {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    const frag = document.createDocumentFragment();
    frag.appendChild(span.cloneNode(true));
    range.insertNode(frag);
    stopRotatingSuggestions();
    if (suggestionSpan) suggestionSpan.remove();
    suggestionSpan = null;
    typeCount++;
    placeCaretAtEnd(editor);
  }

  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /******************************
   * EVENTS
   ******************************/
  // Start rotating if only "I am" is present
  if (editor && editor.innerText.trim() === "I am") {
    startRotatingSuggestions();
  }

  // Stop rotation on focus / typing
  editor.addEventListener("focus", () => stopRotatingSuggestions());
  editor.addEventListener("input", () => stopRotatingSuggestions());

  // Enter key inserts visible suggestion or normal suggestion
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (rotatingActive && suggestionSpan) {
        const visibleSpan = Array.from(suggestionSpan.children)
          .find(s => parseFloat(s.style.opacity) > 0);
        if (visibleSpan) {
          insertSuggestion(visibleSpan);
        }
      } else {
        // call your normal acceptSuggestion logic here
        acceptSuggestion();
      }
    }
  });

  /******************************
   * PLACEHOLDER: normal acceptSuggestion
   ******************************/
  function acceptSuggestion() {
    if (!suggestionSpan) return;
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = document.createDocumentFragment();
    Array.from(suggestionSpan.childNodes).forEach(node => frag.appendChild(node.cloneNode(true)));
    range.insertNode(frag);
    suggestionSpan.remove();
    suggestionSpan = null;
    typeCount++;
    placeCaretAtEnd(editor);
  }
});
