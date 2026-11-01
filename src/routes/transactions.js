const { Router } = require("express");
const db = require("../db");
const { HttpError, parseTransaction, isMonth } = require("../validation");

const router = Router();

const toApi = (r) => ({
  id: r.id,
  description: r.description,
  amount: r.amount_cents / 100,
  type: r.type,
  category: r.category,
  date: r.date,
});

const getOr404 = (id) => {
  const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
  if (!row) throw new HttpError(404, "Lançamento não encontrado.");
  return row;
};

// Lista com filtros: ?month=AAAA-MM&type=in|out&category=...&q=texto
router.get("/", (req, res) => {
  const { month, type, category, q } = req.query;
  const where = [];
  const params = [];
  if (month) {
    if (!isMonth(month)) throw new HttpError(400, "Parâmetro month inválido. Use AAAA-MM.");
    where.push("substr(date,1,7) = ?");
    params.push(month);
  }
  if (type) { where.push("type = ?"); params.push(type); }
  if (category) { where.push("category = ?"); params.push(category); }
  if (q) { where.push("description LIKE ?"); params.push(`%${q}%`); }
  const sql = `SELECT * FROM transactions ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY date DESC, id DESC`;
  res.json(db.prepare(sql).all(...params).map(toApi));
});

router.get("/:id", (req, res) => res.json(toApi(getOr404(req.params.id))));

router.post("/", (req, res) => {
  const t = parseTransaction(req.body);
  const info = db
    .prepare("INSERT INTO transactions (description, amount_cents, type, category, date) VALUES (?,?,?,?,?)")
    .run(t.description, t.amount_cents, t.type, t.category, t.date);
  res.status(201).json(toApi(getOr404(info.lastInsertRowid)));
});

router.put("/:id", (req, res) => {
  getOr404(req.params.id);
  const t = parseTransaction(req.body);
  db.prepare(
    `UPDATE transactions SET description=?, amount_cents=?, type=?, category=?, date=?,
     updated_at=datetime('now') WHERE id=?`
  ).run(t.description, t.amount_cents, t.type, t.category, t.date, req.params.id);
  res.json(toApi(getOr404(req.params.id)));
});

router.delete("/:id", (req, res) => {
  getOr404(req.params.id);
  db.prepare("DELETE FROM transactions WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
