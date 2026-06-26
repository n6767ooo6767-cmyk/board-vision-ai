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
let engine = null;

const icons = {
  wp: "♙", wr: "♖", wn: "♘", wb: "♗", wq: "♕", wk: "♔",
  bp: "♟", br: "♜", bn: "♞", bb: "♝", bq: "♛", bk: "♚"
};

function startEngine() {
  if (typeof STOCKFISH === "function") {
    engine = STOCKFISH();
    engine.postMessage("uci");
  } else {
    alert("Stockfish не загрузился. Проверь интернет или CDN.");
  }
}

function renderBoard() {
  boardEl.innerHTML = "";

  const position = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      square.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      const coord = toCoord(r, c);
      square.dataset.coord = coord;

      if (selected === coord) {
        square.classList.add("selected");
      }

      const piece = position[r][c];

      if (piece) {
        square.textContent = icons[piece.color + piece.type];
      }

      square.onclick = () => clickSquare(coord);

      boardEl.appendChild(square);
    }
  }
}

function clickSquare(coord) {
  if (!gameStarted) return;
  if (game.turn() !== "w") return;

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

  if (move) {
    addMove("Ты", move);
    afterMove();

    if (!game.game_over()) {
      setTimeout(botMove, 400);
    }
  } else {
    speak("Так нельзя ходить");
    statusEl.textContent = "Нелегальный ход";
  }

  renderBoard();
}

function botMove() {
  if (!engine) {
    randomBotMove();
    return;
  }

  const level = Number(levelEl.value);
  const depth = Math.max(1, Math.min(15, level + 2));

  statusEl.textContent = "Бот думает...";

  engine.postMessage("position fen " + game.fen());
  engine.postMessage("go depth " + depth);

  engine.onmessage = function (event) {
    const line = event.data || event;

    if (typeof line === "string" && line.startsWith("bestmove")) {
      const bestMove = line.split(" ")[1];

      if (!bestMove || bestMove === "(none)") {
        statusEl.textContent = "У бота нет ходов";
        return;
      }

      const from = bestMove.slice(0, 2);
      const to = bestMove.slice(2, 4);
      const promotion = bestMove.slice(4, 5) || "q";

      const move = game.move({
        from,
        to,
        promotion
      });

      if (move) {
        speak(describeMove(move));
        addMove("Бот", move);
        afterMove();
        renderBoard();
      }
    }
  };
}

function randomBotMove() {
  const moves = game.moves({ verbose: true });

  if (moves.length === 0) {
    afterMove();
    return;
  }

  const move = moves[Math.floor(Math.random() * moves.length)];
  const played = game.move(move);

  speak(describeMove(played));
  addMove("Бот", played);
  afterMove();
  renderBoard();
}

function afterMove() {
  if (game.in_checkmate()) {
    gameStarted = false;
    const winner = game.turn() === "w" ? "Чёрные выиграли. Мат." : "Белые выиграли. Мат.";
    statusEl.textContent = winner;
    speak(winner);
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
  li.textContent = `${who}: ${move.from} → ${move.to}`;
  movesEl.appendChild(li);
}

function describeMove(move) {
  const names = {
    p: "пешку",
    n: "коня",
    b: "слона",
    r: "ладью",
    q: "ферзя",
    k: "короля"
  };

  return `Передвинь ${names[move.piece]} с ${move.from} на ${move.to}`;
}

function toCoord(r, c) {
  const files = "abcdefgh";
  return files[c] + (8 - r);
}

function userTextMove(text) {
  if (!gameStarted || game.turn() !== "w") return;

  const raw = text.toLowerCase().replace(/\s/g, "");
  const match = raw.match(/^([a-h][1-8])([a-h][1-8])$/);

  if (!match) {
    speak("Напиши ход в формате e2e4");
    return;
  }

  const move = game.move({
    from: match[1],
    to: match[2],
    promotion: "q"
  });

  if (move) {
    addMove("Ты", move);
    afterMove();
    renderBoard();

    if (!game.game_over()) {
      setTimeout(botMove, 400);
    }
  } else {
    speak("Так нельзя ходить");
    statusEl.textContent = "Нелегальный ход";
  }
}

function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ru-RU";
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
    alert("Голосовой ввод работает не во всех браузерах. Попробуй Chrome.");
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = "ru-RU";
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
voiceBtn.onclick = startVoiceInput;

levelEl.oninput = () => {
  levelText.textContent = levelEl.value;
};

startEngine();
renderBoard();
