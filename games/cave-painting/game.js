// Edit this array to change the quiz. Answers ignore capitalization and spaces.
const QUESTIONS = [
  { image: "public/puzzles/puzzle-01.png", clue: "Fire and dog", answer: "hot dog" },
  { image: "public/puzzles/puzzle-02.png", clue: "Snow and man", answer: "snowman" },
  { image: "public/puzzles/puzzle-03.png", clue: "Man and green go signal", answer: "mango" },
  { image: "public/puzzles/puzzle-04.png", clue: "Apple and pie", answer: "apple pie" },
  { image: "public/puzzles/puzzle-05.png", clue: "Home and writing work", answer: "homework" },
  { image: "public/puzzles/puzzle-06.png", clue: "Chicken, Japanese ra, and two men", answer: "chicken ramen" },
  { image: "public/puzzles/puzzle-07.png", clue: "Chocolate, ice, and cream", answer: "chocolate ice cream" },
  { image: "public/puzzles/puzzle-08.png", clue: "Stop sign and watch", answer: "stopwatch" },
  { image: "public/puzzles/puzzle-09.png", clue: "Tea and chair", answer: "teacher" },
  { image: "public/puzzles/puzzle-10.png", clue: "Sun and glasses", answer: "sunglasses" },
];

let current = 0;
let score = 0;
let advanceTimer;
let gameActive = false;
const game = document.querySelector("#game");
const caveWorld = document.querySelector("#cave-world");
const count = document.querySelector("#question-count");
const progress = document.querySelector("#amber-progress");
const progressArea = document.querySelector("#progress-area");
const musicButton = document.querySelector("#music-toggle");
const backgroundMusic = new Audio("public/audio/ooh-ah.mp3?v=2");
backgroundMusic.loop = true;
backgroundMusic.preload = "auto";
backgroundMusic.volume = 0.35;
let musicEnabled = localStorage.getItem("caveMusic") !== "off";

function updateMusicButton() {
  musicButton.classList.toggle("is-on", musicEnabled);
  musicButton.setAttribute("aria-pressed", String(musicEnabled));
  musicButton.setAttribute("aria-label", musicEnabled ? "Turn background music off" : "Turn background music on");
  musicButton.innerHTML = `<span aria-hidden="true">${musicEnabled ? "♫" : "♪"}</span> Music ${musicEnabled ? "On" : "Off"}`;
}

function syncMusic() {
  if (musicEnabled) {
    backgroundMusic.play().catch(() => {});
  } else {
    backgroundMusic.pause();
  }
}

musicButton.addEventListener("click", () => {
  sound("click");
  musicEnabled = !musicEnabled;
  localStorage.setItem("caveMusic", musicEnabled ? "on" : "off");
  updateMusicButton();
  if (gameActive) syncMusic();
});

function sound(kind) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const gain = context.createGain();
  const notes = { click: [180], correct: [523, 659, 784], wrong: [190, 135], victory: [392, 523, 659, 784] }[kind];
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "victory" ? 1 : 0.35));
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = kind === "wrong" ? "sawtooth" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * (kind === "victory" ? 0.18 : 0.08));
    oscillator.stop(context.currentTime + index * 0.18 + 0.2);
  });
  setTimeout(() => context.close(), 1200);
}

function setProgress(value) {
  progress.style.width = `${value}%`;
  progressArea.setAttribute("aria-label", `${Math.round(value)}% complete`);
}

function welcome() {
  caveWorld.classList.add("intro-mode");
  count.hidden = true;
  setProgress(0);
  game.innerHTML = `<section class="intro-screen" aria-label="Cave Painting Emoji Quiz">
    <img class="intro-title-image" src="public/intro-title.png" alt="Cave Painting Emoji Quiz" width="1200" height="675">
    <div class="intro-actions">
      <button class="rock-button primary large" id="start">Enter the Cave <b aria-hidden="true">→</b></button>
      <small>🔊 Best explored with sound on</small>
    </div>
  </section>`;
  document.querySelector("#start").addEventListener("click", start);
}

function start() {
  sound("click");
  caveWorld.classList.remove("intro-mode");
  gameActive = true;
  current = 0;
  score = 0;
  syncMusic();
  showQuestion();
}

