const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function validateCredentials(username, password) {
  const trimmed = String(username || "").trim();
  const pwd = String(password || "");

  if (trimmed.length < 3 || trimmed.length > 24) {
    return "Benutzername muss zwischen 3 und 24 Zeichen lang sein.";
  }
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return "Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten.";
  }
  if (pwd.length < 4 || pwd.length > 128) {
    return "Passwort muss zwischen 4 und 128 Zeichen lang sein.";
  }
  return null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function issueToken(user, secret) {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username
    },
    secret,
    { expiresIn: "30d" }
  );
}

function readBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) {
    return null;
  }
  return raw.slice("Bearer ".length);
}

function authenticateHttp(secret) {
  return (req, res, next) => {
    const token = readBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Nicht angemeldet." });
      return;
    }

    try {
      const payload = jwt.verify(token, secret);
      req.auth = {
        userId: Number(payload.sub),
        username: payload.username
      };
      next();
    } catch (error) {
      res.status(401).json({ error: "Token ungueltig oder abgelaufen." });
    }
  };
}

function authenticateSocketToken(token, secret) {
  const payload = jwt.verify(token, secret);
  return {
    userId: Number(payload.sub),
    username: payload.username
  };
}

module.exports = {
  authenticateHttp,
  authenticateSocketToken,
  hashPassword,
  issueToken,
  validateCredentials,
  verifyPassword
};