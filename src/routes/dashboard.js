const { Router } = require("express");
const db = require("../db");
const { HttpError, isMonth } = require("../validation");

const router = Router();

const shift = (month, n) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

// GET /api/dashboard?month=AAAA-MM → totais, despesas por categoria e últimos 6 meses
router.get("/", (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!isMonth(month)) throw new HttpError(400, "Parâmetro month inválido. Use AAAA-MM.");

  const totalOf = (m, type) =>
    db.prepare("SELECT COALESCE(SUM(amount_cents),0) s FROM transactions WHERE user_id=? AND substr(date,1,7)=? AND type=?")
      .get(req.user.id, m, type).s / 100;

  const income = totalOf(month, "in");
  const expense = totalOf(month, "out");

  const byCategory = db
    .prepare(`SELECT category, SUM(amount_cents)/100.0 AS total FROM transactions
              WHERE user_id=? AND substr(date,1,7)=? AND type='out' GROUP BY category ORDER BY total DESC`)
    .all(req.user.id, month);

  const history = [];
  for (let i = 5; i >= 0; i--) {
    const m = shift(month, -i);
    history.push({ month: m, income: totalOf(m, "in"), expense: totalOf(m, "out") });
  }

  res.json({ month, income, expense, balance: income - expense, byCategory, history });
});

module.exports = router;