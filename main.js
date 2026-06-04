// ══════════════════════════════════════════════
//  INDEX DB
// ══════════════════════════════════════════════
const DB_NAME = "padaria_ponto_certo";
const DB_VER = 1;
let idb;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("checklists"))
        db.createObjectStore("checklists", { keyPath: "id" });
      if (!db.objectStoreNames.contains("config"))
        db.createObjectStore("config", { keyPath: "key" });
    };
    req.onsuccess = (e) => {
      idb = e.target.result;
      res(idb);
    };
    req.onerror = (e) => rej(e);
  });
}
function idbPut(store, val) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, "readwrite");
    tx.objectStore(store).put(val);
    tx.oncomplete = () => res();
    tx.onerror = (e) => rej(e);
  });
}
function idbGet(store, key) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = (e) => rej(e);
  });
}
function idbGetAll(store) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = (e) => rej(e);
  });
}
function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => res();
    tx.onerror = (e) => rej(e);
  });
}
function idbClear(store) {
  return new Promise((res, rej) => {
    const tx = idb.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => res();
    tx.onerror = (e) => rej(e);
  });
}

// ══════════════════════════════════════════════
//  DEFAULT DATA
// ══════════════════════════════════════════════
const DEFAULT_AB = [
  "Masseira funcionando",
  "Fornos ligados/aquecendo",
  "Ingredientes separados",
  "Farinha disponível",
  "Fermento disponível",
  "Assadeiras disponíveis",
  "Telas organizadas",
  "Bancadas limpas",
  "Utensílios disponíveis",
  "Produção do dia definida",
  "EPI/Higiene da equipe",
];
const DEFAULT_PRE = [
  "Receita conferida",
  "Ingredientes pesados",
  "Quantidade confirmada",
  "Sequência de Produção definida",
  "Equipamentos livres",
  "Equipe alinhada",
];
const DEFAULT_FLOW = [
  "Pesagem",
  "Mistura",
  "Descanso",
  "Modelagem/Cilindrar",
  "Fermentação",
  "Forno",
];
const DEFAULT_EQ = [
  { e: "Masseira", p: "Motor / Velocidade" },
  { e: "Masseira", p: "Gancho / Cuba" },
  { e: "Masseira", p: "Segurança / Tampa" },
  { e: "Forno", p: "Temperatura / Resistência" },
  { e: "Forno", p: "Timer / Painel" },
  { e: "Forno", p: "Câmara / Selagem" },
  { e: "Cilindro", p: "Passagem / Lâminas" },
  { e: "Cilindro", p: "Segurança" },
  { e: "Balança", p: "Calibração" },
  { e: "Balança", p: "Visor / Bateria" },
  { e: "Fatiador Pão", p: "Lâminas / Afiação" },
  { e: "Fatiador Pão", p: "Tampa / Proteção" },
  { e: "Fatiador Pão", p: "Motor / Correia" },
];
const EQ_EMOJIS = {
  Masseira: "⚙️",
  Forno: "🔥",
  Cilindro: "🔩",
  Balança: "⚖️",
  "Fatiador Pão": "🔪",
};

let CFG = {
  ab: [...DEFAULT_AB],
  pre: [...DEFAULT_PRE],
  flow: [...DEFAULT_FLOW],
  eq: DEFAULT_EQ.map((x) => ({ ...x })),
};
let currentDetailId = null;
let managingSection = null;
let charts = {};

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
async function init() {
  await openDB();
  // Load config
  const cfgAb = await idbGet("config", "ab");
  const cfgPre = await idbGet("config", "pre");
  const cfgFlow = await idbGet("config", "flow");
  const cfgEq = await idbGet("config", "eq");
  if (cfgAb) CFG.ab = cfgAb.val;
  if (cfgPre) CFG.pre = cfgPre.val;
  if (cfgFlow) CFG.flow = cfgFlow.val;
  if (cfgEq) CFG.eq = cfgEq.val;
  const cfgTurnos = await idbGet("config", "turnos");
  const cfgProds = await idbGet("config", "produtos");
  const cfgObsLocs = await idbGet("config", "obsLocais");
  if (cfgTurnos) CFG.turnos = cfgTurnos.val;
  if (cfgProds) CFG.produtos = cfgProds.val;
  if (cfgObsLocs) CFG.obsLocais = cfgObsLocs.val;

  applyLayout();
  window.addEventListener("resize", applyLayout);
  initChecklist();

  // swipe to close modals
  document.querySelectorAll(".bs-overlay").forEach((o) => {
    o.addEventListener("click", (e) => {
      if (e.target === o) closeBS(o.id);
    });
  });
}

async function saveConfig() {
  await idbPut("config", { key: "ab", val: CFG.ab });
  await idbPut("config", { key: "pre", val: CFG.pre });
  await idbPut("config", { key: "flow", val: CFG.flow });
  await idbPut("config", { key: "eq", val: CFG.eq });
  await idbPut("config", { key: "turnos", val: CFG.turnos || [] });
  await idbPut("config", { key: "produtos", val: CFG.produtos || [] });
  await idbPut("config", { key: "obsLocais", val: CFG.obsLocais || [] });
}

// ══════════════════════════════════════════════
//  LAYOUT
// ══════════════════════════════════════════════
const PAGE_TITLES = {
  checklist: "Checklist",
  dashboard: "Dashboard",
  historico: "Histórico",
  relatorios: "Relatórios",
  backup: "Backup",
  config: "Configurações",
};
function applyLayout() {
  // CSS media query handles everything; JS just keeps sidebar visible state in sync
}

function go(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".bn-item")
    .forEach((n) => n.classList.remove("on"));
  document
    .querySelectorAll(".sb-item")
    .forEach((n) => n.classList.remove("on"));
  document.getElementById("page-" + page).classList.add("active");
  document.getElementById("bn-" + page)?.classList.add("on");
  document.querySelectorAll(".sb-item").forEach((el) => {
    if (el.getAttribute("onclick")?.includes("'" + page + "'"))
      el.classList.add("on");
  });
  document.getElementById("tb-title").textContent = PAGE_TITLES[page] || page;
  document.getElementById("tb-save").style.display =
    page === "checklist" ? "flex" : "none";
  document.getElementById("scroll-area").scrollTo(0, 0);
  if (page === "dashboard") renderDash();
  if (page === "historico") renderHistorico();
  if (page === "relatorios") renderRelSel();
  if (page === "backup") renderBackup();
  if (page === "config") renderConfig();
}

// ══════════════════════════════════════════════
//  BUILD CHECKLIST
// ══════════════════════════════════════════════
function initChecklist() {
  document.getElementById("ck-data").value = today();
  document.getElementById("ck-equipe").value = "";
  document.getElementById("ck-ini").value = "";
  document.getElementById("ck-fim").value = "";
  if (document.getElementById("ck-exp-total"))
    document.getElementById("ck-exp-total").value = "";
  if (document.getElementById("ck-exp-wrap"))
    document.getElementById("ck-exp-wrap").style.display = "none";
  updateTurnoSelect();
  // Produtos
  document.getElementById("prod-list").innerHTML = "";
  for (let i = 0; i < 3; i++) addProd(false);
  // Checklists
  buildCheckList("ab", CFG.ab);
  buildCheckList("pre", CFG.pre);
  // Fluxo
  buildFlowList();
  // Equipamentos
  buildEqList();
  // Obs
  document.getElementById("obs-list").innerHTML = "";
  for (let i = 0; i < 3; i++) addObs(false);
}

function buildCheckList(prefix, items) {
  const el = document.getElementById("list-" + prefix);
  el.innerHTML = "";
  items.forEach((label, i) => {
    const wrap = document.createElement("div");
    const row = document.createElement("div");
    row.className = "ci-row";
    row.innerHTML = `
      <div class="ci-box" id="cb-${prefix}-${i}" onclick="toggleCI('${prefix}',${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="ci-text-wrap">
        <div class="ci-text" id="ct-${prefix}-${i}">${label}</div>
        <div class="ci-obs-note" id="cn-${prefix}-${i}"></div>
      </div>
      <div class="ci-actions">
        <div class="ci-obs-btn" id="cob-${prefix}-${i}" onclick="toggleObs('${prefix}',${i})" title="Observação">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
      </div>
    `;
    wrap.appendChild(row);
    const panel = document.createElement("div");
    panel.className = "ci-obs-panel";
    panel.id = `cop-${prefix}-${i}`;
    panel.innerHTML = `<input type="text" id="coi-${prefix}-${i}" placeholder="Adicionar observação..." oninput="updateObsNote('${prefix}',${i})">`;
    wrap.appendChild(panel);
    el.appendChild(wrap);
  });
  updateProg(prefix);
}

