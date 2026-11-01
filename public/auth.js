const $ = (s) => document.querySelector(s);
let mode = "login";

function setMode(m) {
  mode = m;
  const reg = m === "register";
  $("#t-login").setAttribute("aria-selected", String(!reg));
  $("#t-reg").setAttribute("aria-selected", String(reg));
  $("#l-name").hidden = !reg;
  $("#hint").hidden = !reg;
  $("#go").textContent = reg ? "Criar conta" : "Entrar";
  $("#sub").textContent = reg ? "Crie sua conta para começar a organizar seus gastos." : "Entre para ver suas finanças.";
  $("#f").password.autocomplete = reg ? "new-password" : "current-password";
  $("#err").textContent = "";
}
$("#t-login").onclick = () => setMode("login");
$("#t-reg").onclick = () => setMode("register");

$("#f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = { email: f.email.value.trim(), password: f.password.value };
  if (mode === "register") body.name = f.name.value.trim();
  $("#go").disabled = true;
  try {
    const res = await fetch("/api/auth/" + mode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const first = data.details && Object.values(data.details)[0];
      throw new Error(first || data.error || "Não foi possível continuar.");
    }
    location.href = "/";
  } catch (err) {
    $("#err").textContent = err.message;
  } finally {
    $("#go").disabled = false;
  }
});

// Quem já está logado vai direto para o app.
fetch("/api/auth/me").then((r) => { if (r.ok) location.href = "/"; }).catch(() => {});