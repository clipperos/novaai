/* =====================================================================
   app.js — veškeré ovládání aplikace (menu, chat, historie, nastavení)
   ===================================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let generating = null;   // { controller }
let lastDemo = false;    // zda poslední odpověď přišla z dema

/* ------------------------------ Pomocné ------------------------------ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SUGGESTIONS = {
  chat: [
    { ico: "💡", t: "Vysvětli mi to jednoduše", s: "Např. kvantovou fyziku nebo fotosyntézu" },
    { ico: "✍️", t: "Pomoz mi napsat text", s: "E-mail, článek, popisek na sítě" },
    { ico: "🧠", t: "Vymysli nápady", s: "Názvy, plány, brainstorming" },
    { ico: "🌍", t: "Zodpověz otázku", s: "Cokoliv, co tě zajímá" },
  ],
  code: [
    { ico: "🐍", t: "Napiš Python funkci", s: "Třídění, parsování, skript" },
    { ico: "🐞", t: "Oprav mi chybu v kódu", s: "Vlož kód a popiš problém" },
    { ico: "🌐", t: "Vytvoř webovou stránku", s: "HTML, CSS, JavaScript" },
    { ico: "📘", t: "Vysvětli mi kód", s: "Co dělá řádek po řádku" },
  ],
};

/* --------------------------- Vyfukování zpráv ------------------------ */
function currentConv() {
  let c = Store.getCurrent();
  if (!c) c = Store.newConversation();
  return c;
}

function convTitleOf(c) {
  if (c.title && c.title !== "Nový chat") return c.title;
  return "Nový chat";
}

/* ------------------------------ Sidebar ------------------------------ */
function renderConvList() {
  const list = $("#convList");
  list.innerHTML = "";
  const convs = Store.list();
  if (!convs.length) {
    list.innerHTML = '<div class="conv-item" style="cursor:default;color:var(--muted-2)">Zatím žádná historie</div>';
    return;
  }
  const cur = currentConv();
  for (const c of convs) {
    const item = document.createElement("div");
    item.className = "conv-item" + (c.id === cur.id ? " active" : "");
    item.dataset.id = c.id;
    item.innerHTML =
      '<span class="em">' + (c.mode === "code" ? "💻" : "💬") + "</span>" +
      '<span class="t"></span>' +
      '<button class="del" title="Smazat">✕</button>';
    item.querySelector(".t").textContent = convTitleOf(c);

    item.addEventListener("click", (e) => {
      if (e.target.closest(".del")) return;
      selectConv(c.id);
    });
    item.querySelector(".del").addEventListener("click", (e) => {
      e.stopPropagation();
      Store.remove(c.id);
      const c2 = Store.ensureCurrent();
      renderConvList();
      renderConversation(c2);
    });
    list.appendChild(item);
  }
}

function selectConv(id) {
  Store.setCurrent(id);
  const c = currentConv();
  renderConvList();
  renderConversation(c);
  closeMobileSidebar();
}

/* --------------------------- Vykreslení chatu ------------------------ */
function renderConversation(conv) {
  const box = $("#messages");
  box.innerHTML = "";

  const empty = !conv.messages.length;
  $("#welcome").hidden = !empty;
  box.hidden = empty;

  setModeChips(conv.mode);

  for (const m of conv.messages) {
    addMessageDOM(m.role, m.text, false);
  }
  scrollDown(false);
}

function addMessageDOM(role, text, animate = true) {
  const box = $("#messages");
  box.hidden = false;

  const msg = document.createElement("div");
  msg.className = "msg " + role;
  if (!animate) msg.style.animation = "none";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "🙂" : "N";

  const body = document.createElement("div");
  body.className = "msg-body";

  const name = document.createElement("div");
  name.className = "msg-name";
  name.textContent = role === "user" ? "Ty" : "NOVA AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  body.appendChild(name);
  body.appendChild(bubble);

  if (role === "user") {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = Markdown.render(text);
  }

  // akce
  const actions = document.createElement("div");
  actions.className = "msg-actions";
  const copy = document.createElement("button");
  copy.className = "act-btn"; copy.textContent = "Kopírovat";
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(text).then(() => {
      copy.textContent = "Zkopírováno ✓";
      setTimeout(() => (copy.textContent = "Kopírovat"), 1500);
    });
  });
  actions.appendChild(copy);
  if (role === "assistant") {
    const regen = document.createElement("button");
    regen.className = "act-btn"; regen.textContent = "Znovu";
    regen.addEventListener("click", regenerate);
    actions.appendChild(regen);
  }
  body.appendChild(actions);

  msg.appendChild(avatar);
  msg.appendChild(body);
  box.appendChild(msg);
  if (animate) scrollDown();
  return { msg, bubble };
}

