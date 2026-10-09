/* =====================================================================
   ai.js — klient pro komunikaci s AI.
   Posílá zprávy na serverless funkci /api/chat (ta drží API klíč v bezpečí).
   Když server není dostupný (např. otevřeno přes file:// nebo offline),
   plynule přepne do DEMO režimu, aby aplikace vždy "žila".
   ===================================================================== */

const AI = (() => {
  const SYSTEM = {
    chat: "Jsi NOVA AI, přátelský a všestranný osobní asistent. Odpovídej česky, srozumitelně, strukturovaně a k věci.",
    code: "Jsi NOVA AI v režimu programátorského asistenta. Odpovídej česky. Kód vždy vracej v ```blocích``` s uvedením jazyka a stručně ho okomentuj.",
  };

  function demoReply(messages, mode) {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last ? String(last.text).trim() : "";
    if (!text) return "Napiš prosím nějakou zprávu 🙂";

    if (mode === "code") {
      return (
        "Jsem v **DEMO režimu**, takže ještě nejsem připojený k modelu.\n\n" +
        "Až se zapojí (na Vercelu stačí nastavit `AI_API_KEY`), odpovím naplno. Tvůj požadavek jsem přijal:\n\n" +
        "```text\n" + text + "\n```"
      );
    }
    return (
      "Ahoj! 👋 Jsem **NOVA AI** a zatím běžím v DEMO režimu.\n\n" +
      "Rozuměl jsem: „" + text + "“\n\n" +
      "Menu, historie i psaní fungují. Na skutečné odpovědi stačí na serveru nastavit `AI_API_KEY` (viz README)."
    );
  }

  /**
   * @param {Array<{role,text}>} messages
   * @param {{mode, model, temperature, signal}} opts
   * @returns {Promise<{text:string, demo:boolean}>}
   */
  async function chat(messages, opts = {}) {
    const { mode = "chat", model = "", temperature = 0.7, signal } = opts;
    const body = {
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
      mode, model, temperature,
    };

    let reached = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      reached = true;

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.reply === "string") {
          return { text: data.reply, demo: !!data.demo };
        }
        if (data && data.error) throw new Error(data.error);
      }
      let msg = "Server vrátil chybu " + res.status;
      try { const d = await res.json(); if (d.error) msg = d.error; } catch (_) {}
      throw new Error(msg);
    } catch (err) {
      if (err && err.name === "AbortError") throw err;
      if (reached) throw err;              // server odpověděl chybou → ukaž ji
      // server nedostupný (file://, offline) → demo
      await sleep(400);
      return { text: demoReply(messages, mode), demo: true };
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  return { chat, systemPrompt: (m) => SYSTEM[m] || SYSTEM.chat };
})();
