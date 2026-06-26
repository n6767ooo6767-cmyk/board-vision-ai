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

const files = "abcdefgh";

const icons = {
  wp: "♙", wr: "♖", wn: "♘", wb: "♗", wq: "♕", wk: "♔",
  bp: "♟", br: "♜", bn: "♞", bb: "♝", bq: "♛", bk: "♚"
};

let selected = null;
let gameStarted = false;
let turn = "w";
let board = initialBoard();

function initialBoard() {
  return [
    ["br","bn","bb","bq","bk","bb","bn","br"],
    ["bp","bp","bp","bp","bp","bp","bp","bp"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["wp","wp","wp","wp","wp","wp","wp","wp"],
    ["wr","wn","wb","wq","wk","wb","wn","wr"]
  ];
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      square.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      if (selected && selected.r === r && selected.c === c) {
        square.classList.add("selected");
      }

      square.textContent = board[r][c] ? icons[board[r][c]] : "";
      square.onclick = () => clickSquare(r, c);

      boardEl.appendChild(square);
    }
  }
}

function clickSquare(r, c) {
  if (!gameStarted || turn !== "w") return;

  const piece = board[r][c];

  if (!selected) {
    if (piece && piece[0] === "w") {
      selected = { r, c };
      renderBoard();
    }
    return;
  }

  const move = {
    from: selected,
    to: { r, c }
  };

  selected = null;

  if (isLegalMove(board, move, "w")) {
    makeMove(move, true);
    setTimeout(botMove, 500);
  } else {
    speak("Так нельзя ходить");
    statusEl.textContent = "Нелегальный ход";
    renderBoard();
  }
}

function makeMove(move, human) {
  const piece = board[move.from.r][move.from.c];

  board[move.to.r][move.to.c] = piece;
  board[move.from.r][move.from.c] = null;

  if (piece === "wp" && move.to.r === 0) board[move.to.r][move.to.c] = "wq";
  if (piece === "bp" && move.to.r === 7) board[move.to.r][move.to.c] = "bq";

  turn = turn === "w" ? "b" : "w";

  const text = `${human ? "Ты" : "Бот"}: ${posToCoord(move.from.r, move.from.c)} → ${posToCoord(move.to.r, move.to.c)}`;
  const li = document.createElement("li");
  li.textContent = text;
  movesEl.appendChild(li);

  statusEl.textContent = turn === "w" ? "Твой ход" : "Бот думает";
  renderBoard();
}

function botMove() {
  if (!gameStarted || turn !== "b") return;

  const moves = generateMoves(board, "b");

  if (moves.length === 0) {
    speak("У меня нет ходов");
    return;
  }

  const level = Number(levelEl.value);
  let move;

  if (level <= 3) {
    move = moves[Math.floor(Math.random() * moves.length)];
  } else {
    move = chooseBestMove(moves);
  }

  speak(describeMove(move));
  makeMove(move, false);
}

function chooseBestMove(moves) {
  let best = moves[0];
  let bestScore = -9999;

  for (const move of moves) {
    const target = board[move.to.r][move.to.c];
    let score = target ? pieceValue(target) : 0;

    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}

function pieceValue(piece) {
  const type = piece[1];
  if (type === "p") return 1;
  if (type === "n") return 3;
  if (type === "b") return 3;
  if (type === "r") return 5;
  if (type === "q") return 9;
  if (type === "k") return 100;
  return 0;
}

function describeMove(move) {
  const piece = board[move.from.r][move.from.c];

  const names = {
    p: "пешку",
    n: "коня",
    b: "слона",
    r: "ладью",
    q: "ферзя",
    k: "короля"
  };

  return `Передвинь ${names[piece[1]]} с ${posToCoord(move.from.r, move.from.c)} на ${posToCoord(move.to.r, move.to.c)}`;
}

function generateMoves(b, color) {
  const moves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = b[r][c];

      if (!piece || piece[0] !== color) continue;

      for (let tr = 0; tr < 8; tr++) {
        for (let tc = 0; tc < 8; tc++) {
          const move = {
            from: { r, c },
            to: { r: tr, c: tc }
          };

          if (isLegalMove(b, move, color)) {
            moves.push(move);
          }
        }
      }
    }
  }

  return moves;
}

function isLegalMove(b, move, color) {
  const piece = b[move.from.r][move.from.c];
  const target = b[move.to.r][move.to.c];

  if (!piece || piece[0] !== color) return false;
  if (target && target[0] === color) return false;

  const dr = move.to.r - move.from.r;
  const dc = move.to.c - move.from.c;
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  const type = piece[1];

  if (type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;

    if (dc === 0 && dr === dir && !target) return true;
    if (dc === 0 && dr === 2 * dir && move.from.r === startRow && !target) return true;
    if (absC === 1 && dr === dir && target) return true;

    return false;
  }

  if (type === "n") {
    return (absR === 2 && absC === 1) || (absR === 1 && absC === 2);
  }

  if (type === "b") {
    return absR === absC && pathClear(b, move);
  }

  if (type === "r") {
    return (dr === 0 || dc === 0) && pathClear(b, move);
  }

  if (type === "q") {
    return (absR === absC || dr === 0 || dc === 0) && pathClear(b, move);
  }

  if (type === "k") {
    return absR <= 1 && absC <= 1;
  }

  return false;
}

function pathClear(b, move) {
  const dr = Math.sign(move.to.r - move.from.r);
  const dc = Math.sign(move.to.c - move.from.c);

  let r = move.from.r + dr;
  let c = move.from.c + dc;

  while (r !== move.to.r || c !== move.to.c) {
    if (b[r][c]) return false;
    r += dr;
    c += dc;
  }

  return true;
}

function posToCoord(r, c) {
  return files[c] + (8 - r);
}

function coordToPos(coord) {
  return {
    r: 8 - Number(coord[1]),
    c: files.indexOf(coord[0])
  };
}

function userTextMove(text) {
  const raw = text.toLowerCase().replace(/\s/g, "");
  const match = raw.match(/^([a-h][1-8])([a-h][1-8])$/);

  if (!match) {
    speak("Напиши ход в формате e2e4");
    return;
  }

  const move = {
    from: coordToPos(match[1]),
    to: coordToPos(match[2])
  };

  if (isLegalMove(board, move, "w")) {
    makeMove(move, true);
    setTimeout(botMove, 500);
  } else {
    speak("Так нельзя ходить");
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
  turn = "w";
  statusEl.textContent = "Игра началась. Ты играешь белыми.";
  speak("Игра началась. Ты играешь белыми.");
};

resetBtn.onclick = () => {
  board = initialBoard();
  selected = null;
  gameStarted = false;
  turn = "w";
  movesEl.innerHTML = "";
  statusEl.textContent = "Новая игра. Нажми Start.";
  renderBoard();
};

moveBtn.onclick = () => userTextMove(moveInput.value);
voiceBtn.onclick = startVoiceInput;

levelEl.oninput = () => {
  levelText.textContent = levelEl.value;
};

renderBoard();