function scrollDown(smooth = true) {
  const area = $("#chatArea");
  area.scrollTo({ top: area.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

/* ------------------------------ Odeslání ----------------------------- */
async function sendMessage(text) {
  text = text.trim();
  if (!text || generating) return;

  const conv = currentConv();
  conv.mode = conv.mode || "chat";

  hideWelcome();
  Store.addMessage(conv, "user", text);
  addMessageDOM("user", text);
  renderConvList();

  const ta = $("#input");
  ta.value = ""; autoResize(ta);

  await runAssistant(conv);
}

async function runAssistant(conv) {
  const { bubble, msg } = addMessageDOM("assistant", "#typing#", false);
  bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  scrollDown();

  generating = { controller: new AbortController() };
  setGeneratingUI(true);

  const s = Store.getSettings();
  const payload = conv.messages.map((m) => ({ role: m.role, text: m.text }));

  try {
    const res = await AI.chat(payload, {
      mode: conv.mode,
      model: s.model,
      temperature: s.temperature,
      signal: generating.controller.signal,
    });

    lastDemo = res.demo;
    updateStatus();

    // "streamovací" efekt: nejdřív odhalíme text, pak vykreslíme markdown
    await revealText(bubble, res.text, generating.controller.signal);
    bubble.innerHTML = Markdown.render(res.text);

    Store.addMessage(conv, "assistant", res.text);
    renderConvList();

    // nahraď akce (regen tlačítko přiřadí správný handler)
    bindActions(msg, res.text);
  } catch (err) {
    if (err && err.name === "AbortError") {
      bubble.innerHTML = Markdown.render("_(generování zastaveno)_");
      setTimeout(() => msg.remove(), 700);
    } else {
      bubble.innerHTML = Markdown.render("⚠️ **Chyba:** " + (err.message || err));
    }
  } finally {
    generating = null;
    setGeneratingUI(false);
    scrollDown();
  }
}

function bindActions(msg, text) {
  const actions = msg.querySelector(".msg-actions");
  actions.innerHTML = "";
  const copy = document.createElement("button");
  copy.className = "act-btn"; copy.textContent = "Kopírovat";
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(text).then(() => {
      copy.textContent = "Zkopírováno ✓";
      setTimeout(() => (copy.textContent = "Kopírovat"), 1500);
    });
  });
  const regen = document.createElement("button");
  regen.className = "act-btn"; regen.textContent = "Znovu";
  regen.addEventListener("click", regenerate);
  actions.appendChild(copy);
  actions.appendChild(regen);
}

async function regenerate() {
  if (generating) return;
  const conv = currentConv();
  // najdi poslední user zprávu, zahoď, co přišlo po ní
  let lastUser = -1;
  for (let i = conv.messages.length - 1; i >= 0; i--) {
    if (conv.messages[i].role === "user") { lastUser = i; break; }
  }
  if (lastUser < 0) return;
  conv.messages = conv.messages.slice(0, lastUser + 1);
  Store.persist();
  renderConversation(conv);
  await runAssistant(conv);
}

async function revealText(el, text, signal) {
  const total = text.length;
  if (total > 2400) { el.textContent = text; return; } // dlouhé nechej hned
  const duration = Math.min(1500, Math.max(350, total * 5));
  const start = performance.now();
  return new Promise((resolve) => {
    function step(now) {
      if (signal && signal.aborted) { el.textContent = text; resolve(); return; }
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = text.slice(0, Math.floor(total * eased));
      scrollDown(false);
      if (t < 1) requestAnimationFrame(step);
      else { el.textContent = text; resolve(); }
    }
    requestAnimationFrame(step);
  });
}

function hideWelcome() {
  $("#welcome").hidden = true;
  $("#messages").hidden = false;
}

/* --------------------------- Generování – UI ------------------------- */
function setGeneratingUI(on) {
  const send = $("#sendBtn"), stop = $("#stopBtn");
  send.disabled = on;
  stop.hidden = !on;
}
$("#stopBtn").addEventListener("click", () => {
  if (generating) generating.controller.abort();
});

/* ------------------------------ Composer ----------------------------- */
function autoResize(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
}

$("#composer").addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage($("#input").value);
});

$("#input").addEventListener("input", (e) => autoResize(e.target));
$("#input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#composer").requestSubmit();
  }
});

/* ------------------------------ Režim ------------------------------- */
function setModeChips(mode) {
  $$(".mode-chip").forEach((c) => c.classList.toggle("active", c.dataset.mode === mode));
  renderSuggestions(mode);
}
$$(".mode-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const conv = currentConv();
    conv.mode = chip.dataset.mode;
    Store.persist();
    setModeChips(conv.mode);
    renderConvList();
  });
});

function renderSuggestions(mode) {
  const wrap = $("#suggestions");
  wrap.innerHTML = "";
  (SUGGESTIONS[mode] || SUGGESTIONS.chat).forEach((s) => {
    const b = document.createElement("button");
    b.className = "suggestion";
    b.innerHTML = '<span class="s-ico"></span><span class="s-txt"><b></b><span></span></span>';
    b.querySelector(".s-ico").textContent = s.ico;
    b.querySelector("b").textContent = s.t;
    b.querySelector(".s-txt span").textContent = s.s;
    b.addEventListener("click", () => {
      $("#input").value = s.t + " – ";
      autoResize($("#input"));
      $("#input").focus();
    });
    wrap.appendChild(b);
  });
}

