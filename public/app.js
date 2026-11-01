const COLORS = ["#3347d6", "#e0884a", "#17a58a", "#d33f5a", "#8a5bd6", "#c9a227", "#6b7794"];
const $ = (s) => document.querySelector(s);
const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);

let cats = { in: [], out: [] };
let list = [];
let cur = today().slice(0, 7);
let editId = null;
let delId = null;

// ---------- API ----------
async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = data.details && Object.values(data.details)[0];
    throw new Error(first || data.error || "Não foi possível concluir a ação.");
  }
  return data;
}

function toast(t) {
  const e = $("#toast");
  e.textContent = t;
  e.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => e.classList.remove("on"), 2400);
}

function shift(m, n) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// ---------- Render ----------
async function render() {
  $("#month").value = cur;
  const qs = new URLSearchParams({ month: cur });
  if ($("#q").value.trim()) qs.set("q", $("#q").value.trim());
  if ($("#ft").value) qs.set("type", $("#ft").value);
  if ($("#fc").value) qs.set("category", $("#fc").value);
  try {
    const [dash, rows] = await Promise.all([api("/dashboard?month=" + cur), api("/transactions?" + qs)]);
    list = rows;
    renderKpis(dash);
    renderDonut(dash);
    renderBars(dash);
    renderTable();
  } catch (e) {
    toast("Falha ao carregar os dados: " + e.message);
  }
}

function renderKpis(d) {
  $("#kpis").innerHTML = `<div class="card kpi"><small>Receitas</small><div class="num in">${brl(d.income)}</div></div>
  <div class="card kpi"><small>Despesas</small><div class="num out">${brl(d.expense)}</div></div>
  <div class="card kpi bal"><small>Saldo do mês</small><div class="num">${brl(d.balance)}</div></div>`;
}

function renderDonut(d) {
  if (!d.byCategory.length) {
    $("#donut").innerHTML = '<div class="empty">Sem despesas neste mês. Adicione um lançamento para ver a distribuição.</div>';
    return;
  }
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = d.byCategory.map((x, i) => {
    const l = (x.total / d.expense) * C;
    const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${COLORS[i % 7]}" stroke-width="22" stroke-dasharray="${l} ${C - l}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
    off += l;
    return s;
  }).join("");
  $("#donut").innerHTML = `<div class="donut"><svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Despesas por categoria">${arcs}</svg>
  <div class="legend">${d.byCategory.map((x, i) => `<div><span><i class="dot" style="background:${COLORS[i % 7]}"></i>${esc(x.category)}</span><b>${Math.round((x.total / d.expense) * 100)}%</b></div>`).join("")}</div></div>`;
}

