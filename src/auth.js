const crypto = require("crypto");
const { promisify } = require("util");
const { Router } = require("express");
const db = require("./db");
const { HttpError } = require("./validation");

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 7;
const COOKIE = "sid";
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// ---------- senha (scrypt + salt aleatório) ----------
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split("$");
  const calc = await scrypt(password, Buffer.from(salt, "hex"), 64);
  return crypto.timingSafeEqual(calc, Buffer.from(hash, "hex"));
}
const DUMMY_HASH = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`; // iguala o tempo quando o e-mail não existe

// ---------- sessão (token opaco em cookie httpOnly; no banco fica só o hash) ----------
function getCookie(req, name) {
  const part = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}
function cookieAttrs(maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = SESSION_DAYS * 86400;
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)")
    .run(sha256(token), userId, Date.now() + maxAge * 1000);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; ${cookieAttrs(maxAge)}`);
}

function requireAuth(req, res, next) {
  const token = getCookie(req, COOKIE);
  const row = token && db.prepare(
    `SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), Date.now());
  if (!row) return next(new HttpError(401, "Sessão expirada. Entre novamente."));
  req.user = row;
  next();
}

// ---------- proteções ----------
// Bloqueia escrita que não seja JSON: um formulário de outro site não consegue enviar esse header.
function requireJson(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (!(req.headers["content-type"] || "").startsWith("application/json"))
    return next(new HttpError(415, "Envie o conteúdo como application/json."));
  next();
}
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const h = hits.get(req.ip);
    if (!h || h.reset < now) hits.set(req.ip, { n: 1, reset: now + windowMs });
    else if (++h.n > max) return next(new HttpError(429, "Muitas tentativas. Aguarde alguns minutos."));
    next();
  };
}

// ---------- rotas ----------
const router = Router();
const limiter = rateLimit(Number(process.env.AUTH_RATE_MAX) || 20, 15 * 60 * 1000);
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

router.post("/register", limiter, async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const errors = {};
  if (name.length < 2 || name.length > 60) errors.name = "Informe seu nome (2 a 60 caracteres).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) errors.email = "Informe um e-mail válido.";
  if (password.length < 8) errors.password = "A senha precisa ter pelo menos 8 caracteres.";
  else if (password.length > 128) errors.password = "A senha pode ter no máximo 128 caracteres.";
  if (Object.keys(errors).length) throw new HttpError(422, "Dados inválidos.", errors);
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email))
    throw new HttpError(409, "Este e-mail já tem cadastro. Entre ou use outro e-mail.", { email: "E-mail já cadastrado." });

  const hash = await hashPassword(password);
  const firstUser = db.prepare("SELECT COUNT(*) c FROM users").get().c === 0;
  const info = db.prepare("INSERT INTO users (name, email, password_hash) VALUES (?,?,?)").run(name, email, hash);
  // Lançamentos criados antes do login passam a pertencer à primeira conta.
  if (firstUser) db.prepare("UPDATE transactions SET user_id = ? WHERE user_id IS NULL").run(info.lastInsertRowid);
  startSession(res, info.lastInsertRowid);
  res.status(201).json(publicUser({ id: info.lastInsertRowid, name, email }));
});

router.post("/login", limiter, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH).catch(() => false);
  if (!user || !ok) throw new HttpError(401, "E-mail ou senha incorretos.");
  startSession(res, user.id);
  res.json(publicUser(user));
});

router.post("/logout", (req, res) => {
  const token = getCookie(req, COOKIE);
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieAttrs(0)}`);
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => res.json(req.user));

module.exports = { router, requireAuth, requireJson };