/* ------------------------------ Nový chat ---------------------------- */
$("#newChat").addEventListener("click", () => {
  const mode = (currentConv().mode) || "chat";
  const c = Store.newConversation(mode);
  renderConvList();
  renderConversation(c);
  closeMobileSidebar();
  $("#input").focus();
});

/* ------------------------------ Téma -------------------------------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  Store.setTheme(theme);
  const dark = theme === "dark";
  $("#themeIco").textContent = dark ? "🌙" : "☀️";
  $("#themeTxt").textContent = dark ? "Tmavý režim" : "Světlý režim";
  const sel = $("#setTheme");
  if (sel) sel.value = theme;
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
}
$("#themeBtn").addEventListener("click", toggleTheme);

/* ------------------------------ Modaly ------------------------------- */
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }
$$("[data-close]").forEach((b) => b.addEventListener("click", () => {
  $$(".modal").forEach((m) => (m.hidden = true));
}));
$$(".modal").forEach((m) => m.addEventListener("click", (e) => {
  if (e.target === m) m.hidden = true;
}));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".modal").forEach((m) => (m.hidden = true));
});

$("#settingsBtn").addEventListener("click", openSettings);
$("#modelPill").addEventListener("click", openSettings);
$("#aboutBtn").addEventListener("click", () => openModal("#aboutModal"));
$("#closeSettings").addEventListener("click", () => closeModal("#settingsModal"));

function openSettings() {
  const s = Store.getSettings();
  $("#setMode").value = s.mode || "auto";
  $("#setModel").value = s.model || "";
  $("#setTemp").value = s.temperature ?? 0.7;
  $("#tempOut").textContent = Number(s.temperature ?? 0.7).toFixed(1);
  $("#setTheme").value = document.documentElement.getAttribute("data-theme");
  openModal("#settingsModal");
}

$("#setTemp").addEventListener("input", (e) => ($("#tempOut").textContent = Number(e.target.value).toFixed(1)));
$("#setTheme").addEventListener("change", (e) => applyTheme(e.target.value));

$("#saveSettings").addEventListener("click", () => {
  Store.saveSettings({
    mode: $("#setMode").value,
    model: $("#setModel").value.trim(),
    temperature: parseFloat($("#setTemp").value),
  });
  updateStatus();
  updateModelName();
  closeModal("#settingsModal");
});

$("#wipeData").addEventListener("click", () => {
  if (!confirm("Opravdu vymazat všechny chaty i nastavení?")) return;
  Store.clearAll();
  Store.saveSettings({ mode: "auto", model: "", temperature: 0.7 });
  const c = Store.ensureCurrent();
  renderConvList();
  renderConversation(c);
  closeModal("#settingsModal");
});

/* ------------------------------ Stav / model ------------------------- */
function updateStatus() {
  const s = Store.getSettings();
  const el = $("#status");
  let text, online;
  if (s.mode === "demo") { text = "Demo režim"; online = false; }
  else if (lastDemo) { text = "Demo režim"; online = false; }
  else { text = "Připraveno"; online = true; }
  $("#statusText").textContent = text;
  el.classList.toggle("online", online);
}
function updateModelName() {
  const s = Store.getSettings();
  $("#modelName").textContent = s.model || "NOVA";
}

/* --------------------------- Sidebar collapse ------------------------ */
function closeMobileSidebar() {
  $("#sidebar").classList.remove("open");
  $("#overlay").classList.remove("show");
}
$("#menuToggle").addEventListener("click", () => {
  $("#sidebar").classList.add("open");
  $("#overlay").classList.add("show");
});
$("#overlay").addEventListener("click", closeMobileSidebar);
$("#collapseBtn").addEventListener("click", () => {
  $("#app").classList.add("collapsed");
  $("#openSidebar").hidden = false;
});
$("#openSidebar").addEventListener("click", () => {
  $("#app").classList.remove("collapsed");
  $("#openSidebar").hidden = true;
});

/* --------------------- Kopírování bloků kódu (delegace) -------------- */
$("#messages").addEventListener("click", (e) => {
  const btn = e.target.closest(".copy-btn");
  if (!btn) return;
  const code = btn.closest(".code-block").querySelector("code");
  navigator.clipboard.writeText(code.textContent).then(() => {
    btn.textContent = "Zkopírováno ✓";
    setTimeout(() => (btn.textContent = "Kopírovat"), 1500);
  });
});

/* ------------------------------ Start -------------------------------- */
function boot() {
  applyTheme(Store.getTheme());
  const conv = Store.ensureCurrent();
  updateStatus();
  updateModelName();
  renderConvList();
  renderConversation(conv);
  $("#input").focus();
}

boot();