function showQuestion() {
  clearTimeout(advanceTimer);
  count.hidden = false;
  count.innerHTML = `Question <strong>${current + 1}</strong> / ${QUESTIONS.length}`;
  setProgress((current / QUESTIONS.length) * 100);
  game.innerHTML = `<section class="quiz-shell" aria-label="Question ${current + 1}">
    <div class="painting-panel">
      <span class="panel-label">Ancient painting #${current + 1}</span>
      <img class="puzzle-image" src="${QUESTIONS[current].image}" alt="Cave painting puzzle showing ${QUESTIONS[current].clue}" width="800" height="500">
      <div class="scratches" aria-hidden="true">╱╱╱ · ᐱ · ╲╲╲</div>
    </div>
    <form class="answer-area" id="answer-form">
      <label for="answer">What word do these paintings make?</label>
      <div class="answer-wrap" id="answer-wrap"><input id="answer" placeholder="Type your answer here…" autocomplete="off"><span class="answer-icon" id="answer-icon"></span></div>
      <div class="feedback" id="feedback" aria-live="assertive"></div>
      <div class="button-row">
        <button class="rock-button primary" id="check" type="submit" disabled>Check Answer</button>
        <button class="rock-button secondary" id="skip" type="button">Skip</button>
        <button class="rock-button icon-button" id="next" type="button">Next <span aria-hidden="true">›</span></button>
      </div>
    </form>
  </section>`;
  const input = document.querySelector("#answer");
  input.focus();
  input.addEventListener("input", () => {
    document.querySelector("#check").disabled = !input.value.trim();
    const wrap = document.querySelector("#answer-wrap");
    wrap.classList.remove("wrong");
    document.querySelector("#answer-icon").textContent = "";
    document.querySelector("#feedback").textContent = "";
  });
  document.querySelector("#answer-form").addEventListener("submit", checkAnswer);
  document.querySelector("#skip").addEventListener("click", nextQuestion);
  document.querySelector("#next").addEventListener("click", nextQuestion);
}

function checkAnswer(event) {
  event.preventDefault();
  const input = document.querySelector("#answer");
  const wrap = document.querySelector("#answer-wrap");
  const feedback = document.querySelector("#feedback");
  const normalize = (text) => text.toLocaleLowerCase().replace(/\s+/g, "").trim();
  sound("click");
  if (normalize(input.value) === normalize(QUESTIONS[current].answer)) {
    score += 1;
    sound("correct");
    wrap.className = "answer-wrap correct";
    document.querySelector("#answer-icon").textContent = "✓";
    feedback.innerHTML = `<span class="correct-message">✓ Correct! The cave agrees!</span>`;
    input.disabled = true;
    document.querySelector("#check").disabled = true;
    setProgress(((current + 1) / QUESTIONS.length) * 100);
    advanceTimer = setTimeout(nextQuestion, 2000);
  } else {
    sound("wrong");
    wrap.className = "answer-wrap wrong shake";
    document.querySelector("#answer-icon").textContent = "!";
    feedback.innerHTML = `<span class="wrong-message">Try again! Look closely…</span>`;
    setTimeout(() => wrap.classList.remove("shake"), 500);
  }
}

function nextQuestion() {
  sound("click");
  if (current === QUESTIONS.length - 1) return finish();
  current += 1;
  showQuestion();
}

function finish() {
  clearTimeout(advanceTimer);
  count.hidden = true;
  setProgress(100);
  sound("victory");
  const message = score === QUESTIONS.length ? "Legendary! You read every ancient painting." : score >= 7 ? "Amazing work! The cave elders are impressed." : "Great exploring! Every mystery makes you wiser.";
  const confetti = Array.from({ length: 24 }, (_, i) => `<i>${i % 3 === 0 ? "🍂" : i % 3 === 1 ? "𓃰" : "🌿"}</i>`).join("");
  game.innerHTML = `<section class="stone-tablet end-tablet" aria-live="polite">
    <div class="confetti" aria-hidden="true">${confetti}</div><span class="victory-icon" aria-hidden="true">🏆</span>
    <h2>🎉 Great Job Explorer! 🎉</h2><p class="score-label">Your expedition score</p>
    <div class="final-score"><strong>${score}</strong><span>/ ${QUESTIONS.length}</span></div>
    <p class="score-message">${message}</p><div class="end-actions">
    <button class="rock-button primary" id="again">Play Again</button><button class="rock-button secondary" id="exit">Exit Cave</button></div>
  </section>`;
  document.querySelector("#again").addEventListener("click", start);
  document.querySelector("#exit").addEventListener("click", () => {
    sound("click");
    gameActive = false;
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    welcome();
  });
}

document.querySelector("#ambient").innerHTML =
  Array.from({ length: 18 }, (_, i) => `<i class="dust dust-${i + 1}"></i>`).join("") +
  `<span class="bat bat-one">⌁</span><span class="bat bat-two">⌁</span><span class="drip drip-one"></span><span class="drip drip-two"></span>`;

welcome();
updateMusicButton();