function toggleCI(prefix, idx) {
  const box = document.getElementById(`cb-${prefix}-${idx}`);
  const txt = document.getElementById(`ct-${prefix}-${idx}`);
  box.classList.toggle("on");
  txt.classList.toggle("done", box.classList.contains("on"));
  updateProg(prefix);
}

function toggleObs(prefix, idx) {
  const panel = document.getElementById(`cop-${prefix}-${idx}`);
  const btn = document.getElementById(`cob-${prefix}-${idx}`);
  const open = panel.classList.toggle("open");
  if (open) document.getElementById(`coi-${prefix}-${idx}`).focus();
  btn.classList.toggle(
    "has-obs",
    open || !!document.getElementById(`coi-${prefix}-${idx}`)?.value,
  );
}

function updateObsNote(prefix, idx) {
  const val = document.getElementById(`coi-${prefix}-${idx}`)?.value;
  const note = document.getElementById(`cn-${prefix}-${idx}`);
  const btn = document.getElementById(`cob-${prefix}-${idx}`);
  note.textContent = val;
  note.classList.toggle("show", !!val);
  btn.classList.toggle("has-obs", !!val);
}

function updateProg(prefix) {
  const items = prefix === "ab" ? CFG.ab : CFG.pre;
  const n = items.filter((_, i) =>
    document.getElementById(`cb-${prefix}-${i}`)?.classList.contains("on"),
  ).length;
  const pct = items.length ? Math.round((n / items.length) * 100) : 0;
  const color =
    pct === 100
      ? "var(--c-green)"
      : pct >= 60
        ? "var(--c-amber)"
        : "var(--c-red)";
  const fill = document.getElementById("fill-" + prefix);
  const pctEl = document.getElementById("pct-" + prefix);
  const badge = document.getElementById("badge-" + prefix);
  const sub = document.getElementById("sub-" + prefix);
  if (fill) {
    fill.style.width = pct + "%";
    fill.style.background = color;
  }
  if (pctEl) {
    pctEl.textContent = pct + "%";
    pctEl.style.color = color;
  }
  if (badge) {
    badge.textContent = pct + "%";
    badge.className = `badge ${pct === 100 ? "b-green" : pct >= 60 ? "b-amber" : "b-red"}`;
  }
  if (sub) sub.textContent = `${n} de ${items.length} itens`;
}

// ══════════════════════════════════════════════
//  FLOW
// ══════════════════════════════════════════════
function buildFlowList() {
  const el = document.getElementById("flow-list");
  el.innerHTML = "";
  CFG.flow.forEach((proc, i) => {
    const d = document.createElement("div");
    d.className = "fl-card";
    d.innerHTML = `
      <div class="fl-card-hd">
        <div class="fl-card-title"><div class="fl-dot"></div>${proc}</div>
      </div>
      <div class="fl-times">
        <div class="field" style="margin-bottom:0"><div class="lbl">Início</div><input type="time" id="fi-${i}" oninput="calcT(${i})" onchange="calcT(${i})"></div>
        <div class="field" style="margin-bottom:0"><div class="lbl">Fim</div><input type="time" id="ff-${i}" oninput="calcT(${i})" onchange="calcT(${i})"></div>
        <div class="field" style="margin-bottom:0"><div class="lbl">Total</div><input type="text" id="ft-${i}" class="fl-total-val" readonly placeholder="—"></div>
      </div>
      <div class="field" style="margin-bottom:0"><div class="lbl">Problema / Obs</div><input type="text" id="fp-${i}" placeholder="Nenhum..."></div>
    `;
    el.appendChild(d);
  });
}

function calcExpediente() {
  const ini = document.getElementById("ck-ini")?.value;
  const fim = document.getElementById("ck-fim")?.value;
  const wrap = document.getElementById("ck-exp-wrap");
  if (!ini || !fim) {
    if (wrap) wrap.style.display = "none";
    return;
  }
  const [h1, m1] = ini.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  const val = `${Math.floor(d / 60)
    .toString()
    .padStart(2, "0")}:${(d % 60).toString().padStart(2, "0")}`;
  document.getElementById("ck-exp-total").value = val;
  if (wrap) wrap.style.display = "block";
}

function calcProd(i) {
  const ini = document.getElementById("pi-" + i)?.value;
  const fim = document.getElementById("pf-" + i)?.value;
  if (!ini || !fim) return;
  const [h1, m1] = ini.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  const el = document.getElementById("pd-" + i);
  if (el)
    el.value = `${Math.floor(d / 60)
      .toString()
      .padStart(2, "0")}:${(d % 60).toString().padStart(2, "0")}`;
}

function calcT(i) {
  const ini = document.getElementById("fi-" + i)?.value;
  const fim = document.getElementById("ff-" + i)?.value;
  if (!ini || !fim) return;
  const [h1, m1] = ini.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d < 0) d += 1440;
  document.getElementById("ft-" + i).value =
    `${Math.floor(d / 60)}h ${(d % 60).toString().padStart(2, "0")}m`;
}

// ══════════════════════════════════════════════
//  EQUIPAMENTOS
// ══════════════════════════════════════════════
function buildEqList() {
  const el = document.getElementById("eq-list");
  el.innerHTML = "";
  CFG.eq.forEach((item, i) => {
    const emoji = EQ_EMOJIS[item.e] || "🔧";
    const d = document.createElement("div");
    d.className = "eq-card";
    d.innerHTML = `
      <div class="eq-card-hd">
        <div class="eq-icon">${emoji}</div>
        <div class="eq-info">
          <div class="eq-name">${item.e}</div>
          <div class="eq-ponto">${item.p}</div>
        </div>
      </div>
      <div class="eq-status-row">
        <div class="eq-opt ok" id="eok-${i}" onclick="setEq(${i},'ok')">✓ OK</div>
        <div class="eq-opt at" id="eat-${i}" onclick="setEq(${i},'at')">⚠ Atenção</div>
        <div class="eq-opt in" id="ein-${i}" onclick="setEq(${i},'in')">✗ Inop.</div>
      </div>
      <div class="eq-acao" id="ea-${i}">
        <div class="lbl">Ação Necessária</div>
        <input type="text" id="eai-${i}" placeholder="Descrever ação corretiva...">
      </div>
    `;
    el.appendChild(d);
  });
}

function setEq(i, status) {
  ["ok", "at", "in"].forEach((s) =>
    document.getElementById(`e${s}-${i}`)?.classList.remove("on"),
  );
  document.getElementById(`e${status}-${i}`)?.classList.add("on");
  const acao = document.getElementById(`ea-${i}`);
  if (status === "ok") acao.classList.remove("open");
  else acao.classList.add("open");
}

// ══════════════════════════════════════════════
//  PRODUTO / OBS
// ══════════════════════════════════════════════
function addProd(scroll = true) {
  const list = document.getElementById("prod-list");
  const i = list.children.length;
  const d = document.createElement("div");
  d.className = "prod-row";
  d.id = "pr-" + i;
  d.innerHTML = `
    <div class="prod-row-top">
      <div class="field"><div class="lbl">Produto</div><input type="text" id="pn-${i}" placeholder="Nome do produto..."></div>
      <div class="icon-btn danger" style="margin-top:22px" onclick="document.getElementById('pr-${i}').remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div class="field" style="margin-bottom:0"><div class="lbl">Início</div><input type="time" id="pi-${i}" oninput="calcProd(${i})" onchange="calcProd(${i})"></div>
      <div class="field" style="margin-bottom:0"><div class="lbl">Fim</div><input type="time" id="pf-${i}" oninput="calcProd(${i})" onchange="calcProd(${i})"></div>
      <div class="field" style="margin-bottom:0"><div class="lbl">Duração</div><input type="text" id="pd-${i}" readonly placeholder="—"></div>
    </div>
    <div class="prod-row-bot">
      <div class="field" style="margin-bottom:0"><div class="lbl">Qtd (kg)</div><input type="number" id="pk-${i}" placeholder="0.0" step="0.1" min="0"></div>
      <div class="field" style="margin-bottom:0"><div class="lbl">Obs / Lote</div><input type="text" id="pt-${i}" placeholder="Observação..."></div>
    </div>
  `;
  list.appendChild(d);
  if (scroll) {
    d.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => document.getElementById("pn-" + i)?.focus(), 300);
  }
}