function renderBars(d) {
  const max = Math.max(1, ...d.history.flatMap((x) => [x.income, x.expense]));
  const W = 420, H = 170, bw = 16, gw = W / 6;
  const g = d.history.map((x, k) => {
    const cx = gw * k + gw / 2, hi = (x.income / max) * 120, ho = (x.expense / max) * 120;
    const lab = new Date(x.month + "-01T12:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return `<rect x="${cx - bw - 2}" y="${130 - hi}" width="${bw}" height="${hi}" rx="3" fill="var(--in)"><title>Receitas ${brl(x.income)}</title></rect>
    <rect x="${cx + 2}" y="${130 - ho}" width="${bw}" height="${ho}" rx="3" fill="var(--out)"><title>Despesas ${brl(x.expense)}</title></rect>
    <text x="${cx}" y="152" text-anchor="middle" font-size="12" fill="var(--mute)">${lab}</text>`;
  }).join("");
  $("#bars").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Receitas e despesas dos últimos 6 meses">${g}</svg>
  <div style="display:flex;gap:14px;font-size:13px;color:var(--mute)"><span><i class="dot" style="background:var(--in)"></i>Receitas</span><span><i class="dot" style="background:var(--out)"></i>Despesas</span></div>`;
}

function renderTable() {
  const filtered = $("#q").value || $("#ft").value || $("#fc").value;
  $("#rows").innerHTML = list.length
    ? list.map((x) => `<tr>
      <td>${x.date.split("-").reverse().slice(0, 2).join("/")}</td>
      <td class="d">${esc(x.description)}</td>
      <td><span class="chip ${x.type}">${esc(x.category)}</span></td>
      <td class="r num ${x.type}"><b>${x.type === "out" ? "−" : "+"} ${brl(x.amount)}</b></td>
      <td class="r"><button class="btn sm" data-e="${x.id}">Editar</button> <button class="btn sm" data-d="${x.id}">Excluir</button></td></tr>`).join("")
    : `<tr><td colspan="5" class="empty">${filtered ? "Nenhum lançamento com esses filtros." : "Nenhum lançamento neste mês. Use “Novo lançamento” para começar."}</td></tr>`;
}

// ---------- Formulário ----------
const typeVal = () => document.querySelector("input[name=type]:checked").value;
function fillCats(sel, items, keep) {
  sel.innerHTML = items.map((c) => `<option>${esc(c)}</option>`).join("");
  if (keep && items.includes(keep)) sel.value = keep;
}

function openForm(id) {
  editId = id;
  const f = $("#f");
  f.reset();
  $("#err").textContent = "";
  const x = id ? list.find((t) => String(t.id) === String(id)) : null;
  $("#dt").textContent = x ? "Editar lançamento" : "Novo lançamento";
  const type = x ? x.type : "out";
  f.querySelector(`input[name=type][value=${type}]`).checked = true;
  fillCats(f.cat, cats[type], x && x.category);
  f.desc.value = x ? x.description : "";
  f.amount.value = x ? String(x.amount).replace(".", ",") : "";
  f.date.value = x ? x.date : cur === today().slice(0, 7) ? today() : cur + "-01";
  $("#dlg").showModal();
  f.desc.focus();
}

$("#f").addEventListener("change", (e) => {
  if (e.target.name === "type") fillCats($("#f").cat, cats[typeVal()]);
});

$("#f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = {
    description: f.desc.value.trim(),
    amount: parseFloat(f.amount.value.replace(/\./g, "").replace(",", ".")),
    type: typeVal(),
    category: f.cat.value,
    date: f.date.value,
  };
  $("#save").disabled = true;
  try {
    if (editId) await api("/transactions/" + editId, { method: "PUT", body });
    else await api("/transactions", { method: "POST", body });
    $("#dlg").close();
    toast(editId ? "Lançamento atualizado" : "Lançamento salvo");
    cur = body.date.slice(0, 7);
    render();
  } catch (err) {
    $("#err").textContent = err.message;
  } finally {
    $("#save").disabled = false;
  }
});

// ---------- Eventos ----------
$("#add").onclick = () => openForm(null);
$("#cancel").onclick = () => $("#dlg").close();
$("#rows").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.e) openForm(b.dataset.e);
  if (b.dataset.d) {
    delId = b.dataset.d;
    const x = list.find((t) => String(t.id) === delId);
    $("#ctext").textContent = `“${x.description}” de ${brl(x.amount)} será removido.`;
    $("#cdlg").showModal();
  }
});
$("#cno").onclick = () => $("#cdlg").close();
$("#cyes").onclick = async () => {
  try {
    await api("/transactions/" + delId, { method: "DELETE" });
    $("#cdlg").close();
    toast("Lançamento excluído");
    render();
  } catch (err) {
    toast(err.message);
  }
};
$("#prev").onclick = () => { cur = shift(cur, -1); render(); };
$("#next").onclick = () => { cur = shift(cur, 1); render(); };
$("#month").onchange = (e) => { if (e.target.value) { cur = e.target.value; render(); } };
let timer;
$("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 250); });
$("#ft").addEventListener("change", render);
$("#fc").addEventListener("change", render);

(async function init() {
  try {
    cats = await api("/categories");
    const all = [...new Set([...cats.out, ...cats.in])];
    $("#fc").innerHTML = '<option value="">Todas as categorias</option>' + all.map((c) => `<option>${esc(c)}</option>`).join("");
  } catch (e) {
    toast("Não foi possível conectar ao servidor.");
  }
  render();
})();
