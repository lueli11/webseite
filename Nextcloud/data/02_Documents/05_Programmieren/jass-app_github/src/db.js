const fs = require("fs");
const path = require("path");

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function initDb(dbFile) {
  const filePath = dbFile || path.join(process.cwd(), "data", "app.json");
  const directory = path.dirname(filePath);

  fs.mkdirSync(directory, { recursive: true });

  if (!fs.existsSync(filePath)) {
    const initial = {
      nextUserId: 1,
      users: []
    };
    fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), "utf8");
  }

  function readData() {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!Array.isArray(parsed.users)) {
      parsed.users = [];
    }
    if (!Number.isInteger(parsed.nextUserId) || parsed.nextUserId < 1) {
      parsed.nextUserId = parsed.users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;
    }

    for (const user of parsed.users) {
      if (!Object.prototype.hasOwnProperty.call(user, "last_room_code")) {
        user.last_room_code = null;
      }
    }

    return parsed;
  }

  function writeData(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  const statements = {
    createUser: {
      run(username, usernameNorm, passwordHash, createdAt) {
        const data = readData();
        const exists = data.users.some((user) => user.username_norm === usernameNorm);
        if (exists) {
          const error = new Error("UNIQUE constraint failed: users.username_norm");
          error.code = "SQLITE_CONSTRAINT_UNIQUE";
          throw error;
        }

        const id = data.nextUserId;
        data.nextUserId += 1;

        data.users.push({
          id,
          username,
          username_norm: usernameNorm,
          password_hash: passwordHash,
          created_at: createdAt,
          last_room_code: null
        });

        writeData(data);
        return { lastInsertRowid: id };
      }
    },
    getUserByNorm: {
      get(usernameNorm) {
        const data = readData();
        return data.users.find((user) => user.username_norm === usernameNorm) || undefined;
      }
    },
    getUserById: {
      get(userId) {
        const data = readData();
        const user = data.users.find((entry) => Number(entry.id) === Number(userId));
        if (!user) {
          return undefined;
        }
        return {
          id: user.id,
          username: user.username,
          username_norm: user.username_norm,
          created_at: user.created_at,
          last_room_code: user.last_room_code || null
        };
      }
    },
    updateUserLastRoom: {
      run(roomCode, userId) {
        const data = readData();
        const user = data.users.find((entry) => Number(entry.id) === Number(userId));
        if (!user) {
          return { changes: 0 };
        }
        user.last_room_code = roomCode || null;
        writeData(data);
        return { changes: 1 };
      }
    }
  };

  return { statements };
}

module.exports = {
  initDb,
  normalizeUsername
};