function addObs(scroll = true) {
  const list = document.getElementById("obs-list");
  const i = list.children.length;
  const d = document.createElement("div");
  d.className = "obs-row";
  d.id = "or-" + i;
  d.innerHTML = `
    <div class="obs-row-hd">
      <span class="obs-row-num">OCORRÊNCIA #${i + 1}</span>
      <div class="icon-btn danger" onclick="document.getElementById('or-${i}').remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input type="text" id="ol-${i}" placeholder="Local / Setor (ex: Forno 2)">
      <input type="text" id="od-${i}" placeholder="Descrição do problema...">
      <input type="text" id="oc-${i}" placeholder="Correção / Ação tomada...">
    </div>
  `;
  list.appendChild(d);
  if (scroll) d.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ══════════════════════════════════════════════
//  MANAGE ITEMS (edit/add/delete section items)
// ══════════════════════════════════════════════
const MANAGE_TITLES = {
  ab: "✅ Abertura do Setor",
  pre: "📋 Pré-Produção",
  fluxo: "⏱ Fluxo Operacional",
  eq: "🔧 Equipamentos",
};

function openManage(section) {
  managingSection = section;
  document.getElementById("bs-manage-title").textContent =
    MANAGE_TITLES[section];
  renderManageBody(section);
  openBS("bs-manage");
}

function renderManageBody(section) {
  const body = document.getElementById("bs-manage-body");
  body.innerHTML = "";

  if (section === "eq") {
    // Equipamentos: show equipment + verification point pairs
    const list = document.createElement("div");
    list.id = "manage-list";
    CFG.eq.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "mi-row";
      row.id = `mi-eq-${i}`;
      row.innerHTML = `
        <div class="mi-drag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div>
        <div style="flex:1;min-width:0">
          <input type="text" id="me-e-${i}" value="${item.e}" placeholder="Equipamento" style="margin-bottom:6px;font-size:13px;padding:8px 10px;min-height:38px">
          <input type="text" id="me-p-${i}" value="${item.p}" placeholder="Ponto de verificação" style="font-size:13px;padding:8px 10px;min-height:38px">
        </div>
        <div class="icon-btn danger" onclick="removeManageRow('eq',${i})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      `;
      list.appendChild(row);
    });
    body.appendChild(list);
    // Add new row
    const addRow = document.createElement("div");
    addRow.className = "add-item-row";
    addRow.style.cssText =
      "flex-direction:column;gap:6px;padding-top:14px;border-top:1px solid var(--c-border);margin-top:8px";
    addRow.innerHTML = `
      <input type="text" id="new-eq-e" placeholder="Novo equipamento (ex: Amassadeira)">
      <input type="text" id="new-eq-p" placeholder="Ponto de verificação (ex: Motor)">
      <button class="btn btn-ghost btn-sm btn-full" onclick="addManageEq()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Adicionar Equipamento
      </button>
    `;
    body.appendChild(addRow);
  } else {
    const items =
      section === "fluxo" ? CFG.flow : section === "ab" ? CFG.ab : CFG.pre;
    const list = document.createElement("div");
    list.id = "manage-list";
    items.forEach((label, i) => {
      const row = document.createElement("div");
      row.className = "mi-row";
      row.id = `mi-${section}-${i}`;
      row.innerHTML = `
        <div class="mi-drag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div>
        <input type="text" id="mi-inp-${i}" value="${label}" style="flex:1;font-size:14px;padding:10px 12px;min-height:42px">
        <div class="icon-btn danger" onclick="removeManageRow('${section}',${i})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      `;
      list.appendChild(row);
    });
    body.appendChild(list);
    // Add new
    const addRow = document.createElement("div");
    addRow.className = "add-item-row";
    addRow.style.cssText =
      "padding-top:14px;border-top:1px solid var(--c-border);margin-top:8px";
    addRow.innerHTML = `
      <input type="text" id="new-item-inp" placeholder="Novo item...">
      <button class="btn btn-ghost btn-sm" onclick="addManageItem('${section}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add
      </button>
    `;
    body.appendChild(addRow);
  }
}

function removeManageRow(section, idx) {
  document.getElementById(`mi-${section}-${idx}`)?.remove();
  document.getElementById(`mi-eq-${idx}`)?.remove();
}

function addManageItem(section) {
  const inp = document.getElementById("new-item-inp");
  const val = inp?.value.trim();
  if (!val) {
    toast("Digite um nome para o item", "amber");
    return;
  }
  const items =
    section === "fluxo" ? CFG.flow : section === "ab" ? CFG.ab : CFG.pre;
  const i = document.getElementById("manage-list").children.length;
  const row = document.createElement("div");
  row.className = "mi-row";
  row.id = `mi-${section}-${i}`;
  row.innerHTML = `
    <div class="mi-drag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div>
    <input type="text" id="mi-inp-${i}" value="${val}" style="flex:1;font-size:14px;padding:10px 12px;min-height:42px">
    <div class="icon-btn danger" onclick="removeManageRow('${section}',${i})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
  `;
  document.getElementById("manage-list").appendChild(row);
  inp.value = "";
}

function addManageEq() {
  const e = document.getElementById("new-eq-e")?.value.trim();
  const p = document.getElementById("new-eq-p")?.value.trim();
  if (!e || !p) {
    toast("Preencha equipamento e ponto", "amber");
    return;
  }
  const i = document.getElementById("manage-list").children.length;
  const row = document.createElement("div");
  row.className = "mi-row";
  row.id = `mi-eq-${i}`;
  row.innerHTML = `
    <div class="mi-drag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg></div>
    <div style="flex:1;min-width:0">
      <input type="text" id="me-e-${i}" value="${e}" placeholder="Equipamento" style="margin-bottom:6px;font-size:13px;padding:8px 10px;min-height:38px">
      <input type="text" id="me-p-${i}" value="${p}" placeholder="Ponto de verificação" style="font-size:13px;padding:8px 10px;min-height:38px">
    </div>
    <div class="icon-btn danger" onclick="removeManageRow('eq',${i})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
  `;
  document.getElementById("manage-list").appendChild(row);
  document.getElementById("new-eq-e").value = "";
  document.getElementById("new-eq-p").value = "";
}

async function saveManaged() {
  const section = managingSection;
  if (section === "eq") {
    const rows = [...document.querySelectorAll('[id^="mi-eq-"]')];
    CFG.eq = rows
      .map((row, i) => ({
        e: document.getElementById(`me-e-${i}`)?.value.trim() || "",
        p: document.getElementById(`me-p-${i}`)?.value.trim() || "",
      }))
      .filter((x) => x.e && x.p);
  } else {
    const rows = [...document.querySelectorAll('[id^="mi-inp-"]')];
    const vals = rows.map((inp) => inp.value.trim()).filter(Boolean);
    if (section === "ab") CFG.ab = vals;
    else if (section === "pre") CFG.pre = vals;
    else if (section === "fluxo") CFG.flow = vals;
  }
  await saveConfig();
  closeBS("bs-manage");
  // Rebuild affected sections
  if (section === "ab") buildCheckList("ab", CFG.ab);
  if (section === "pre") buildCheckList("pre", CFG.pre);
  if (section === "fluxo") buildFlowList();
  if (section === "eq") buildEqList();
  toast("✅ Itens atualizados!", "green");
}

