/* =====================================================================
   store.js — ukládání konverzací a nastavení do prohlížeče (localStorage)
   ===================================================================== */

const Store = (() => {
  const K_CONV = "nova.convs.v2";
  const K_CUR = "nova.current.v2";
  const K_SET = "nova.settings.v2";
  const K_THEME = "nova.theme.v2";

  const DEFAULT_SETTINGS = { mode: "auto", model: "", temperature: 0.7, theme: "dark" };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Konverzace ---------- */
  let convs = read(K_CONV, []);
  let currentId = read(K_CUR, null);

  function ensureCurrent() {
    if (!convs.length) {
      const c = newConversation();
      return c;
    }
    if (!currentId || !convs.find((c) => c.id === currentId)) {
      currentId = convs[0].id;
      write(K_CUR, currentId);
    }
    return getCurrent();
  }

  function newConversation(mode = "chat") {
    const c = { id: uid(), title: "Nový chat", mode, messages: [], createdAt: Date.now() };
    convs.unshift(c);
    currentId = c.id;
    persist();
    return c;
  }

  function getCurrent() { return convs.find((c) => c.id === currentId) || null; }
  function list() { return convs; }
  function setCurrent(id) { currentId = id; write(K_CUR, id); return getCurrent(); }
  function remove(id) {
    convs = convs.filter((c) => c.id !== id);
    if (currentId === id) currentId = convs.length ? convs[0].id : null;
    persist();
  }

  function addMessage(conv, role, text) {
    conv.messages.push({ role, text, at: Date.now() });
    if (role === "user" && (conv.title === "Nový chat" || !conv.title)) {
      conv.title = text.replace(/\s+/g, " ").trim().slice(0, 42) || "Nový chat";
    }
    if (role === "assistant") {
      // přiřaď zpět do seznamu, kdyby objekt nebyl referencí
      const idx = convs.findIndex((c) => c.id === conv.id);
      if (idx > -1) convs[idx] = conv;
    }
    persist();
  }

  function setMessages(conv) { persist(); }

  function persist() {
    write(K_CONV, convs);
    write(K_CUR, currentId);
  }

  function clearAll() {
    convs = [];
    currentId = null;
    try { localStorage.removeItem(K_CONV); localStorage.removeItem(K_CUR); } catch (_) {}
  }

  /* ---------- Nastavení ---------- */
  let settings = Object.assign({}, DEFAULT_SETTINGS, read(K_SET, {}));
  function getSettings() { return { ...settings }; }
  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch);
    write(K_SET, settings);
    return getSettings();
  }

  /* ---------- Téma ---------- */
  function getTheme() { return read(K_THEME, "dark"); }
  function setTheme(t) { write(K_THEME, t); }

  return {
    ensureCurrent, newConversation, getCurrent, list, setCurrent, remove,
    addMessage, persist, clearAll,
    getSettings, saveSettings, getTheme, setTheme,
  };
})();
