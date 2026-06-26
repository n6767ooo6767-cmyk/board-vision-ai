const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const levelEl = document.getElementById("level");
const levelText = document.getElementById("levelText");
const cameraBtn = document.getElementById("cameraBtn");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const moveInput = document.getElementById("moveInput");
const moveBtn = document.getElementById("moveBtn");
const voiceBtn = document.getElementById("voiceBtn");
const movesEl = document.getElementById("moves");
const video = document.getElementById("camera");

const game = new Chess();

let selected = null;
let gameStarted = false;

const icons = {
  wp: "♙", wr: "♖", wn: "♘", wb: "♗", wq: "♕", wk: "♔",
  bp: "♟", br: "♜", bn: "♞", bb: "♝", bq: "♛", bk: "♚"
};

const pieceNames = {
  p: "пешку",
  n: "коня",
  b: "слона",
  r: "ладью",
  q: "ферзя",
  k: "короля"
};

function renderBoard() {
  boardEl.innerHTML = "";
  const position = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      square.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      const coord = toCoord(r, c);
      const piece = position[r][c];

      if (selected === coord) square.classList.add("selected");
      if (piece) square.textContent = icons[piece.color + piece.type];

      square.onclick = () => clickSquare(coord);
      boardEl.appendChild(square);
    }
  }
}

function clickSquare(coord) {
  if (!gameStarted || game.turn() !== "w") return;

  const piece = game.get(coord);

  if (!selected) {
    if (piece && piece.color === "w") {
      selected = coord;
      renderBoard();
    }
    return;
  }

  const move = game.move({
    from: selected,
    to: coord,
    promotion: "q"
  });

  selected = null;

  if (!move) {
    statusEl.textContent = "Нелегальный ход";
    speak("Так нельзя ходить");
    renderBoard();
    return;
  }

  addMove("Ты", move);
  afterMove();

  if (!game.game_over()) {
    setTimeout(botMove, 500);
  }

  renderBoard();
}

function botMove() {
  if (!gameStarted || game.turn() !== "b") return;

  const moves = game.moves({ verbose: true });
  if (moves.length === 0) {
    afterMove();
    return;
  }

  const level = Number(levelEl.value);
  let move;

  if (level <= 3) {
    move = moves[Math.floor(Math.random() * moves.length)];
  } else {
    move = chooseBestMove(moves);
  }

  const played = game.move(move);

  speak(describeMove(played));
  addMove("Бот", played);
  afterMove();
  renderBoard();
}

function chooseBestMove(moves) {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

  let best = moves[0];
  let bestScore = -999;

  for (const move of moves) {
    let score = 0;

    if (move.captured) {
      score += values[move.captured] * 10;
    }

    if (move.flags.includes("p")) {
      score += 8;
    }

    if (move.san.includes("+")) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

function afterMove() {
  if (game.in_checkmate()) {
    gameStarted = false;
    const text = game.turn() === "w"
      ? "Чёрные выиграли. Мат."
      : "Белые выиграли. Мат.";
    statusEl.textContent = text;
    speak(text);
    return;
  }

  if (game.in_draw()) {
    gameStarted = false;
    statusEl.textContent = "Ничья";
    speak("Ничья");
    return;
  }

  if (game.in_check()) {
    statusEl.textContent = "Шах";
    speak("Шах");
    return;
  }

  statusEl.textContent = game.turn() === "w" ? "Твой ход" : "Бот думает";
}

function addMove(who, move) {
  const li = document.createElement("li");
  li.textContent = `${who}: ${move.from} → ${move.to} (${move.san})`;
  movesEl.appendChild(li);
  movesEl.scrollTop = movesEl.scrollHeight;
}

function describeMove(move) {
  return `Передвинь ${pieceNames[move.piece]} с ${move.from} на ${move.to}`;
}

function toCoord(r, c) {
  const files = "abcdefgh";
  return files[c] + (8 - r);
}

function userTextMove(text) {
  if (!gameStarted || game.turn() !== "w") return;

  const raw = text
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("на", "")
    .replaceAll("-", "")
    .replaceAll("е", "e")
    .replaceAll("а", "a")
    .replaceAll("б", "b")
    .replaceAll("с", "c")
    .replaceAll("д", "d")
    .replaceAll("ф", "f")
    .replaceAll("г", "g")
    .replaceAll("аш", "h");

  const match = raw.match(/^([a-h][1-8])([a-h][1-8])$/);

  if (!match) {
    speak("Скажи или напиши ход в формате e2 e4");
    return;
  }

  const move = game.move({
    from: match[1],
    to: match[2],
    promotion: "q"
  });

  if (!move) {
    speak("Так нельзя ходить");
    statusEl.textContent = "Нелегальный ход";
    return;
  }

  addMove("Ты", move);
  afterMove();
  renderBoard();

  if (!game.game_over()) {
    setTimeout(botMove, 500);
  }
}

function speak(text) {
  if (!window.speechSynthesis) return;

  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ru-RU";
  msg.rate = 0.95;

  speechSynthesis.cancel();
  speechSynthesis.speak(msg);
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    video.srcObject = stream;
    speak("Камера и микрофон включены");
  } catch (error) {
    alert("Не получилось включить камеру или микрофон");
  }
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Голосовой ввод работает не во всех браузерах. Лучше Chrome.");
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = "ru-RU";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.start();

  rec.onresult = (event) => {
    const text = event.results[0][0].transcript;
    userTextMove(text);
  };
}

cameraBtn.onclick = startCamera;

startBtn.onclick = () => {
  gameStarted = true;
  selected = null;
  statusEl.textContent = "Игра началась. Ты играешь белыми.";
  speak("Игра началась. Ты играешь белыми.");
  renderBoard();
};

resetBtn.onclick = () => {
  game.reset();
  selected = null;
  gameStarted = false;
  movesEl.innerHTML = "";
  statusEl.textContent = "Новая игра. Нажми Start.";
  renderBoard();
};

moveBtn.onclick = () => userTextMove(moveInput.value);

moveInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    userTextMove(moveInput.value);
  }
});

voiceBtn.onclick = startVoiceInput;

levelEl.oninput = () => {
  levelText.textContent = levelEl.value;
};

renderBoard();
