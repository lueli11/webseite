require("dotenv").config();

const http = require("http");
const path = require("path");

const express = require("express");
const { Server } = require("socket.io");

const { authenticateHttp, authenticateSocketToken, hashPassword, issueToken, validateCredentials, verifyPassword } = require("./auth");
const { initDb, normalizeUsername } = require("./db");
const { chooseMode, playCard, serializeGameForSeat, startNewRound } = require("./game");

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IN_PRODUCTION";
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), "data", "app.json");

const { statements } = initDb(DB_FILE);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const rooms = new Map();

function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.created_at || null,
    lastRoomCode: user.last_room_code || null
  };
}

function rememberUserRoom(userId, roomCode) {
  statements.updateUserLastRoom.run(roomCode || null, userId);
}

function randomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function createUniqueRoomCode() {
  for (let i = 0; i < 50; i += 1) {
    const code = randomRoomCode();
    if (!rooms.has(code)) {
      return code;
    }
  }
  throw new Error("Konnte keinen freien Raumcode erstellen.");
}

function getSeatByUser(room, userId) {
  return room.players.findIndex((player) => player && player.userId === userId);
}

function findFirstFreeSeat(room) {
  return room.players.findIndex((player) => !player);
}

function roomChannel(code) {
  return `room:${code}`;
}

function buildRoomSummary(room) {
  return {
    code: room.code,
    createdAt: room.createdAt,
    phase: room.game ? room.game.phase : "idle",
    modeLabel: room.game ? room.game.modeLabel || room.game.mode || null : null,
    seatsTaken: room.players.filter((player) => Boolean(player)).length,
    players: room.players.map((player, seat) => {
      if (!player) {
        return null;
      }
      return {
        seat,
        username: player.username,
        connected: player.connected
      };
    })
  };
}

function buildRoomsList() {
  return Array.from(rooms.values())
    .map(buildRoomSummary)
    .sort((a, b) => {
      if (a.phase !== b.phase) {
        if (a.phase === "playing") {
          return -1;
        }
        if (b.phase === "playing") {
          return 1;
        }
      }
      return String(a.code).localeCompare(String(b.code));
    });
}

function emitRoomsList(targetSocketId) {
  const payload = buildRoomsList();
  if (targetSocketId) {
    io.to(targetSocketId).emit("rooms:list", payload);
    return;
  }
  io.emit("rooms:list", payload);
}

function buildRoomState(room, userId) {
  const viewerSeat = getSeatByUser(room, userId);
  const players = room.players.map((player, seat) => {
    if (!player) {
      return {
        seat,
        username: null,
        connected: false,
        isSelf: false
      };
    }
    return {
      seat,
      username: player.username,
      connected: player.connected,
      isSelf: player.userId === userId
    };
  });

  const allSeatsTaken = room.players.every((player) => Boolean(player));

  return {
    code: room.code,
    viewerSeat,
    players,
    hasFourPlayers: allSeatsTaken,
    canStart:
      viewerSeat !== -1 &&
      allSeatsTaken &&
      (!room.game || room.game.phase === "round_over" || room.game.phase === "waiting_mode"),
    game: room.game ? serializeGameForSeat(room.game, viewerSeat) : null
  };
}

function emitRoomState(room) {
  const channel = roomChannel(room.code);
  const socketsInRoom = io.sockets.adapter.rooms.get(channel);
  if (!socketsInRoom) {
    return;
  }

  for (const socketId of socketsInRoom) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      continue;
    }
    const user = socket.data.user;
    const payload = buildRoomState(room, user.id);
    io.to(socket.id).emit("room:state", payload);
  }
}

function cleanupRoomIfEmpty(code) {
  const room = rooms.get(code);
  if (!room) {
    return;
  }
  const hasSeatedPlayers = room.players.some((player) => Boolean(player));
  const socketsInRoom = io.sockets.adapter.rooms.get(roomChannel(code));
  const hasConnectedSockets = Boolean(socketsInRoom && socketsInRoom.size > 0);

  if (!hasSeatedPlayers && !hasConnectedSockets) {
    rooms.delete(code);
    emitRoomsList();
  }
}

