process.env.DB_PATH = ":memory:";
process.env.AUTH_RATE_MAX = "1000";
const test = require("node:test");
const assert = require("node:assert");
const app = require("../src/app");

let server, base;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

// cliente com "cookie jar" simples
function client() {
  let cookie = "";
  return async (p, method = "GET", body) => {
    const r = await fetch(base + p, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: body && JSON.stringify(body),
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    return r;
  };
}
const sample = { description: "Mercado", amount: 120.5, type: "out", category: "Alimentação", date: "2026-11-03" };
const signup = async (email) => {
  const c = client();
  const r = await c("/auth/register", "POST", { name: "Teste", email, password: "senha-segura-1" });
  assert.equal(r.status, 201);
  return c;
};

test("rotas protegidas exigem login", async () => {
  const c = client();
  assert.equal((await c("/transactions")).status, 401);
  assert.equal((await c("/dashboard")).status, 401);
});

test("cadastro, login, sessão e logout", async () => {
  const c = await signup("ana@example.com");
  assert.equal((await (await c("/auth/me")).json()).email, "ana@example.com");

  const dup = await client()("/auth/register", "POST", { name: "Ana", email: "ANA@example.com", password: "outra-senha-1" });
  assert.equal(dup.status, 409);
  const weak = await client()("/auth/register", "POST", { name: "Ana", email: "x@example.com", password: "123" });
  assert.equal(weak.status, 422);

  assert.equal((await c("/auth/logout", "POST")).status, 204);
  assert.equal((await c("/auth/me")).status, 401);

  const c2 = client();
  assert.equal((await c2("/auth/login", "POST", { email: "ana@example.com", password: "errada-123" })).status, 401);
  assert.equal((await c2("/auth/login", "POST", { email: "ana@example.com", password: "senha-segura-1" })).status, 200);
  assert.equal((await c2("/auth/me")).status, 200);
});

test("CRUD completo de lançamentos", async () => {
  const c = await signup("crud@example.com");
  let r = await c("/transactions", "POST", sample);
  assert.equal(r.status, 201);
  const created = await r.json();
  assert.equal(created.amount, 120.5);

  r = await c(`/transactions/${created.id}`, "PUT", { ...sample, description: "Feira", amount: 99 });
  assert.equal((await r.json()).description, "Feira");

  r = await c("/transactions?month=2026-11&q=feira");
  assert.equal((await r.json()).length, 1);

  assert.equal((await c(`/transactions/${created.id}`, "DELETE")).status, 204);
  assert.equal((await c(`/transactions/${created.id}`)).status, 404);
});

test("rejeita dados inválidos com 422", async () => {
  const c = await signup("val@example.com");
  const r = await c("/transactions", "POST", { ...sample, amount: -5, category: "Nada" });
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.ok(body.details.amount && body.details.category);
});

test("cada usuário vê apenas os próprios dados", async () => {
  const a = await signup("a@example.com");
  const b = await signup("b@example.com");
  const { id } = await (await a("/transactions", "POST", sample)).json();
  assert.equal((await (await b("/transactions")).json()).length, 0);
  assert.equal((await b(`/transactions/${id}`)).status, 404);
  assert.equal((await b(`/transactions/${id}`, "PUT", sample)).status, 404);
  assert.equal((await b(`/transactions/${id}`, "DELETE")).status, 404);
  assert.equal((await a(`/transactions/${id}`)).status, 200);
});

test("dashboard calcula totais do usuário", async () => {
  const c = await signup("dash@example.com");
  await c("/transactions", "POST", { ...sample, type: "in", category: "Salário", amount: 1000, date: "2026-12-01" });
  await c("/transactions", "POST", { ...sample, amount: 250, date: "2026-12-02" });
  const d = await (await c("/dashboard?month=2026-12")).json();
  assert.equal(d.income, 1000);
  assert.equal(d.expense, 250);
  assert.equal(d.balance, 750);
  assert.equal(d.history.length, 6);
});

test("escrita sem JSON é recusada (proteção CSRF)", async () => {
  const r = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "email=a&password=b" });
  assert.equal(r.status, 415);
});