// ══════════════════════════════════════════════
//  COLLECT & SAVE
// ══════════════════════════════════════════════
function collectData() {
  const d = {
    id: Date.now(),
    data: document.getElementById("ck-data").value,
    turno: document.getElementById("ck-turno").value,
    equipe: document.getElementById("ck-equipe").value,
    expIni: document.getElementById("ck-ini").value || "",
    expFim: document.getElementById("ck-fim").value || "",
    expTotal: document.getElementById("ck-exp-total")?.value || "",
    produtos: [],
    abertura: { items: [], pct: 0 },
    pre: { items: [], pct: 0 },
    fluxo: [],
    equipamentos: [],
    observacoes: [],
  };
  // Produtos
  document.querySelectorAll('[id^="pr-"]').forEach((pr) => {
    const idx = pr.id.replace("pr-", "");
    const nome = document.getElementById("pn-" + idx)?.value;
    if (nome)
      d.produtos.push({
        nome,
        ini: document.getElementById("pi-" + idx)?.value || "",
        fim: document.getElementById("pf-" + idx)?.value || "",
        duracao: document.getElementById("pd-" + idx)?.value || "",
        kg: document.getElementById("pk-" + idx)?.value || "",
        obs: document.getElementById("pt-" + idx)?.value || "",
      });
  });
  // Abertura
  CFG.ab.forEach((label, i) =>
    d.abertura.items.push({
      label,
      checked: !!document
        .getElementById(`cb-ab-${i}`)
        ?.classList.contains("on"),
      obs: document.getElementById(`coi-ab-${i}`)?.value || "",
    }),
  );
  d.abertura.pct = Math.round(
    (d.abertura.items.filter((x) => x.checked).length /
      Math.max(CFG.ab.length, 1)) *
      100,
  );
  // Pre
  CFG.pre.forEach((label, i) =>
    d.pre.items.push({
      label,
      checked: !!document
        .getElementById(`cb-pre-${i}`)
        ?.classList.contains("on"),
      obs: document.getElementById(`coi-pre-${i}`)?.value || "",
    }),
  );
  d.pre.pct = Math.round(
    (d.pre.items.filter((x) => x.checked).length /
      Math.max(CFG.pre.length, 1)) *
      100,
  );
  // Fluxo
  CFG.flow.forEach((_, i) =>
    d.fluxo.push({
      processo: CFG.flow[i],
      inicio: document.getElementById("fi-" + i)?.value || "",
      fim: document.getElementById("ff-" + i)?.value || "",
      total: document.getElementById("ft-" + i)?.value || "",
      problema: document.getElementById("fp-" + i)?.value || "",
    }),
  );
  // Eq
  CFG.eq.forEach((_, i) => {
    let status = "";
    if (document.getElementById("eok-" + i)?.classList.contains("on"))
      status = "OK";
    else if (document.getElementById("eat-" + i)?.classList.contains("on"))
      status = "Atenção";
    else if (document.getElementById("ein-" + i)?.classList.contains("on"))
      status = "Inoperante";
    d.equipamentos.push({
      equip: CFG.eq[i].e,
      ponto: CFG.eq[i].p,
      status,
      acao: document.getElementById("eai-" + i)?.value || "",
    });
  });
  // Obs
  document.querySelectorAll('[id^="or-"]').forEach((or) => {
    const idx = or.id.replace("or-", "");
    const local = document.getElementById("ol-" + idx)?.value;
    const desc = document.getElementById("od-" + idx)?.value;
    const corr = document.getElementById("oc-" + idx)?.value;
    if (local || desc || corr) d.observacoes.push({ local, desc, corr });
  });
  return d;
}

