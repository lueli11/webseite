const state = {
  token: localStorage.getItem("token") || "",
  user: null,
  socket: null,
  rooms: [],
  room: null,
  screen: "dashboard",
  trickFlashCards: [],
  trickFlashVisible: false,
  trickFlashTimeoutId: null,
  lastSeenTrickKey: null
};

const elements = {
  authPanel: document.getElementById("authPanel"),
  authMessage: document.getElementById("authMessage"),
  appPanel: document.getElementById("appPanel"),
  dashboardScreen: document.getElementById("dashboardScreen"),
  tableScreen: document.getElementById("tableScreen"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginUsername: document.getElementById("loginUsername"),
  loginPassword: document.getElementById("loginPassword"),
  registerUsername: document.getElementById("registerUsername"),
  registerPassword: document.getElementById("registerPassword"),
  userLabel: document.getElementById("userLabel"),
  connectionStatus: document.getElementById("connectionStatus"),
  statusMessage: document.getElementById("statusMessage"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  activeRooms: document.getElementById("activeRooms"),
  roomCode: document.getElementById("roomCode"),
  backToDashboardBtn: document.getElementById("backToDashboardBtn"),
  startGameBtn: document.getElementById("startGameBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  resetMatchBtn: document.getElementById("resetMatchBtn"),
  scoreBoard: document.getElementById("scoreBoard"),
  gameInfo: document.getElementById("gameInfo"),
  modeButtons: document.getElementById("modeButtons"),
  tableSeats: document.getElementById("tableSeats"),
  trickLayer: document.getElementById("trickLayer"),
  trickFlash: document.getElementById("trickFlash"),
  hand: document.getElementById("hand"),
  logoutBtn: document.getElementById("logoutBtn")
};

const seatLabels = ["Sitz 1", "Sitz 2", "Sitz 3", "Sitz 4"];
const seatPositions = ["top", "right", "bottom", "left"];
const suitSymbols = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663"
};
const suitNames = {
  S: "Schaufel",
  H: "Herz",
  D: "Ecke",
  C: "Kreuz"
};
const rankDisplay = {
  A: "A",
  K: "K",
  Q: "D",
  J: "B",
  "10": "10",
  "9": "9",
  "8": "8",
  "7": "7",
  "6": "6"
};
const rankNames = {
  A: "Ass",
  K: "Koenig",
  Q: "Dame",
  J: "Bauer"
};
const pipLayouts = {
  A: [{ x: 50, y: 50, large: true }],
  "10": [
    { x: 27, y: 17 },
    { x: 50, y: 17 },
    { x: 73, y: 17 },
    { x: 27, y: 34 },
    { x: 73, y: 34 },
    { x: 27, y: 66, flip: true },
    { x: 73, y: 66, flip: true },
    { x: 27, y: 83, flip: true },
    { x: 50, y: 83, flip: true },
    { x: 73, y: 83, flip: true }
  ],
  "9": [
    { x: 27, y: 17 },
    { x: 50, y: 17 },
    { x: 73, y: 17 },
    { x: 27, y: 34 },
    { x: 73, y: 34 },
    { x: 50, y: 50, large: true },
    { x: 27, y: 66, flip: true },
    { x: 73, y: 66, flip: true },
    { x: 50, y: 83, flip: true }
  ],
  "8": [
    { x: 27, y: 18 },
    { x: 73, y: 18 },
    { x: 27, y: 34 },
    { x: 73, y: 34 },
    { x: 27, y: 66, flip: true },
    { x: 73, y: 66, flip: true },
    { x: 27, y: 82, flip: true },
    { x: 73, y: 82, flip: true }
  ],
  "7": [
    { x: 27, y: 18 },
    { x: 73, y: 18 },
    { x: 27, y: 35 },
    { x: 73, y: 35 },
    { x: 50, y: 50, large: true },
    { x: 27, y: 82, flip: true },
    { x: 73, y: 82, flip: true }
  ],
  "6": [
    { x: 27, y: 18 },
    { x: 73, y: 18 },
    { x: 27, y: 35 },
    { x: 73, y: 35 },
    { x: 27, y: 82, flip: true },
    { x: 73, y: 82, flip: true }
  ]
};
const svgNs = "http://www.w3.org/2000/svg";

function setToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem("token", state.token);
  } else {
    localStorage.removeItem("token");
  }
}