function setDisconnectedIfOwned(room, userId, socketId) {
  const seat = getSeatByUser(room, userId);
  if (seat === -1) {
    return;
  }
  const player = room.players[seat];
  if (!player || player.socketId !== socketId) {
    return;
  }
  player.connected = false;
  player.socketId = null;
}

function leaveSocketRoom(socket, options = {}) {
  const { removeSeatWhenPossible = true } = options;

  const currentCode = socket.data.roomCode;
  if (!currentCode) {
    return;
  }

  const room = rooms.get(currentCode);
  socket.leave(roomChannel(currentCode));
  socket.data.roomCode = null;

  if (!room) {
    return;
  }

  const seat = getSeatByUser(room, socket.data.user.id);
  if (seat !== -1) {
    const isPlaying = room.game && room.game.phase === "playing";
    const player = room.players[seat];
    if (player && player.socketId === socket.id) {
      if (isPlaying || !removeSeatWhenPossible) {
        player.connected = false;
        player.socketId = null;
      } else {
        room.players[seat] = null;
      }
    }
  }

  emitRoomState(room);
  emitRoomsList();
  cleanupRoomIfEmpty(room.code);
}

function attachSocketToRoom(socket, room) {
  const seat = getSeatByUser(room, socket.data.user.id);
  if (seat !== -1) {
    const player = room.players[seat];
    if (player.socketId && player.socketId !== socket.id) {
      io.to(player.socketId).emit("session:replaced", {
        message: "Diese Sitzung wurde durch eine neue Anmeldung ersetzt."
      });
      const previousSocket = io.sockets.sockets.get(player.socketId);
      if (previousSocket) {
        previousSocket.leave(roomChannel(room.code));
        previousSocket.data.roomCode = null;
        previousSocket.disconnect(true);
      }
    }
    player.connected = true;
    player.socketId = socket.id;
  }

  socket.join(roomChannel(room.code));
  socket.data.roomCode = room.code;
}

