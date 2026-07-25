(() => {
  "use strict";
  const STORAGE_KEY = "wonderlandTreasureHunt";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const defaultState = { current: 0, completed: [], team: "Red Parrots", sound: true, finished: false };
  let state = loadState();
  let selectedAnswer = "";
  let puzzleSolved = false;
  let audioContext;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...defaultState, ...(saved || {}), current: Math.max(0, Math.min(7, Number(saved?.current) || 0)) };
    } catch (_) { return { ...defaultState }; }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const status = $("#savedStatus");
      status.textContent = "✓ Progress saved";
      status.classList.add("flash");
      setTimeout(() => status.classList.remove("flash"), 900);
    } catch (_) { $("#savedStatus").textContent = "Progress active"; }
  }
  function tone(kind = "tap") {
    if (!state.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === "final" ? [523, 659, 784, 1047] : kind === "success" ? [523, 784] : kind === "error" ? [180] : [360];
      notes.forEach((frequency, i) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = kind === "error" ? "sawtooth" : "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime + i * .11);
        gain.gain.exponentialRampToValueAtTime(.06, audioContext.currentTime + i * .11 + .01);
        gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + i * .11 + .13);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(audioContext.currentTime + i * .11);
        oscillator.stop(audioContext.currentTime + i * .11 + .15);
      });
    } catch (_) { /* Audio is optional; gameplay continues silently. */ }
  }
  function setFeedback(message = "", type = "") {
    const box = $("#feedback");
    box.className = `feedback ${type}`.trim();
    box.textContent = message;
  }
  function render() {
    const mission = MISSIONS[state.current];
    selectedAnswer = "";
    puzzleSolved = false;
    $("#teamSelect").value = state.team;
    $("#soundButton").textContent = state.sound ? "🔊 Sound" : "🔇 Sound";
    $("#soundButton").setAttribute("aria-pressed", state.sound);
    $("#missionNumber").textContent = `Mission ${state.current + 1} of 8`;
    $("#missionTitle").textContent = mission.title;
    $("#missionStory").innerHTML = `<p>${mission.story}</p><strong>${mission.puzzle}</strong>`;
    $("#answerInstruction").textContent = mission.typedAnswer ? "Type your answer:" : "Choose the best answer:";
    const choices = $("#choices");
    choices.classList.toggle("typed-answer", Boolean(mission.typedAnswer));
    if (mission.typedAnswer) {
      const input = document.createElement("input");
      input.id = "typedAnswer";
      input.className = "answer-input";
      input.type = "text";
      input.autocomplete = "off";
      input.autocapitalize = "characters";
      input.maxLength = 3;
      input.placeholder = "Type here";
      input.setAttribute("aria-label", "Type your answer");
      const checkButton = document.createElement("button");
      checkButton.type = "button";
      checkButton.className = "choice check-answer";
      checkButton.textContent = "Check answer";
      const checkAnswer = () => selectTypedAnswer(input, checkButton);
      checkButton.addEventListener("click", checkAnswer);
      input.addEventListener("keydown", (event) => { if (event.key === "Enter") checkAnswer(); });
      choices.replaceChildren(input, checkButton);
    } else {
      choices.replaceChildren(...mission.choices.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "choice";
        button.textContent = choice;
        button.addEventListener("click", () => selectChoice(choice, button));
        return button;
      }));
    }
    setFeedback();
    const keySection = $("#keySection");
    keySection.classList.toggle("final-key", Boolean(mission.final));
    $("#keyHeading").textContent = mission.final ? "Final Treasure" : "Treasure Key";
    $("#keyHelp").textContent = mission.final ? "Solve the final puzzle to open the treasure." : "Solve the puzzle to activate the key.";
    $("#keyInputs").hidden = Boolean(mission.final);
    $$(".key-digit").forEach((input) => { input.value = ""; input.disabled = true; });
    const unlock = $("#unlockButton");
    unlock.disabled = true;
    unlock.textContent = mission.final ? "✨ Open the treasure" : "🔒 Solve the puzzle";
    renderMap();
  }
  function renderMap() {
    const points = MISSIONS.map((m) => m.point.join(",")).join(" ");
    $("#routeLine").setAttribute("points", points);
    const nodes = MISSIONS.map((mission, index) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = `mission-node ${index < state.current || state.completed.includes(index) ? "done" : index === state.current ? "current" : "locked"}`;
      node.style.left = `${mission.point[0]}%`;
      node.style.top = `${mission.point[1]}%`;
      node.innerHTML = `<span>${index < state.current || state.completed.includes(index) ? "✓" : index + 1}</span><small>${mission.title}</small>`;
      node.disabled = index !== state.current;
      node.setAttribute("aria-label", `Mission ${index + 1}: ${mission.title}`);
      return node;
    });
    $("#missionNodes").replaceChildren(...nodes);
    const [x, y] = MISSIONS[state.current].point;
    const wooby = $("#wooby");
    wooby.style.left = `${x}%`;
    wooby.style.top = `${y}%`;
    wooby.classList.remove("walking");
    requestAnimationFrame(() => wooby.classList.add("walking"));
  }
  function selectChoice(choice, button) {
    selectedAnswer = choice;
    $$(".choice").forEach((item) => item.classList.remove("selected", "wrong"));
    button.classList.add("selected");
    const mission = MISSIONS[state.current];
    if (choice === mission.answer) {
      puzzleSolved = true;
      button.classList.add("correct");
      tone("success");
      setFeedback(mission.final ? "Brilliant! The treasure is ready to open." : `Correct! Now find the clue at: ${mission.location}.`, "success");
      $$(".key-digit").forEach((input) => input.disabled = false);
      if (!mission.final) $$(".key-digit")[0].focus();
      $("#keyHelp").textContent = mission.final ? "Captain Wooby found the final word!" : `Enter the 3-digit key from ${mission.location}.`;
      $("#unlockButton").disabled = false;
      $("#unlockButton").textContent = mission.final ? "✨ Open the treasure" : "🔓 Unlock next mission";
    } else {
      puzzleSolved = false;
      button.classList.add("wrong");
      tone("error");
      setFeedback("Good try, explorer! Look again and choose another answer.", "error");
      $("#unlockButton").disabled = true;
    }
  }
  function selectTypedAnswer(input, button) {
    const mission = MISSIONS[state.current];
    const answer = input.value.trim().toUpperCase();
    input.classList.remove("correct", "wrong");
    button.classList.remove("correct", "wrong");
    if (answer === mission.answer.toUpperCase()) {
      input.value = mission.answer;
      input.classList.add("correct");
      selectChoice(mission.answer, button);
    } else {
      selectedAnswer = answer;
      puzzleSolved = false;
      input.classList.add("wrong");
      button.classList.add("wrong");
      tone("error");
      setFeedback("Good try, explorer! Unscramble the letters and try again.", "error");
      $("#unlockButton").disabled = true;
      input.focus();
      input.select();
    }
  }
  function unlockMission() {
    const mission = MISSIONS[state.current];
    if (!puzzleSolved) return setFeedback("Solve Captain Wooby’s puzzle first.", "error");
    if (mission.final) return finishGame();
    const code = $$(".key-digit").map((input) => input.value).join("");
    if (code !== mission.code) {
      tone("error");
      $("#keySection").classList.remove("shake");
      requestAnimationFrame(() => $("#keySection").classList.add("shake"));
      return setFeedback("That key does not fit yet. Check the three digits and try again!", "error");
    }
    tone("success");
    state.completed = [...new Set([...state.completed, state.current])];
    state.current = Math.min(7, state.current + 1);
    saveState();
    setFeedback("Mission unlocked! Captain Wooby is moving along the map…", "success");
    setTimeout(render, 700);
  }
  function finishGame() {
    state.completed = [...new Set([...state.completed, 7])];
    state.finished = true;
    saveState();
    tone("final");
    $("#winningTeam").textContent = `${state.team}, you completed all eight missions!`;
    buildConfetti();
    openModal("treasureModal");
  }
  function buildConfetti() {
    const colours = ["#ffd64a", "#ff6b68", "#4ed3a5", "#4aa8ff", "#b777e8"];
    $("#confetti").replaceChildren(...Array.from({ length: 34 }, (_, i) => {
      const piece = document.createElement("i");
      piece.style.cssText = `--x:${(i * 37) % 100}%;--delay:${(i % 9) * -.18}s;--color:${colours[i % colours.length]};--turn:${(i % 5) * 72}deg`;
      return piece;
    }));
  }
  function openModal(id) { const modal = document.getElementById(id); modal.hidden = false; setTimeout(() => modal.classList.add("show"), 10); }
  function closeModal(id) { const modal = document.getElementById(id); modal.classList.remove("show"); setTimeout(() => modal.hidden = true, 180); }
  function openTeacher() {
    $("#pinView").hidden = false; $("#teacherView").hidden = true; $("#pinInput").value = ""; $("#pinFeedback").textContent = "";
    openModal("teacherModal"); setTimeout(() => $("#pinInput").focus(), 220);
  }
  function showTeacherControls() {
    $("#pinView").hidden = true; $("#teacherView").hidden = false;
    $("#teacherCurrent").textContent = `Current mission: ${state.current + 1}. ${MISSIONS[state.current].title}`;
    $("#missionJump").value = state.current;
    $("#teacherSoundButton").textContent = state.sound ? "Turn sound off" : "Turn sound on";
  }
  function setMission(index) {
    state.current = Math.max(0, Math.min(7, Number(index)));
    state.completed = MISSIONS.map((_, i) => i).filter((i) => i < state.current);
    state.finished = false; saveState(); render(); showTeacherControls();
  }
  function resetGame() {
    if (!confirm("Reset the whole adventure? This will erase the saved mission progress.")) return;
    const team = state.team, sound = state.sound;
    state = { ...defaultState, team, sound }; saveState(); render(); closeModal("teacherModal");
  }
  function toggleSound() { state.sound = !state.sound; saveState(); render(); }

  $("#teamSelect").addEventListener("change", (event) => { state.team = event.target.value; saveState(); tone(); });
  $("#soundButton").addEventListener("click", toggleSound);
  $("#hintButton").addEventListener("click", () => { tone(); setFeedback(`💡 ${MISSIONS[state.current].hint}`, "hint"); });
  $("#unlockButton").addEventListener("click", unlockMission);
  $$(".key-digit").forEach((input, index, inputs) => {
    input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, 1); if (input.value && index < 2) inputs[index + 1].focus(); });
    input.addEventListener("keydown", (event) => { if (event.key === "Backspace" && !input.value && index) inputs[index - 1].focus(); if (event.key === "Enter") unlockMission(); });
  });
  $("#teacherButton").addEventListener("click", openTeacher);
  $("#pinButton").addEventListener("click", () => {
    if ($("#pinInput").value === "2026") showTeacherControls();
    else { tone("error"); $("#pinFeedback").textContent = "That PIN is not correct."; }
  });
  $("#pinInput").addEventListener("keydown", (event) => { if (event.key === "Enter") $("#pinButton").click(); });
  $("#missionJump").replaceChildren(...MISSIONS.map((m, i) => new Option(`${i + 1}. ${m.title}`, i)));
  $("#jumpButton").addEventListener("click", () => setMission($("#missionJump").value));
  $("#completeButton").addEventListener("click", () => state.current === 7 ? finishGame() : setMission(state.current + 1));
  $("#changeTeamButton").addEventListener("click", () => { const name = prompt("Enter a team name:", state.team); if (name?.trim()) { state.team = name.trim().slice(0, 28); if (![...$("#teamSelect").options].some(o => o.value === state.team)) $("#teamSelect").add(new Option(state.team, state.team)); saveState(); render(); showTeacherControls(); } });
  $("#teacherSoundButton").addEventListener("click", () => { toggleSound(); showTeacherControls(); });
  $("#resetButton").addEventListener("click", resetGame);
  $$("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button.dataset.close)));
  $("#treasureClose").addEventListener("click", () => closeModal("treasureModal"));
  $$(".modal").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(modal.id); }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") $$(".modal.show").forEach((m) => closeModal(m.id)); });
  window.addEventListener("pagehide", saveState);
  render();
})();