function setStatusMessage(message) {
  const text = message || "";
  elements.statusMessage.textContent = text;
  elements.authMessage.textContent = text;
}

function setConnectionStatus(text) {
  elements.connectionStatus.textContent = text;
}

function suitClass(suit) {
  return suit === "H" || suit === "D" ? "red" : "black";
}

function createSuitSvg(suit) {
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  if (suit === "H") {
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", "M12 21.2C10.4 19.7 8.8 18.3 7.3 17C4.1 14.1 2 11.9 2 8.8C2 6.2 4.1 4 6.8 4C8.3 4 9.8 4.7 10.8 5.9L12 7.3L13.2 5.9C14.2 4.7 15.7 4 17.2 4C19.9 4 22 6.2 22 8.8C22 11.9 19.9 14.1 16.7 17C15.2 18.3 13.6 19.7 12 21.2Z");
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }

  if (suit === "D") {
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", "M12 2.2L20.4 12L12 21.8L3.6 12Z");
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }

  if (suit === "C") {
    const c1 = document.createElementNS(svgNs, "circle");
    c1.setAttribute("cx", "12");
    c1.setAttribute("cy", "7.8");
    c1.setAttribute("r", "3.8");
    c1.setAttribute("fill", "currentColor");

    const c2 = document.createElementNS(svgNs, "circle");
    c2.setAttribute("cx", "7.6");
    c2.setAttribute("cy", "12.4");
    c2.setAttribute("r", "3.8");
    c2.setAttribute("fill", "currentColor");

    const c3 = document.createElementNS(svgNs, "circle");
    c3.setAttribute("cx", "16.4");
    c3.setAttribute("cy", "12.4");
    c3.setAttribute("r", "3.8");
    c3.setAttribute("fill", "currentColor");

    const stem = document.createElementNS(svgNs, "path");
    stem.setAttribute("d", "M10.3 14.6H13.7L15.6 21H8.4Z");
    stem.setAttribute("fill", "currentColor");

    svg.appendChild(c1);
    svg.appendChild(c2);
    svg.appendChild(c3);
    svg.appendChild(stem);
    return svg;
  }

  const path = document.createElementNS(svgNs, "path");
  path.setAttribute("d", "M12 2.6C14.3 6.4 20.2 9.2 20.2 13.8C20.2 16.8 17.8 19.2 14.8 19.2C13.6 19.2 12.5 18.8 11.6 18L12 14.8H12L12.4 18C11.5 18.8 10.4 19.2 9.2 19.2C6.2 19.2 3.8 16.8 3.8 13.8C3.8 9.2 9.7 6.4 12 2.6ZM10.3 14.6H13.7L15.6 21H8.4Z");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

function createSuitIcon(suit, sizeClass) {
  const icon = document.createElement("span");
  icon.className = `suit-icon ${sizeClass} ${suitClass(suit)}`;
  icon.appendChild(createSuitSvg(suit));
  return icon;
}

function isFigureRank(rank) {
  return rank === "K" || rank === "Q" || rank === "J";
}

function createPipLayout(card) {
  const grid = document.createElement("div");
  grid.className = "pip-grid";
  const layout = pipLayouts[card.rank] || [];

  layout.forEach((pip) => {
    const pipNode = document.createElement("span");
    pipNode.className = `pip ${pip.large ? "large" : "small"} ${pip.flip ? "flip" : ""}`;
    pipNode.style.setProperty("--x", `${pip.x}%`);
    pipNode.style.setProperty("--y", `${pip.y}%`);
    pipNode.appendChild(createSuitIcon(card.suit, pip.large ? "mid" : "tiny"));
    grid.appendChild(pipNode);
  });

  return grid;
}

function createFigureArt(card) {
  const center = document.createElement("div");
  center.className = "figure-center";

  const frame = document.createElement("div");
  frame.className = "figure-frame";

  const crown = document.createElement("div");
  crown.className = "figure-crown";
  crown.textContent = card.rank === "K" ? "\u265B" : card.rank === "Q" ? "\u273F" : "\u2694";

  const bust = document.createElement("div");
  bust.className = "figure-bust";
  bust.textContent = rankDisplay[card.rank] || card.rank;

  const suit = createSuitIcon(card.suit, "mid");
  suit.classList.add("figure-suit");

  const title = document.createElement("div");
  title.className = "figure-title";
  title.textContent = rankNames[card.rank] || card.rank;

  frame.appendChild(crown);
  frame.appendChild(bust);
  frame.appendChild(suit);
  center.appendChild(frame);
  center.appendChild(title);
  return center;
}

function makeCardFace(card, options = {}) {
  const { small = false, legal = false } = options;
  const rank = rankDisplay[card.rank] || card.rank;

  const face = document.createElement("div");
  face.className = `fr-card ${suitClass(card.suit)} ${small ? "small" : ""} ${legal ? "legal" : ""}`;

  const top = document.createElement("span");
  top.className = "corner top";
  const topRank = document.createElement("span");
  topRank.textContent = rank;
  top.appendChild(topRank);
  top.appendChild(createSuitIcon(card.suit, "tiny"));

  const center = document.createElement("div");
  center.className = "card-center";
  center.appendChild(isFigureRank(card.rank) ? createFigureArt(card) : createPipLayout(card));

  const bottom = document.createElement("span");
  bottom.className = "corner bottom";
  const bottomRank = document.createElement("span");
  bottomRank.textContent = rank;
  bottom.appendChild(bottomRank);
  bottom.appendChild(createSuitIcon(card.suit, "tiny"));

  face.appendChild(top);
  face.appendChild(center);
  face.appendChild(bottom);
  face.title = `${rankNames[card.rank] || rank} ${suitNames[card.suit] || card.suit}`;
  return face;
}

function clearTrickFlash() {
  if (state.trickFlashTimeoutId) {
    clearTimeout(state.trickFlashTimeoutId);
    state.trickFlashTimeoutId = null;
  }
  state.trickFlashVisible = false;
  state.trickFlashCards = [];
}

function showTrickFlash(cards) {
  clearTrickFlash();
  state.trickFlashCards = cards.slice();
  state.trickFlashVisible = true;

  state.trickFlashTimeoutId = setTimeout(() => {
    state.trickFlashVisible = false;
    state.trickFlashCards = [];
    state.trickFlashTimeoutId = null;
    renderTable();
  }, 5000);
}

function maybeTriggerTrickFlash(roomState) {
  const game = roomState?.game;
  const history = game?.trickHistory || [];
  if (!history.length) {
    return;
  }

  const last = history[history.length - 1];
  const key = `${roomState.code}:${last.trickIndex}`;

  if (state.lastSeenTrickKey === key) {
    return;
  }

  state.lastSeenTrickKey = key;

  if (game.trick && game.trick.length > 0) {
    return;
  }

  showTrickFlash(last.cards || []);
}

function modeButtonLabel(mode) {
  const value = String(mode?.value || "");
  if (value.startsWith("trump:")) {
    const suit = value.split(":")[1];
    const symbol = suitSymbols[suit] || "";
    return `${mode.label} ${symbol}`.trim();
  }
  return mode.label;
}
function getPreferredRoomCode() {
  if (state.user?.lastRoomCode) {
    return state.user.lastRoomCode;
  }
  return localStorage.getItem("lastRoomCode") || null;
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request fehlgeschlagen (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function emitAck(event, payload = {}) {
  if (!state.socket || !state.socket.connected) {
    throw new Error("Keine aktive Verbindung.");
  }

  return new Promise((resolve, reject) => {
    state.socket.emit(event, payload, (result) => {
      if (!result || !result.ok) {
        reject(new Error(result?.error || "Aktion fehlgeschlagen."));
        return;
      }
      resolve(result);
    });
  });
}

function renderDashboard() {
  elements.activeRooms.innerHTML = "";

  if (!state.rooms.length) {
    elements.activeRooms.innerHTML = "<div class='room-empty'>Keine aktiven Tische vorhanden.</div>";
    return;
  }

  state.rooms.forEach((room) => {
    const card = document.createElement("article");
    card.className = "active-room-card";

    const head = document.createElement("div");
    head.className = "active-room-head";

    const title = document.createElement("strong");
    title.textContent = room.code;

    const phase = document.createElement("span");
    phase.className = `room-phase ${room.phase === "playing" ? "playing" : ""}`;
    phase.textContent = room.phase === "playing" ? "Laeuft" : room.phase === "round_over" ? "Runde fertig" : "Wartet";

    head.appendChild(title);
    head.appendChild(phase);

    const players = document.createElement("div");
    players.className = "active-room-meta";
    players.textContent = `${room.seatsTaken}/4 Spieler`;

    const joinBtn = document.createElement("button");
    joinBtn.dataset.roomCode = room.code;
    joinBtn.textContent = "Tisch beitreten";

    card.appendChild(head);
    card.appendChild(players);
    card.appendChild(joinBtn);

    elements.activeRooms.appendChild(card);
  });
}

function renderTableSeats(room, game) {
  elements.tableSeats.innerHTML = "";

  room.players.forEach((player, seat) => {
    const marker = document.createElement("div");
    marker.className = `table-seat ${seatPositions[seat]}`;

    if (player?.isSelf) {
      marker.classList.add("self");
    }
    if (game && game.turnSeat === seat) {
      marker.classList.add("turn");
    }

    const name = document.createElement("div");
    name.className = "table-seat-name";
    name.textContent = player ? player.username : "Frei";

    const info = document.createElement("div");
    info.className = "table-seat-info";
    info.textContent = seatLabels[seat];

    marker.appendChild(name);
    marker.appendChild(info);
    elements.tableSeats.appendChild(marker);
  });
}

function renderTrick(room, game) {
  elements.trickLayer.innerHTML = "";

  if (!game || !game.trick || !game.trick.length) {
    const empty = document.createElement("div");
    empty.className = "trick-empty";
    empty.textContent = state.trickFlashVisible ? "" : "Stich ist leer";
    elements.trickLayer.appendChild(empty);
    return;
  }

  game.trick.forEach((entry) => {
    const slot = document.createElement("div");
    slot.className = `trick-slot ${seatPositions[entry.seat]}`;

    const owner = document.createElement("div");
    owner.className = "trick-owner";
    owner.textContent = room.players[entry.seat]?.username || seatLabels[entry.seat];

    slot.appendChild(owner);
    slot.appendChild(makeCardFace(entry.card, { small: true }));
    elements.trickLayer.appendChild(slot);
  });
}

function renderTrickFlash() {
  elements.trickFlash.innerHTML = "";
  elements.trickFlash.classList.toggle("hidden", !state.trickFlashVisible);

  if (!state.trickFlashVisible || !state.trickFlashCards.length) {
    return;
  }

  state.trickFlashCards.forEach((entry) => {
    const slot = document.createElement("div");
    slot.className = `flash-slot ${seatPositions[entry.seat]}`;
    slot.appendChild(makeCardFace(entry.card, { small: true }));
    elements.trickFlash.appendChild(slot);
  });
}

function renderHand(room, game) {
  elements.hand.innerHTML = "";

  const viewerSeat = room.viewerSeat;
  if (viewerSeat < 0) {
    elements.hand.innerHTML = "<div class='room-empty'>Du bist Zuschauer. Keinen Kartenzugriff.</div>";
    return;
  }

  const hand = Array.isArray(game?.hands?.[viewerSeat]) ? game.hands[viewerSeat] : [];
  if (!hand.length) {
    elements.hand.innerHTML = "<div class='room-empty'>Keine Karten auf der Hand.</div>";
    return;
  }

  hand.forEach((card) => {
    const legal = (game.allowedCardIds || []).includes(card.id);
    const button = document.createElement("button");
    button.className = "hand-card-button";
    button.dataset.cardId = card.id;

    if (!legal || game.phase !== "playing") {
      button.disabled = true;
    }

    button.appendChild(makeCardFace(card, { legal }));
    elements.hand.appendChild(button);
  });
}

function renderScore(room, game) {
  elements.scoreBoard.innerHTML = "";

  if (!game) {
    elements.scoreBoard.innerHTML = "<div class='score-box'>Noch keine Runde gestartet.</div>";
    return;
  }

  const team1 = `${room.players[0]?.username || "-"} und ${room.players[2]?.username || "-"}`;
  const team2 = `${room.players[1]?.username || "-"} und ${room.players[3]?.username || "-"}`;

  const teams = [
    { label: `Team: ${team1}`, total: game.teamPoints[0], round: game.roundPoints[0] },
    { label: `Team: ${team2}`, total: game.teamPoints[1], round: game.roundPoints[1] }
  ];

  teams.forEach((team) => {
    const box = document.createElement("div");
    box.className = "score-box";
    box.innerHTML = `<strong>${team.label}</strong><div>Total: ${team.total}</div><div>Runde: ${team.round}</div>`;
    elements.scoreBoard.appendChild(box);
  });
}

function renderTable() {
  const room = state.room;
  const game = room?.game || null;

  if (!room) {
    elements.roomCode.textContent = "-";
    elements.scoreBoard.innerHTML = "";
    elements.gameInfo.textContent = "";
    elements.modeButtons.innerHTML = "";
    elements.tableSeats.innerHTML = "";
    elements.trickLayer.innerHTML = "";
    elements.trickFlash.innerHTML = "";
    elements.trickFlash.classList.add("hidden");
    elements.hand.innerHTML = "";
    return;
  }

  elements.roomCode.textContent = room.code;

  renderScore(room, game);
  renderTableSeats(room, game);
  renderTrick(room, game);
  renderTrickFlash();
  renderHand(room, game);

  if (!game) {
    elements.gameInfo.textContent = "Warte auf vier Spieler und starte dann die Runde.";
    elements.modeButtons.innerHTML = "";
  } else if (game.phase === "waiting_mode") {
    elements.gameInfo.textContent = `Trumpfwahl: ${seatLabels[game.chooserSeat]}`;
  } else if (game.phase === "playing") {
    elements.gameInfo.textContent = `Modus: ${game.modeLabel || "-"} | Am Zug: ${seatLabels[game.turnSeat]}`;
  } else {
    elements.gameInfo.textContent = "Runde beendet. Naechste Runde starten oder Match reset.";
  }

  elements.modeButtons.innerHTML = "";
  (game?.availableModes || []).forEach((mode) => {
    const btn = document.createElement("button");
    btn.dataset.mode = mode.value;
    btn.textContent = modeButtonLabel(mode);
    elements.modeButtons.appendChild(btn);
  });

  const canStart = Boolean(
    room.viewerSeat !== -1 &&
      room.hasFourPlayers &&
      (!game || game.phase === "round_over" || game.phase === "waiting_mode")
  );

  elements.startGameBtn.disabled = !canStart;
  elements.nextRoundBtn.disabled = !(game && game.phase === "round_over");
  elements.resetMatchBtn.disabled = !game;
}

function render() {
  const loggedIn = Boolean(state.user);

  elements.authPanel.classList.toggle("hidden", loggedIn);
  elements.appPanel.classList.toggle("hidden", !loggedIn);

  if (!loggedIn) {
    return;
  }

  elements.userLabel.textContent = state.user.username;

  const onTable = state.screen === "table" && Boolean(state.room);
  elements.dashboardScreen.classList.toggle("hidden", onTable);
  elements.tableScreen.classList.toggle("hidden", !onTable);

  renderDashboard();
  renderTable();
}

function connectSocket() {
  if (!state.token || !state.user) {
    return;
  }

  if (state.socket) {
    state.socket.disconnect();
  }

  state.socket = io({
    auth: {
      token: state.token
    }
  });

  let autoJoinAttempted = false;

  state.socket.on("connect", () => {
    setConnectionStatus("verbunden");
    setStatusMessage("");
    state.socket.emit("rooms:list:request");

    if (autoJoinAttempted) {
      return;
    }

    const preferredRoomCode = getPreferredRoomCode();
    if (!preferredRoomCode) {
      return;
    }

    autoJoinAttempted = true;
    state.socket.emit("room:join", { code: preferredRoomCode }, (result) => {
      if (!result?.ok) {
        localStorage.removeItem("lastRoomCode");
        if (state.user) {
          state.user.lastRoomCode = null;
        }
      }
    });
  });

  state.socket.on("disconnect", () => {
    setConnectionStatus("getrennt");
  });

  state.socket.on("connect_error", (error) => {
    setConnectionStatus("Fehler");
    setStatusMessage(error.message || "Verbindung fehlgeschlagen");
  });

  state.socket.on("rooms:list", (payload) => {
    state.rooms = Array.isArray(payload) ? payload : [];
    renderDashboard();
  });

  state.socket.on("room:state", (payload) => {
    const previousRoomCode = state.room?.code || null;
    const newRoomCode = payload?.code || null;
    const roomChanged = previousRoomCode !== newRoomCode;

    state.room = payload;

    if (newRoomCode) {
      state.screen = "table";
      localStorage.setItem("lastRoomCode", newRoomCode);
      if (state.user) {
        state.user.lastRoomCode = newRoomCode;
      }
    }

    if (roomChanged) {
      clearTrickFlash();
      const history = payload?.game?.trickHistory || [];
      if (newRoomCode && history.length > 0) {
        const last = history[history.length - 1];
        state.lastSeenTrickKey = `${newRoomCode}:${last.trickIndex}`;
      } else {
        state.lastSeenTrickKey = null;
      }
    }

    if (!roomChanged) {
      maybeTriggerTrickFlash(payload);
    }

    render();
  });

  state.socket.on("session:replaced", (payload) => {
    setStatusMessage(payload?.message || "Diese Sitzung wurde ersetzt.");
  });
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: elements.loginUsername.value,
        password: elements.loginPassword.value
      })
    });

    setToken(result.token);
    state.user = result.user;
    state.screen = "dashboard";
    connectSocket();
    render();
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: elements.registerUsername.value,
        password: elements.registerPassword.value
      })
    });

    setToken(result.token);
    state.user = result.user;
    state.screen = "dashboard";
    connectSocket();
    render();
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.createRoomBtn.addEventListener("click", async () => {
  try {
    const result = await emitAck("room:create");
    localStorage.setItem("lastRoomCode", result.code);
    if (state.user) {
      state.user.lastRoomCode = result.code;
    }
    setStatusMessage(`Tisch ${result.code} erstellt.`);
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.activeRooms.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-room-code]");
  if (!button) {
    return;
  }

  try {
    const code = String(button.dataset.roomCode || "").trim().toUpperCase();
    await emitAck("room:join", { code });
    localStorage.setItem("lastRoomCode", code);
    if (state.user) {
      state.user.lastRoomCode = code;
    }
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.backToDashboardBtn.addEventListener("click", async () => {
  try {
    await emitAck("room:leave");
    state.room = null;
    state.screen = "dashboard";
    localStorage.removeItem("lastRoomCode");
    if (state.user) {
      state.user.lastRoomCode = null;
    }
    clearTrickFlash();
    state.lastSeenTrickKey = null;
    render();
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.startGameBtn.addEventListener("click", async () => {
  try {
    await emitAck("game:start");
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.nextRoundBtn.addEventListener("click", async () => {
  try {
    await emitAck("game:nextRound");
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.resetMatchBtn.addEventListener("click", async () => {
  try {
    await emitAck("game:resetMatch");
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.modeButtons.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-mode]");
  if (!button) {
    return;
  }

  try {
    await emitAck("game:chooseMode", { mode: button.dataset.mode });
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.hand.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-card-id]");
  if (!button) {
    return;
  }

  try {
    await emitAck("game:playCard", { cardId: button.dataset.cardId });
  } catch (error) {
    setStatusMessage(error.message);
  }
});

elements.logoutBtn.addEventListener("click", async () => {
  try {
    if (state.token) {
      await api("/api/logout", { method: "POST" });
    }
  } catch (error) {
    setStatusMessage(error.message);
  }

  if (state.socket) {
    state.socket.disconnect();
  }
  clearTrickFlash();
  state.lastSeenTrickKey = null;
  setToken("");
  localStorage.removeItem("lastRoomCode");
  state.user = null;
  state.room = null;
  state.rooms = [];
  state.screen = "dashboard";
  render();
});

async function bootstrap() {
  render();

  if (!state.token) {
    return;
  }

  try {
    const me = await api("/api/me");
    state.user = me.user;
    connectSocket();
  } catch (error) {
    if (error.status === 401) {
      setToken("");
      localStorage.removeItem("lastRoomCode");
      state.user = null;
      state.room = null;
      state.rooms = [];
    }
    setStatusMessage(error.status === 401 ? "Session abgelaufen. Bitte neu einloggen." : "Server nicht erreichbar.");
  }

  render();
}

bootstrap();