function safeAck(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

function roomFromSocket(socket) {
  if (!socket.data.roomCode) {
    return null;
  }
  return rooms.get(socket.data.roomCode) || null;
}

function ensureNotLeavingActiveRound(socket, targetCode) {
  const currentRoom = roomFromSocket(socket);
  if (!currentRoom || currentRoom.code === targetCode) {
    return;
  }

  const seat = getSeatByUser(currentRoom, socket.data.user.id);
  if (seat === -1) {
    return;
  }

  if (currentRoom.game && currentRoom.game.phase === "playing") {
    throw new Error("Du bist in einer laufenden Runde. Verlasse zuerst den Tisch.");
  }
}

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    const error = validateCredentials(username, password);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    const usernameNorm = normalizeUsername(username);
    const existing = statements.getUserByNorm.get(usernameNorm);
    if (existing) {
      res.status(409).json({ error: "Benutzername existiert bereits." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const createdAt = new Date().toISOString();

    const result = statements.createUser.run(username, usernameNorm, passwordHash, createdAt);
    const user = statements.getUserById.get(Number(result.lastInsertRowid));

    const token = issueToken(user, JWT_SECRET);

    res.status(201).json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("REGISTER_ERROR", error);
    res.status(500).json({ error: "Registrierung fehlgeschlagen." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    const usernameNorm = normalizeUsername(username);
    const user = statements.getUserByNorm.get(usernameNorm);
    if (!user) {
      res.status(401).json({ error: "Benutzername oder Passwort falsch." });
      return;
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Benutzername oder Passwort falsch." });
      return;
    }

    const token = issueToken(user, JWT_SECRET);
    res.json({
      token,
      user: serializeUser(user)
    });
  } catch (error) {
    console.error("LOGIN_ERROR", error);
    res.status(500).json({ error: "Login fehlgeschlagen." });
  }
});

app.get("/api/me", authenticateHttp(JWT_SECRET), (req, res) => {
  const user = statements.getUserById.get(req.auth.userId);
  if (!user) {
    res.status(401).json({ error: "Benutzer nicht gefunden." });
    return;
  }
  res.json({
    user: serializeUser(user)
  });
});

app.post("/api/logout", authenticateHttp(JWT_SECRET), (req, res) => {
  res.json({ ok: true });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      next(new Error("Nicht eingeloggt."));
      return;
    }

    const auth = authenticateSocketToken(token, JWT_SECRET);
    const user = statements.getUserById.get(auth.userId);
    if (!user) {
      next(new Error("Benutzer nicht gefunden."));
      return;
    }

    socket.data.user = {
      id: user.id,
      username: user.username
    };
    next();
  } catch (error) {
    next(new Error("Anmeldung ungueltig."));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user;

  socket.emit("auth:ok", {
    id: user.id,
    username: user.username
  });
  emitRoomsList(socket.id);

  socket.on("rooms:list:request", () => {
    emitRoomsList(socket.id);
  });

  socket.on("room:create", (payload, ack) => {
    try {
      ensureNotLeavingActiveRound(socket, null);
      leaveSocketRoom(socket, { removeSeatWhenPossible: true });

      const code = createUniqueRoomCode();
      const room = {
        code,
        createdAt: new Date().toISOString(),
        players: [null, null, null, null],
        game: null
      };

      room.players[0] = {
        userId: user.id,
        username: user.username,
        connected: true,
        socketId: socket.id
      };

      rooms.set(code, room);
      attachSocketToRoom(socket, room);
      rememberUserRoom(user.id, code);
      emitRoomState(room);
      emitRoomsList();

      safeAck(ack, { ok: true, code });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Raum konnte nicht erstellt werden." });
    }
  });

  socket.on("room:join", (payload, ack) => {
    try {
      const code = String(payload?.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{4,8}$/.test(code)) {
        throw new Error("Ungueltiger Raumcode.");
      }

      const room = rooms.get(code);
      if (!room) {
        throw new Error("Raum nicht gefunden.");
      }

      ensureNotLeavingActiveRound(socket, code);

      const currentRoom = roomFromSocket(socket);
      if (!currentRoom || currentRoom.code !== code) {
        leaveSocketRoom(socket, { removeSeatWhenPossible: true });
      }

      attachSocketToRoom(socket, room);

      const seat = getSeatByUser(room, user.id);
      if (seat === -1 && (!room.game || room.game.phase !== "playing")) {
        const freeSeat = findFirstFreeSeat(room);
        if (freeSeat !== -1) {
          room.players[freeSeat] = {
            userId: user.id,
            username: user.username,
            connected: true,
            socketId: socket.id
          };
        }
      }

      rememberUserRoom(user.id, code);
      emitRoomState(room);
      emitRoomsList();

      safeAck(ack, { ok: true, code });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Raumbeitritt fehlgeschlagen." });
    }
  });

  socket.on("room:leave", (payload, ack) => {
    leaveSocketRoom(socket, { removeSeatWhenPossible: true });
    rememberUserRoom(user.id, null);
    emitRoomsList();
    safeAck(ack, { ok: true });
  });

  socket.on("room:takeSeat", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room) {
        throw new Error("Du bist in keinem Raum.");
      }

      const seat = Number(payload?.seat);
      if (!Number.isInteger(seat) || seat < 0 || seat > 3) {
        throw new Error("Ungueltiger Sitz.");
      }

      const activeSeat = getSeatByUser(room, user.id);
      const target = room.players[seat];
      const roundRunning = room.game && room.game.phase === "playing";

      if (roundRunning && activeSeat === -1) {
        throw new Error("Waehrend einer laufenden Runde kann kein neuer Spieler einsteigen.");
      }

      if (target && target.userId !== user.id) {
        throw new Error("Sitz ist bereits besetzt.");
      }

      if (activeSeat !== -1 && activeSeat !== seat) {
        if (roundRunning) {
          throw new Error("Sitzwechsel ist waehrend einer Runde nicht moeglich.");
        }
        room.players[activeSeat] = null;
      }

      room.players[seat] = {
        userId: user.id,
        username: user.username,
        connected: true,
        socketId: socket.id
      };

      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Sitz konnte nicht uebernommen werden." });
    }
  });

  socket.on("room:freeSeat", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room) {
        throw new Error("Du bist in keinem Raum.");
      }

      const seat = getSeatByUser(room, user.id);
      if (seat === -1) {
        throw new Error("Du hast keinen Sitz.");
      }

      if (room.game && room.game.phase === "playing") {
        throw new Error("Waerend einer Runde kannst du deinen Sitz nicht freigeben.");
      }

      room.players[seat] = null;
      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Sitz konnte nicht freigegeben werden." });
    }
  });

  socket.on("game:start", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room) {
        throw new Error("Du bist in keinem Raum.");
      }

      const seat = getSeatByUser(room, user.id);
      if (seat === -1) {
        throw new Error("Nur sitzende Spieler koennen starten.");
      }

      if (!room.players.every((player) => Boolean(player))) {
        throw new Error("Es braucht vier Spieler zum Starten.");
      }

      if (room.game && room.game.phase === "playing") {
        throw new Error("Runde laeuft bereits.");
      }

      if (room.game && room.game.phase === "waiting_mode") {
        throw new Error("Trumpf muss zuerst gewaehlt werden.");
      }

      const dealerSeat = room.game ? (room.game.dealerSeat + 1) % 4 : Math.floor(Math.random() * 4);
      room.game = startNewRound(room.game, dealerSeat);

      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Spielstart fehlgeschlagen." });
    }
  });

  socket.on("game:chooseMode", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room || !room.game) {
        throw new Error("Kein aktives Spiel.");
      }

      const seat = getSeatByUser(room, user.id);
      if (seat === -1) {
        throw new Error("Du bist kein Spieler in dieser Runde.");
      }

      const mode = String(payload?.mode || "");
      chooseMode(room.game, seat, mode);

      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Trumpfwahl fehlgeschlagen." });
    }
  });

  socket.on("game:playCard", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room || !room.game) {
        throw new Error("Kein aktives Spiel.");
      }

      const seat = getSeatByUser(room, user.id);
      if (seat === -1) {
        throw new Error("Du bist kein Spieler in dieser Runde.");
      }

      const cardId = String(payload?.cardId || "").trim();
      playCard(room.game, seat, cardId);

      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Karte konnte nicht gespielt werden." });
    }
  });

  socket.on("game:nextRound", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room || !room.game) {
        throw new Error("Kein aktives Spiel.");
      }

      if (room.game.phase !== "round_over") {
        throw new Error("Die aktuelle Runde ist noch nicht fertig.");
      }

      const dealerSeat = (room.game.dealerSeat + 1) % 4;
      room.game = startNewRound(room.game, dealerSeat);

      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Neue Runde konnte nicht gestartet werden." });
    }
  });

  socket.on("game:resetMatch", (payload, ack) => {
    try {
      const room = roomFromSocket(socket);
      if (!room) {
        throw new Error("Du bist in keinem Raum.");
      }

      room.game = null;
      emitRoomState(room);
      emitRoomsList();
      safeAck(ack, { ok: true });
    } catch (error) {
      safeAck(ack, { ok: false, error: error.message || "Match konnte nicht zurueckgesetzt werden." });
    }
  });

  socket.on("disconnect", () => {
    const currentCode = socket.data.roomCode;
    if (!currentCode) {
      emitRoomsList();
      return;
    }
    const room = rooms.get(currentCode);
    if (!room) {
      emitRoomsList();
      return;
    }

    setDisconnectedIfOwned(room, user.id, socket.id);
    emitRoomState(room);
    emitRoomsList();
    cleanupRoomIfEmpty(room.code);
  });
});

server.listen(PORT, () => {
  if (JWT_SECRET === "CHANGE_THIS_SECRET_IN_PRODUCTION") {
    console.warn("WARNUNG: JWT_SECRET ist auf dem Default-Wert. Bitte in .env setzen.");
  }
  console.log(`Server laeuft auf Port ${PORT}`);
});