async function salvar() {
  const d = collectData();
  if (!d.data) {
    toast("⚠️ Informe a data do turno", "amber");
    return;
  }
  if (!d.equipe) {
    toast("⚠️ Informe a equipe / responsável", "amber");
    return;
  }

  // Build summary for confirmation sheet
  const abOk = d.abertura.items.filter((x) => x.checked).length;
  const preOk = d.pre.items.filter((x) => x.checked).length;
  const prods = d.produtos.length
    ? d.produtos.map((p) => p.nome).join(", ")
    : "—";
  const eqAt = d.equipamentos.filter(
    (e) => e.status && e.status !== "OK",
  ).length;

  const msg = document.getElementById("confirm-msg");
  msg.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:var(--c-s2);border-radius:var(--r-sm);padding:12px 14px;display:flex;flex-direction:column;gap:7px">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--c-text3)">Data</span>
          <span style="font-weight:700">${fd(d.data)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--c-text3)">Turno</span>
          <span style="font-weight:700">${d.turno}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span style="color:var(--c-text3)">Equipe</span>
          <span style="font-weight:700">${d.equipe}</span>
        </div>
        ${d.expTotal ? `<div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--c-text3)">Expediente</span><span style="font-weight:700;color:var(--c-amber)">${d.expIni} → ${d.expFim} (${d.expTotal})</span></div>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--c-green-d);border:1px solid var(--c-green);border-radius:var(--r-sm);padding:10px 12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:var(--c-green)">${d.abertura.pct}%</div>
          <div style="font-size:10px;color:var(--c-text3);font-family:var(--mono)">ABERTURA (${abOk}/${d.abertura.items.length})</div>
        </div>
        <div style="background:var(--c-blue-d);border:1px solid var(--c-blue);border-radius:var(--r-sm);padding:10px 12px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:var(--c-blue)">${d.pre.pct}%</div>
          <div style="font-size:10px;color:var(--c-text3);font-family:var(--mono)">PRÉ-PROD (${preOk}/${d.pre.items.length})</div>
        </div>
      </div>
      <div style="background:var(--c-s2);border-radius:var(--r-sm);padding:10px 14px;font-size:12px;color:var(--c-text2)">
        <strong style="color:var(--c-text3);font-family:var(--mono);font-size:10px">PRODUTOS</strong><br>${prods}
      </div>
      ${eqAt > 0 ? `<div style="background:var(--c-red-d);border:1px solid var(--c-red);border-radius:var(--r-sm);padding:8px 12px;font-size:12px;color:var(--c-red);font-weight:600">⚠ ${eqAt} equipamento(s) com alerta</div>` : `<div style="background:var(--c-green-d);border:1px solid var(--c-green);border-radius:var(--r-sm);padding:8px 12px;font-size:12px;color:var(--c-green);font-weight:600">✓ Todos equipamentos OK</div>`}
      <div style="font-size:12px;color:var(--c-text3);text-align:center;line-height:1.5">Confirmar salvamento? O formulário será limpo após salvar.</div>
    </div>
  `;

  document.getElementById("confirm-ok").textContent = "💾 Salvar";
  const titleEl = document.getElementById("bs-confirm-title");
  if (titleEl) titleEl.textContent = "Resumo do Checklist";
  document.getElementById("confirm-ok").onclick = async () => {
    closeBS("bs-confirm");
    await idbPut("checklists", d);
    toast("✅ Checklist salvo com sucesso!", "green");
    setTimeout(() => initChecklist(), 300);
  };
  openBS("bs-confirm");
}

// ══════════════════════════════════════════════
//  HISTÓRICO
// ══════════════════════════════════════════════
async function renderHistorico(lista) {
  let data = lista;
  if (!data) {
    const all = await idbGetAll("checklists");
    data = all.sort((a, b) => b.id - a.id);
  }
  const hist = document.getElementById("hist-list");
  const empty = document.getElementById("hist-empty");
  hist.innerHTML = "";
  if (!data.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  data.forEach((d) => {
    const abPct = d.abertura?.pct ?? 0;
    const prePct = d.pre?.pct ?? 0;
    const eqAt =
      d.equipamentos?.filter((e) => e.status && e.status !== "OK").length ?? 0;
    const div = document.createElement("div");
    div.className = "hr-card";
    div.innerHTML = `
      <div class="hr-top">
        <div class="hr-date">${fd(d.data)}</div>
        <span class="badge b-gray">#${d.id.toString().slice(-4)}</span>
      </div>
      <div class="hr-sub">${d.turno || "—"} · ${d.equipe || "Equipe não informada"}</div>
      <div class="hr-badges">
        <span class="badge ${abPct === 100 ? "b-green" : abPct >= 60 ? "b-amber" : "b-red"}">Abertura ${abPct}%</span>
        <span class="badge ${prePct === 100 ? "b-green" : prePct >= 60 ? "b-amber" : "b-red"}">Pré-Prod ${prePct}%</span>
        ${eqAt > 0 ? `<span class="badge b-red">⚠ ${eqAt} equip.</span>` : `<span class="badge b-green">✓ Equipam.</span>`}
      </div>
      <div class="hr-actions">
        <button class="btn btn-ghost" onclick="verDetalhe(${d.id})">👁 Ver</button>
        <button class="btn btn-ghost" onclick="pdfById(${d.id})">📄 PDF</button>
        <button class="btn btn-ghost" style="color:var(--c-red);border-color:var(--c-red)" onclick="deletarReg(${d.id})">🗑</button>
      </div>
    `;
    hist.appendChild(div);
  });
}

function toggleFiltros() {
  const b = document.getElementById("filt-body");
  const a = document.getElementById("filt-arrow");
  const op = b.classList.toggle("open");
  a.textContent = op ? "▲" : "▼";
}

async function filtrar() {
  const de = document.getElementById("filt-de").value;
  const ate = document.getElementById("filt-ate").value;
  const turno = document.getElementById("filt-turno").value;
  const eq = document.getElementById("filt-eq").value.toLowerCase();
  const all = await idbGetAll("checklists");
  const res = all
    .filter((d) => {
      if (de && d.data < de) return false;
      if (ate && d.data > ate) return false;
      if (turno && d.turno !== turno) return false;
      if (eq && !d.equipe?.toLowerCase().includes(eq)) return false;
      return true;
    })
    .sort((a, b) => b.id - a.id);
  renderHistorico(res);
}

function limparFiltros() {
  ["filt-de", "filt-ate", "filt-eq"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  document.getElementById("filt-turno").value = "";
  renderHistorico();
}

async function deletarReg(id) {
  confirmAction("Deletar este registro permanentemente?", async () => {
    await idbDelete("checklists", id);
    renderHistorico();
    toast("🗑 Registro deletado", "red");
  });
}

async function verDetalhe(id) {
  currentDetailId = id;
  const d = await idbGet("checklists", id);
  if (!d) return;
  const body = document.getElementById("bs-detail-body");
  body.innerHTML = `
    <div class="det-row"><span class="det-key">Data</span><span class="det-val">${fd(d.data)}</span></div>
    <div class="det-row"><span class="det-key">Turno</span><span class="det-val">${d.turno || "—"}</span></div>
    <div class="det-row"><span class="det-key">Equipe</span><span class="det-val">${d.equipe || "—"}</span></div>
    <div class="det-row"><span class="det-key">Abertura</span><span class="det-val"><span class="badge ${d.abertura?.pct === 100 ? "b-green" : d.abertura?.pct >= 60 ? "b-amber" : "b-red"}">${d.abertura?.pct ?? 0}%</span></span></div>
    <div class="det-row"><span class="det-key">Pré-Produção</span><span class="det-val"><span class="badge ${d.pre?.pct === 100 ? "b-green" : d.pre?.pct >= 60 ? "b-amber" : "b-red"}">${d.pre?.pct ?? 0}%</span></span></div>
    <div class="det-sec">Produtos</div>
    ${d.produtos?.length ? d.produtos.map((p) => `<div class="det-row"><span class="det-key">${p.nome}</span><span class="det-val">${p.kg ? p.kg + " kg" : ""} ${p.tempo || ""}</span></div>`).join("") : '<p style="font-size:13px;color:var(--c-text3)">—</p>'}
    <div class="det-sec">Fluxo</div>
    ${
      d.fluxo
        ?.filter((f) => f.inicio)
        .map(
          (f) =>
            `<div class="det-row"><span class="det-key">${f.processo}</span><span class="det-val" style="font-size:12px">${f.inicio}→${f.fim} <span style="color:var(--c-amber)">${f.total}</span></span></div>`,
        )
        .join("") || '<p style="font-size:13px;color:var(--c-text3)">—</p>'
    }
    <div class="det-sec">Alertas de Equipamento</div>
    ${
      d.equipamentos
        ?.filter((e) => e.status && e.status !== "OK")
        .map(
          (e) =>
            `<div class="det-row"><span class="det-key">${e.equip}</span><span class="det-val"><span class="badge ${e.status === "Atenção" ? "b-amber" : "b-red"}">${e.status}</span></span></div>`,
        )
        .join("") ||
      '<p style="font-size:13px;color:var(--c-green)">✓ Todos OK</p>'
    }
  `;
  openBS("bs-detail");
}

async function pdfCurrentDetail() {
  if (currentDetailId) {
    const d = await idbGet("checklists", currentDetailId);
    if (d) gerarPDF(d);
  }
}
async function pdfById(id) {
  const d = await idbGet("checklists", id);
  if (d) gerarPDF(d);
}

// ══════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════
async function renderDash() {
  const all = await idbGetAll("checklists");
  const n = all.length;
  const avgAb = n
    ? Math.round(all.reduce((a, d) => a + (d.abertura?.pct ?? 0), 0) / n)
    : 0;
  const avgPre = n
    ? Math.round(all.reduce((a, d) => a + (d.pre?.pct ?? 0), 0) / n)
    : 0;
  const eqAt = all.reduce(
    (a, d) =>
      a +
      (d.equipamentos?.filter((e) => e.status && e.status !== "OK").length ??
        0),
    0,
  );
  // avg expediente duration
  const expMins = all
    .filter((d) => d.expTotal)
    .map((d) => {
      const [hh, mm] = (d.expTotal || "0:0").split(":").map(Number);
      return hh * 60 + mm;
    })
    .filter(Boolean);
  const avgExp = expMins.length
    ? Math.round(expMins.reduce((a, b) => a + b, 0) / expMins.length)
    : 0;
  const avgExpStr = avgExp
    ? `${Math.floor(avgExp / 60)}h${(avgExp % 60).toString().padStart(2, "0")}m`
    : "—";
  // avg total prod duration per checklist
  const prodMinsAll = all
    .map((d) => {
      const mins = (d.produtos || []).map((p) => {
        if (!p.ini || !p.fim) return 0;
        const [h1, m1] = p.ini.split(":").map(Number);
        const [h2, m2] = p.fim.split(":").map(Number);
        let diff = h2 * 60 + m2 - (h1 * 60 + m1);
        return diff < 0 ? diff + 1440 : diff;
      });
      return mins.reduce((a, b) => a + b, 0);
    })
    .filter(Boolean);
  const avgProdMin = prodMinsAll.length
    ? Math.round(prodMinsAll.reduce((a, b) => a + b, 0) / prodMinsAll.length)
    : 0;
  const avgProdStr = avgProdMin
    ? `${Math.floor(avgProdMin / 60)}h${(avgProdMin % 60).toString().padStart(2, "0")}m`
    : "—";
  document.getElementById("kpi-wrap").innerHTML = `
    <div class="kpi-card kpi-green"><div class="kpi-lbl">Registros</div><div class="kpi-v">${n}</div><div class="kpi-sub">checklists</div></div>
    <div class="kpi-card kpi-amber"><div class="kpi-lbl">Abertura</div><div class="kpi-v">${n ? avgAb + "%" : "—"}</div><div class="kpi-sub">conformidade</div></div>
    <div class="kpi-card kpi-blue"><div class="kpi-lbl">Expediente</div><div class="kpi-v" style="font-size:20px">${avgExpStr}</div><div class="kpi-sub">duração média</div></div>
    <div class="kpi-card kpi-red"><div class="kpi-lbl">Alertas Eq.</div><div class="kpi-v">${eqAt}</div><div class="kpi-sub">ocorrências</div></div>
  `;
  if (!n) return;
  // Render prod time comparison card if not exists
  renderDashProdTimes(all);
  const co = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#b0a888",
          font: { family: "Plus Jakarta Sans", size: 11 },
        },
      },
    },
    scales: {},
  };
  const scY = { ticks: { color: "#726a54" }, grid: { color: "#3a3628" } };
  const scX = { ticks: { color: "#b0a888" }, grid: { display: false } };

  // Conformidade
  const ctx1 = document.getElementById("ch-conf")?.getContext("2d");
  if (ctx1) {
    if (charts.c1) charts.c1.destroy();
    charts.c1 = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: ["Abertura", "Pré-Produção"],
        datasets: [
          {
            label: "%",
            data: [avgAb, avgPre],
            backgroundColor: ["rgba(240,160,48,.72)", "rgba(77,157,224,.72)"],
            borderColor: ["#f0a030", "#4d9de0"],
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      },
      options: {
        ...co,
        plugins: { legend: { display: false } },
        scales: { y: { max: 100, ...scY }, x: { ...scX } },
      },
    });
  }

  // Turnos
  const tobj = { "☀️ Manhã": 0, "🌤 Tarde": 0, "🌙 Noite": 0 };
  all.forEach((d) => {
    if (d.turno) tobj[d.turno] = (tobj[d.turno] || 0) + 1;
  });
  const ctx2 = document.getElementById("ch-turnos")?.getContext("2d");
  if (ctx2) {
    if (charts.c2) charts.c2.destroy();
    charts.c2 = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: Object.keys(tobj),
        datasets: [
          {
            data: Object.values(tobj),
            backgroundColor: ["#f0a030", "#4d9de0", "#3ecf82"],
            borderColor: "#1a1812",
            borderWidth: 3,
          },
        ],
      },
      options: { ...co, cutout: "62%" },
    });
  }

  // Equipamentos
  const eqst = { OK: 0, Atenção: 0, Inoperante: 0 };
  all.forEach((d) =>
    d.equipamentos?.forEach((e) => {
      if (e.status && eqst[e.status] !== undefined) eqst[e.status]++;
    }),
  );
  const ctx3 = document.getElementById("ch-eq")?.getContext("2d");
  if (ctx3) {
    if (charts.c3) charts.c3.destroy();
    charts.c3 = new Chart(ctx3, {
      type: "doughnut",
      data: {
        labels: ["OK", "Atenção", "Inoperante"],
        datasets: [
          {
            data: Object.values(eqst),
            backgroundColor: ["#3ecf82", "#f0a030", "#f05060"],
            borderColor: "#1a1812",
            borderWidth: 3,
          },
        ],
      },
      options: { ...co, cutout: "55%" },
    });
  }

  // Tempo por processo
  const last10 = all.slice(-10);
  const tempos = CFG.flow.map((_, i) => {
    const vals = last10
      .map((d) => {
        const f = d.fluxo?.[i];
        if (!f?.inicio || !f?.fim) return 0;
        const [h1, m1] = f.inicio.split(":").map(Number);
        const [h2, m2] = f.fim.split(":").map(Number);
        let diff = h2 * 60 + m2 - (h1 * 60 + m1);
        return diff < 0 ? diff + 1440 : diff;
      })
      .filter(Boolean);
    return vals.length
      ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      : 0;
  });
  const ctx4 = document.getElementById("ch-tempo")?.getContext("2d");
  if (ctx4) {
    if (charts.c4) charts.c4.destroy();
    charts.c4 = new Chart(ctx4, {
      type: "bar",
      data: {
        labels: CFG.flow,
        datasets: [
          {
            label: "min",
            data: tempos,
            backgroundColor: "rgba(62,207,130,.72)",
            borderColor: "#3ecf82",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...co,
        plugins: { legend: { display: false } },
        scales: {
          y: { ...scY },
          x: { ...scX, ticks: { color: "#b0a888", font: { size: 10 } } },
        },
      },
    });
  }

  // Dias da semana
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dc = [0, 0, 0, 0, 0, 0, 0];
  all.forEach((d) => {
    if (d.data) dc[new Date(d.data + "T12:00:00").getDay()]++;
  });
  const ctx5 = document.getElementById("ch-dias")?.getContext("2d");
  if (ctx5) {
    if (charts.c5) charts.c5.destroy();
    charts.c5 = new Chart(ctx5, {
      type: "bar",
      data: {
        labels: dias,
        datasets: [
          {
            label: "Registros",
            data: dc,
            backgroundColor: "rgba(240,160,48,.72)",
            borderColor: "#f0a030",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...co,
        plugins: { legend: { display: false } },
        scales: { y: { ...scY }, x: { ...scX } },
      },
    });
  }
}

// ══════════════════════════════════════════════
//  RELATÓRIOS
// ══════════════════════════════════════════════
async function renderRelSel() {
  const all = (await idbGetAll("checklists")).sort((a, b) => b.id - a.id);
  const sel = document.getElementById("sel-pdf");
  sel.innerHTML = '<option value="">-- Selecionar --</option>';
  all.forEach(
    (d) =>
      (sel.innerHTML += `<option value="${d.id}">#${d.id.toString().slice(-4)} — ${fd(d.data)} | ${d.turno || ""} | ${d.equipe || "—"}</option>`),
  );
}

async function exportPDFById() {
  const id = parseInt(document.getElementById("sel-pdf").value);
  if (!id) {
    toast("⚠️ Selecione um registro", "amber");
    return;
  }
  const d = await idbGet("checklists", id);
  if (d) gerarPDF(d);
}
async function exportPDF() {
  const d = collectData();
  if (!d.data) {
    toast("⚠️ Informe a data", "amber");
    return;
  }
  gerarPDF(d);
}

async function exportJSON() {
  const de = document.getElementById("exp-de")?.value;
  const ate = document.getElementById("exp-ate")?.value;
  const all = await idbGetAll("checklists");
  const dados =
    de || ate
      ? all.filter((d) => (!de || d.data >= de) && (!ate || d.data <= ate))
      : all;
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: "3.0",
          exportDate: new Date().toISOString(),
          dados,
          config: CFG,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup_padaria_${today()}.json`;
  a.click();
  toast("⬇ Backup exportado!", "green");
}

function triggerImport() {
  document.getElementById("imp-file").click();
}
async function importarJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      const dados = json.dados || json;
      if (!Array.isArray(dados)) throw new Error("Formato inválido");
      let count = 0;
      for (const d of dados) {
        const ex = await idbGet("checklists", d.id);
        if (!ex) {
          await idbPut("checklists", d);
          count++;
        }
      }
      toast(`✅ ${count} registro(s) importado(s)!`, "green");
      renderHistorico();
      renderBackup();
    } catch (err) {
      toast("❌ Erro: " + err.message, "red");
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════
//  BACKUP
// ══════════════════════════════════════════════
async function renderBackup() {
  const all = await idbGetAll("checklists");
  const n = all.length;
  const size = (new Blob([JSON.stringify(all)]).size / 1024).toFixed(1);
  document.getElementById("bk-kpis").innerHTML = `
    <div class="kpi-card kpi-amber"><div class="kpi-lbl">Registros</div><div class="kpi-v">${n}</div><div class="kpi-sub">checklists</div></div>
    <div class="kpi-card kpi-green"><div class="kpi-lbl">Armazenado</div><div class="kpi-v" style="font-size:22px">${size}</div><div class="kpi-sub">KB no IndexedDB</div></div>
  `;
  const tobj = {};
  all.forEach((d) => {
    tobj[d.turno || "—"] = (tobj[d.turno || "—"] || 0) + 1;
  });
  const bkT = document.getElementById("bk-turnos");
  bkT.innerHTML = Object.keys(tobj).length
    ? Object.entries(tobj)
        .map(
          ([k, v]) =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--c-border)"><span style="font-size:14px;color:var(--c-text2)">${k}</span><span class="badge b-amber">${v} reg.</span></div>`,
        )
        .join("")
    : '<div class="empty-state" style="padding:20px"><div class="empty-text">Sem dados</div></div>';
}

async function limparTudo() {
  await idbClear("checklists");
  renderHistorico();
  renderBackup();
  toast("🗑 Histórico limpo", "red");
}

// ══════════════════════════════════════════════
//  PDF GENERATOR
// ══════════════════════════════════════════════
function gerarPDF(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210,
    M = 14;
  let y = 14;
  doc.setFillColor(17, 16, 8);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(240, 160, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("CHECKLIST DE PRODUÇÃO — PADARIA", W / 2, 12, {
    align: "center",
  });
  doc.setTextColor(176, 168, 136);
  doc.setFontSize(9);
  doc.text("PONTO CERTO SUPERMERCADO", W / 2, 19, { align: "center" });
  doc.setTextColor(100, 90, 80);
  doc.setFontSize(8);
  doc.text("Gerado em: " + new Date().toLocaleDateString("pt-BR"), W / 2, 25, {
    align: "center",
  });
  y = 40;
  doc.setFillColor(240, 235, 220);
  doc.roundedRect(M, y, W - M * 2, 20, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 80, 20);
  doc.text("DATA: " + fd(d.data), M + 4, y + 5);
  doc.text("TURNO: " + (d.turno || "—"), M + 55, y + 5);
  doc.text("EQUIPE: " + (d.equipe || "—"), M + 100, y + 5);
  const expStr =
    d.expIni && d.expFim
      ? `${d.expIni} → ${d.expFim}${d.expTotal ? " (" + d.expTotal + ")" : ""}`
      : "";
  if (expStr) {
    doc.setTextColor(120, 90, 20);
    doc.text("EXPEDIENTE: " + expStr, M + 4, y + 13);
  }
  y += 26;
  const sec = (t) => {
    if (y > 265) {
      doc.addPage();
      y = 14;
    }
    doc.setFillColor(28, 25, 16);
    doc.rect(M, y, W - M * 2, 8, "F");
    doc.setTextColor(240, 160, 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t, M + 3, y + 5.5);
    y += 12;
  };
  if (d.produtos?.length) {
    sec("1. TIPO DE PRODUÇÃO");
    d.produtos.forEach((p) => {
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `• ${p.nome}   ${p.kg ? p.kg + " kg" : ""}   ${p.tempo || ""}`,
        M + 3,
        y,
      );
      y += 5;
    });
    y += 3;
  }
  sec("2. ABERTURA DO SETOR");
  (d.abertura?.items || []).forEach((item) => {
    const ok = item.checked;
    doc.setTextColor(ok ? 40 : 160, ok ? 130 : 40, ok ? 70 : 40);
    doc.setFontSize(8);
    doc.text(ok ? "✓" : "✗", M + 3, y);
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, M + 9, y);
    if (item.obs) {
      doc.setTextColor(100, 100, 100);
      doc.text(item.obs.slice(0, 35), M + 90, y);
    }
    y += 5;
  });
  y += 3;
  sec("3. PRÉ-PRODUÇÃO");
  (d.pre?.items || []).forEach((item) => {
    const ok = item.checked;
    doc.setTextColor(ok ? 40 : 160, ok ? 130 : 40, ok ? 70 : 40);
    doc.setFontSize(8);
    doc.text(ok ? "✓" : "✗", M + 3, y);
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, M + 9, y);
    y += 5;
  });
  y += 3;
  sec("4. FLUXO OPERACIONAL");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 90, 80);
  doc.text("Processo", M + 3, y);
  doc.text("Início", M + 56, y);
  doc.text("Fim", M + 78, y);
  doc.text("Total", M + 100, y);
  doc.text("Problema", M + 124, y);
  y += 5;
  (d.fluxo || []).forEach((f) => {
    doc.setTextColor(50, 50, 50);
    doc.text(f.processo, M + 3, y);
    doc.text(f.inicio || "—", M + 56, y);
    doc.text(f.fim || "—", M + 78, y);
    doc.text(f.total || "—", M + 100, y);
    doc.text((f.problema || "").slice(0, 22), M + 124, y);
    y += 5;
  });
  y += 3;
  if (y > 200) {
    doc.addPage();
    y = 14;
  }
  sec("5. EQUIPAMENTOS");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 90, 80);
  doc.text("Equipamento", M + 3, y);
  doc.text("Ponto", M + 42, y);
  doc.text("Status", M + 100, y);
  doc.text("Ação", M + 128, y);
  y += 5;
  (d.equipamentos || []).forEach((e) => {
    const cl =
      e.status === "OK"
        ? [40, 140, 80]
        : e.status === "Atenção"
          ? [180, 120, 20]
          : [200, 50, 60];
    doc.setTextColor(50, 50, 50);
    doc.text(e.equip, M + 3, y);
    doc.text(e.ponto, M + 42, y);
    doc.setTextColor(...cl);
    doc.text(e.status || "—", M + 100, y);
    doc.setTextColor(80, 80, 80);
    doc.text((e.acao || "").slice(0, 20), M + 128, y);
    y += 5;
  });
  if (d.observacoes?.length) {
    sec("6. OBSERVAÇÕES");
    doc.setFontSize(8);
    d.observacoes.forEach((o) => {
      doc.setTextColor(50, 50, 50);
      doc.text(
        `${o.local || "—"}: ${o.desc || "—"} → ${o.corr || "—"}`,
        M + 3,
        y,
      );
      y += 5;
    });
  }
  const pgs = doc.getNumberOfPages();
  for (let p = 1; p <= pgs; p++) {
    doc.setPage(p);
    doc.setFillColor(17, 16, 8);
    doc.rect(0, 287, W, 10, "F");
    doc.setTextColor(100, 90, 80);
    doc.setFontSize(7);
    doc.text("Criado por Flávio Monteiro — Padaria Ponto Certo", M, 293);
    doc.text(`Pág ${p}/${pgs}`, W - M, 293, { align: "right" });
  }
  doc.save(`checklist_padaria_${d.data || "sem-data"}.pdf`);
  toast("📄 PDF gerado!", "green");
}

