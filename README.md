Overview
An Apparition (stylised as “an /a)ppar/i)tion”) is an interactive text-based installation that makes visible the gendered biases embedded in language models and predictive text systems. The work invites visitors to write personal narratives while an algorithmic system trained on gendered Reddit communities offers real-time text predictions, creating a collaborative writing experience that subtly shapes and constrains the story being told.

The piece takes the form of an editor interface styled to evoke analog writing experiences—cream paper, typewriter-inspired typography, and a contemplative aesthetic. As users type phrases like 'I am feeling...' the system offers predictive suggestions drawn from one of two distinct language models: one trained exclusively on masculine-coded online discourse, the other on feminine-coded discourse. The choice of corpus is determined by gendered keywords in the user's writing, creating an invisible algorithmic apparatus that both reflects and reinforces gender norms through language.


Context
Language models, from autocomplete systems to large language models, are not neutral technologies. They learn patterns from training data that reflects existing social biases, including gendered assumptions about emotion, behavior, and expression. These biases become particularly insidious in predictive text systems because they operate transparently—users incorporate AI suggestions into their own writing without recognizing how their expression is being shaped by algorithmic recommendations.

This work responds to research showing that AI text generation systems reproduce and amplify gender stereotypes, associating masculine language with authority, action, and rationality, while feminine language becomes linked to emotion, appearance, and passivity. Rather than presenting this as abstract critique, the piece makes these dynamics experiential and visceral.


Method
The work uses several design strategies to make invisible algorithmic bias visible and felt:

    Visual encoding of gender bias: Accepted suggestions from the masculine corpus appear in a bold blue, growing slightly in scale, while feminine suggestions render in soft pink and gradually fade in opacity with each accepted prediction. This creates a visual 'fatigue' effect where feminine language literally becomes harder to read over time, mirroring how certain forms of expression become marginalized.
    Keyword-based corpus switching: The system analyzes the last three words typed for gendered keywords (he/him vs. she/her, strong/brave vs. soft/gentle, etc.) and switches between masculine and feminine training corpora accordingly. This creates a feedback loop where gendered language triggers gendered predictions, which when accepted, trigger more of the same.
    Markov chain generation: Rather than using commercial language models, the work implements a custom text prediction system using Markov chains with 1-gram and 2-gram context windows. This deliberately simple approach makes the mechanics of prediction more transparent and controllable, while still producing recognizably 'AI-like' suggestions.


Technical challenges

    Maintaining typing flow: Predictions must appear quickly enough to feel responsive but not so fast they interrupt the user's thought process. Solved through a 1000ms delay timer that resets on each keystroke, only triggering prediction after a natural pause.
    Preserving text structure: When users accept predictions, the system must maintain formatting, whitespace, and cursor position. The code uses contenteditable on a <div> rather than a textarea, allowing fine-grained control over the DOM. Accepted ghost text is converted to committed <span> elements with appropriate classes, then the caret is programmatically repositioned using the Selection API.
    Corpus switching logic: The system needs to recognize gendered context from partial text without being overly rigid. The solution: maintain two keyword arrays (MASC_KEYWORDS and FEM_KEYWORDS) and scan the last three words of user input. This provides enough context to catch gendered language while not requiring perfect grammatical structures.
    Mobile responsiveness: The piece needed to work on gallery iPads and visitor phones. CSS media queries handle layout scaling, but the more subtle challenge was making contenteditable behave consistently across iOS Safari, which has quirky cursor behavior. Extensive testing led to specific focus() and range positioning code that works across browsers.


User experience
an /a)ppar/i)tion will be exhibited as part of 'ghost in the loop' at The Photographers' Gallery, an exhibit that ‘explore the cultural, societal, emotional, and aesthetic implications of creating art for—and with—machines.’ The work will be presented online where visitors can sit and write for extended periods.

Unlike many interactive installations that encourage quick engagement, this piece is designed for slow, sustained interaction. The gendered bias effects become most apparent after writing several sentences and accepting multiple predictions, creating a cumulative experience where the algorithmic shaping of language becomes increasingly undeniable. Some visitors may notice the visual changes immediately; others may only realise retrospectively that their writing has been subtly guided.

The title—an /a)ppar/i)tion—plays on both 'apparition' (a ghostly presence) and 'parition' (a division or partition), suggesting how AI acts as both a haunting presence in the text and a dividing force that separates masculine from feminine expression. The unconventional typography (/a) and /i)) hints at the code-like structure underlying the work, as well as the Reddit format (r/).


Reflections
This project demonstrates how creative coding can make abstract concepts in AI ethics tangible and experiential. Rather than explaining gender bias in language models through statistics or academic papers, the work lets visitors feel it in their own writing process. The progressive fading of feminine text is particularly effective—many users report a growing discomfort as they realize they're literally erasing certain forms of expression by accepting AI suggestions. The technical implementation balances simplicity and sophistication. Using vanilla JavaScript and a custom Markov model (rather than commercial APIs) keeps the work autonomous, transparent, and exhibitable in offline gallery contexts. The code is intentionally readable and documented, allowing other artists and researchers to adapt or critique the approach.


Future iterations

    Allowing visitors to train their own corpora from personal text histories
    Visualizing the full Markov chain network to show how gendered language clusters
    Expanding beyond binary gender to include non-binary, queer, and intersectional language patterns
    Creating an 'unbiased' mode that actively suggests counter-stereotypical continuations

