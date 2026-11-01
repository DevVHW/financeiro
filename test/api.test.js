process.env.DB_PATH = ":memory:";
const test = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");

let server, base;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

const call = (p, method = "GET", body) =>
  fetch(base + p, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
const sample = { description: "Mercado", amount: 120.5, type: "out", category: "Alimentação", date: "2026-11-03" };

test("CRUD completo de lançamentos", async () => {
  let r = await call("/transactions", "POST", sample);
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.amount, 120.5);

  r = await call(`/transactions/${created.id}`, "PUT", { ...sample, description: "Feira", amount: 99 });
  assert.equal((await r.json()).description, "Feira");

  r = await call("/transactions?month=2026-11&q=feira");
  assert.equal((await r.json()).length, 1);

  r = await call(`/transactions/${created.id}`, "DELETE");
  assert.equal(r.status, 204);
  assert.equal((await call(`/transactions/${created.id}`)).status, 404);
});

test("rejeita dados inválidos com 422", async () => {
  const r = await call("/transactions", "POST", { ...sample, amount: -5, category: "Nada" });
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.ok(body.details.amount && body.details.category);
});

test("dashboard calcula totais", async () => {
  await call("/transactions", "POST", { ...sample, type: "in", category: "Salário", amount: 1000, date: "2026-12-01" });
  await call("/transactions", "POST", { ...sample, amount: 250, date: "2026-12-02" });
  const d = await (await call("/dashboard?month=2026-12")).json();
  assert.equal(d.income, 1000);
  assert.equal(d.expense, 250);
  assert.equal(d.balance, 750);
  assert.equal(d.history.length, 6);
});