// ══════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════
function fd(s) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function today() {
  return new Date().toISOString().split("T")[0];
}

function toast(msg, type = "green") {
  const el = document.getElementById("toast");
  const line = document.getElementById("toast-line");
  const msgEl = document.getElementById("toast-msg");
  msgEl.textContent = msg;
  const c =
    type === "red"
      ? "var(--c-red)"
      : type === "amber"
        ? "var(--c-amber)"
        : "var(--c-green)";
  line.style.background = c;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function openBS(id) {
  document.getElementById(id).classList.add("open");
}
function closeBS(id) {
  document.getElementById(id).classList.remove("open");
}

function confirmAction(msg, fn) {
  const titleEl = document.getElementById("bs-confirm-title");
  const okBtn = document.getElementById("confirm-ok");
  if (titleEl) titleEl.textContent = "Confirmar ação";
  if (okBtn) okBtn.textContent = "Confirmar";
  document.getElementById("confirm-msg").textContent = msg;
  okBtn.onclick = () => {
    fn();
    closeBS("bs-confirm");
  };
  openBS("bs-confirm");
}

// ══════════════════════════════════════════════
//  CONFIG PAGE
// ══════════════════════════════════════════════
function renderConfig() {
  renderCfgSection("ab", CFG.ab, "cfg-ab-list", "cfg-ab-count", "itens");
  renderCfgSection("pre", CFG.pre, "cfg-pre-list", "cfg-pre-count", "itens");
  renderCfgSection(
    "flow",
    CFG.flow,
    "cfg-flow-list",
    "cfg-flow-count",
    "processos",
  );
  renderCfgEqSection();
  renderCfgTurnos();
  renderCfgProdutos();
  renderCfgObsList();
}

function renderCfgSection(section, items, listId, countId, unit) {
  const el = document.getElementById(listId);
  const ct = document.getElementById(countId);
  if (ct) ct.textContent = `${items.length} ${unit}`;
  if (!el) return;
  el.innerHTML = "";
  items.forEach((label, i) => {
    const row = document.createElement("div");
    row.className = "cfg-row";
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--c-border)";
    row.innerHTML = `
      <div style="width:20px;text-align:center;font-size:12px;color:var(--c-text3);font-family:var(--mono)">${i + 1}</div>
      <input type="text" value="${label.replace(/"/g, "&quot;")}" id="cfg-${section}-item-${i}" style="flex:1;font-size:14px;padding:9px 12px;min-height:42px">
      <div class="icon-btn danger" onclick="cfgRemoveItem('${section}',${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;
    el.appendChild(row);
  });
}

function renderCfgEqSection() {
  const el = document.getElementById("cfg-eq-list");
  const ct = document.getElementById("cfg-eq-count");
  if (ct) ct.textContent = `${CFG.eq.length} verificações`;
  if (!el) return;
  el.innerHTML = "";
  CFG.eq.forEach((item, i) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid var(--c-border)";
    row.innerHTML = `
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <input type="text" value="${item.e.replace(/"/g, "&quot;")}" id="cfg-eq-e-${i}" placeholder="Equipamento" style="font-size:13px;padding:9px 10px;min-height:40px">
        <input type="text" value="${item.p.replace(/"/g, "&quot;")}" id="cfg-eq-p-${i}" placeholder="Ponto" style="font-size:13px;padding:9px 10px;min-height:40px">
      </div>
      <div class="icon-btn danger" onclick="cfgRemoveEq(${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;
    el.appendChild(row);
  });
}

