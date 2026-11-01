// Uso: npm run seed -- seu@email.com   (a conta precisa existir; crie pela tela de cadastro)
const db = require("./db");
const email = (process.argv[2] || "").toLowerCase();
const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (!user) {
  console.error("Conta não encontrada. Crie a conta no app e rode: npm run seed -- seu@email.com");
  process.exit(1);
}
const m = new Date().toISOString().slice(0, 7);
const rows = [
  ["Salário", 6200, "in", "Salário", `${m}-05`],
  ["Projeto freelance", 1400, "in", "Freelance", `${m}-12`],
  ["Aluguel", 1800, "out", "Moradia", `${m}-06`],
  ["Mercado", 720.5, "out", "Alimentação", `${m}-09`],
  ["Combustível", 260, "out", "Transporte", `${m}-10`],
  ["Cinema e jantar", 185, "out", "Lazer", `${m}-14`],
];
const ins = db.prepare("INSERT INTO transactions (user_id, description, amount_cents, type, category, date) VALUES (?,?,?,?,?,?)");
db.transaction(() => rows.forEach(([d, a, t, c, dt]) => ins.run(user.id, d, Math.round(a * 100), t, c, dt)))();
console.log(`${rows.length} lançamentos de exemplo inseridos para ${email}.`);