function renderCfgTurnos() {
  const el = document.getElementById("cfg-turnos-list");
  if (!el) return;
  const turnos = CFG.turnos || ["☀️ Manhã", "🌤 Tarde", "🌙 Noite"];
  el.innerHTML = "";
  turnos.forEach((t, i) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--c-border)";
    row.innerHTML = `
      <input type="text" value="${t.replace(/"/g, "&quot;")}" id="cfg-turno-${i}" style="flex:1;font-size:14px;padding:9px 12px;min-height:42px">
      <div class="icon-btn danger" onclick="cfgRemoveTurno(${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;
    el.appendChild(row);
  });
}

function renderCfgProdutos() {
  const el = document.getElementById("cfg-produtos-list");
  if (!el) return;
  const prods = CFG.produtos || [];
  el.innerHTML = "";
  prods.forEach((p, i) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--c-border)";
    row.innerHTML = `
      <input type="text" value="${p.replace(/"/g, "&quot;")}" id="cfg-prod-${i}" style="flex:1;font-size:14px;padding:9px 12px;min-height:42px">
      <div class="icon-btn danger" onclick="cfgRemoveProd(${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;
    el.appendChild(row);
  });
}

function renderCfgObsList() {
  const el = document.getElementById("cfg-obs-list");
  const ct = document.getElementById("cfg-obs-count");
  const locs = CFG.obsLocais || [];
  if (ct) ct.textContent = `${locs.length} locais`;
  if (!el) return;
  el.innerHTML = "";
  locs.forEach((loc, i) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--c-border)";
    row.innerHTML = `
      <input type="text" value="${loc.replace(/"/g, "&quot;")}" id="cfg-obs-loc-${i}" style="flex:1;font-size:14px;padding:9px 12px;min-height:42px">
      <div class="icon-btn danger" onclick="cfgRemoveObs(${i})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
    `;
    el.appendChild(row);
  });
}

function cfgAddItem(section) {
  const id = `cfg-${section}-new`;
  const val = document.getElementById(id)?.value.trim();
  if (!val) {
    toast("Digite um nome", "amber");
    return;
  }
  if (section === "ab") CFG.ab.push(val);
  else if (section === "pre") CFG.pre.push(val);
  else if (section === "flow") CFG.flow.push(val);
  document.getElementById(id).value = "";
  renderConfig();
}

function cfgRemoveItem(section, idx) {
  if (section === "ab") CFG.ab.splice(idx, 1);
  else if (section === "pre") CFG.pre.splice(idx, 1);
  else if (section === "flow") CFG.flow.splice(idx, 1);
  renderConfig();
}

function cfgAddEq() {
  const e = document.getElementById("cfg-eq-e")?.value.trim();
  const p = document.getElementById("cfg-eq-p")?.value.trim();
  if (!e || !p) {
    toast("Preencha equipamento e ponto", "amber");
    return;
  }
  CFG.eq.push({ e, p });
  document.getElementById("cfg-eq-e").value = "";
  document.getElementById("cfg-eq-p").value = "";
  renderCfgEqSection();
  document.getElementById("cfg-eq-count").textContent =
    `${CFG.eq.length} verificações`;
}

function cfgRemoveEq(idx) {
  CFG.eq.splice(idx, 1);
  renderCfgEqSection();
  document.getElementById("cfg-eq-count").textContent =
    `${CFG.eq.length} verificações`;
}

function cfgAddTurno() {
  const val = document.getElementById("cfg-turno-new")?.value.trim();
  if (!val) {
    toast("Digite o nome do turno", "amber");
    return;
  }
  if (!CFG.turnos) CFG.turnos = ["☀️ Manhã", "🌤 Tarde", "🌙 Noite"];
  CFG.turnos.push(val);
  document.getElementById("cfg-turno-new").value = "";
  renderCfgTurnos();
}

function cfgRemoveTurno(idx) {
  if (!CFG.turnos) return;
  CFG.turnos.splice(idx, 1);
  renderCfgTurnos();
}

function cfgAddProd() {
  const val = document.getElementById("cfg-prod-new")?.value.trim();
  if (!val) {
    toast("Digite o nome do produto", "amber");
    return;
  }
  if (!CFG.produtos) CFG.produtos = [];
  CFG.produtos.push(val);
  document.getElementById("cfg-prod-new").value = "";
  renderCfgProdutos();
}

function cfgRemoveProd(idx) {
  if (!CFG.produtos) return;
  CFG.produtos.splice(idx, 1);
  renderCfgProdutos();
}

function cfgAddObs() {
  const val = document.getElementById("cfg-obs-new")?.value.trim();
  if (!val) {
    toast("Digite o local", "amber");
    return;
  }
  if (!CFG.obsLocais) CFG.obsLocais = [];
  CFG.obsLocais.push(val);
  document.getElementById("cfg-obs-new").value = "";
  renderCfgObsList();
}

function cfgRemoveObs(idx) {
  if (!CFG.obsLocais) return;
  CFG.obsLocais.splice(idx, 1);
  renderCfgObsList();
}

async function salvarConfig() {
  // Collect live edits from inputs
  const collectSection = (section, prefix, count) => {
    const items = [];
    for (let i = 0; i < count; i++) {
      const v = document
        .getElementById(`cfg-${prefix}-item-${i}`)
        ?.value.trim();
      if (v) items.push(v);
    }
    return items;
  };
  const abCount = document.querySelectorAll('[id^="cfg-ab-item-"]').length;
  const preCount = document.querySelectorAll('[id^="cfg-pre-item-"]').length;
  const flowCount = document.querySelectorAll('[id^="cfg-flow-item-"]').length;
  const eqCount = document.querySelectorAll('[id^="cfg-eq-e-"]').length;
  const turnoCount = document.querySelectorAll('[id^="cfg-turno-"]').length;
  const prodCount = document.querySelectorAll('[id^="cfg-prod-"]').length;
  const obsCount = document.querySelectorAll('[id^="cfg-obs-loc-"]').length;
  if (abCount > 0) CFG.ab = collectSection("ab", "ab", abCount);
  if (preCount > 0) CFG.pre = collectSection("pre", "pre", preCount);
  if (flowCount > 0) CFG.flow = collectSection("flow", "flow", flowCount);
  if (eqCount > 0) {
    CFG.eq = [];
    for (let i = 0; i < eqCount; i++) {
      const e = document.getElementById(`cfg-eq-e-${i}`)?.value.trim();
      const p = document.getElementById(`cfg-eq-p-${i}`)?.value.trim();
      if (e && p) CFG.eq.push({ e, p });
    }
  }
  if (turnoCount > 0) {
    CFG.turnos = [];
    for (let i = 0; i < turnoCount; i++) {
      const v = document.getElementById(`cfg-turno-${i}`)?.value.trim();
      if (v) CFG.turnos.push(v);
    }
  }
  if (prodCount > 0) {
    CFG.produtos = [];
    for (let i = 0; i < prodCount; i++) {
      const v = document.getElementById(`cfg-prod-${i}`)?.value.trim();
      if (v) CFG.produtos.push(v);
    }
  }
  if (obsCount > 0) {
    CFG.obsLocais = [];
    for (let i = 0; i < obsCount; i++) {
      const v = document.getElementById(`cfg-obs-loc-${i}`)?.value.trim();
      if (v) CFG.obsLocais.push(v);
    }
  }
  await saveConfig();
  // Rebuild checklist sections
  buildCheckList("ab", CFG.ab);
  buildCheckList("pre", CFG.pre);
  buildFlowList();
  buildEqList();
  updateTurnoSelect();
  toast("✅ Configurações salvas e aplicadas!", "green");
}

function updateTurnoSelect() {
  const sel = document.getElementById("ck-turno");
  if (!sel) return;
  const turnos = CFG.turnos || ["☀️ Manhã", "🌤 Tarde", "🌙 Noite"];
  const cur = sel.value;
  sel.innerHTML = turnos
    .map((t) => `<option${t === cur ? " selected" : ""}>${t}</option>`)
    .join("");
}

function renderDashProdTimes(all) {
  // Insert card into dashboard if not already there
  const pg = document.getElementById("page-dashboard");
  if (!pg) return;
  let el = document.getElementById("dash-prod-times");
  if (!el) {
    el = document.createElement("div");
    el.id = "dash-prod-times";
    el.className = "card";
    el.style.marginBottom = "12px";
    el.innerHTML = `
      <div class="card-hd"><div class="card-hd-left">
        <div class="card-icon ci-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
        <div class="card-hd-text"><div class="card-hd-title">Tempo por Produto (Média dos últimos 10)</div></div>
      </div></div>
      <div class="card-body"><div style="position:relative;height:200px"><canvas id="ch-prodtimes"></canvas></div></div>
    `;
    // Insert after kpi-wrap
    const kpi = document.getElementById("kpi-wrap");
    if (kpi && kpi.nextSibling) pg.insertBefore(el, kpi.nextSibling);
    else pg.appendChild(el);
  }
  const last10 = all.slice(-10);
  const prodMap = {};
  last10.forEach((d) =>
    (d.produtos || []).forEach((p) => {
      if (!p.nome || !p.ini || !p.fim) return;
      const [h1, m1] = p.ini.split(":").map(Number);
      const [h2, m2] = p.fim.split(":").map(Number);
      let diff = h2 * 60 + m2 - (h1 * 60 + m1);
      if (diff < 0) diff += 1440;
      if (!prodMap[p.nome]) prodMap[p.nome] = [];
      prodMap[p.nome].push(diff);
    }),
  );
  const labels = Object.keys(prodMap);
  const data = labels.map((k) =>
    Math.round(prodMap[k].reduce((a, b) => a + b, 0) / prodMap[k].length),
  );
  if (!labels.length) return;
  const ctx = document.getElementById("ch-prodtimes")?.getContext("2d");
  if (!ctx) return;
  if (charts.cprod) charts.cprod.destroy();
  charts.cprod = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "min",
          data,
          backgroundColor: "rgba(155,114,207,.7)",
          borderColor: "#9b72cf",
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: "#726a54" }, grid: { color: "#3a3628" } },
        x: {
          ticks: { color: "#b0a888", font: { size: 10 } },
          grid: { display: false },
        },
      },
    },
  });
}

// boot
init();
