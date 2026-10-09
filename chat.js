/* =====================================================================
   api/chat.js — serverless funkce pro Vercel.
   Drží API klíč v bezpečí (proměnné prostředí) a posílá dotaz modelu.
   Podporuje OpenAI-kompatibilní služby (OpenAI, Groq, OpenRouter,
   Ollama, LM Studio…) i Anthropic (Claude).

   Nastav na Vercelu (Settings → Environment Variables), nebo lokálně v .env:
     AI_API_KEY = tvůj klíč
     AI_BASE_URL = (nepovinné) https://api.openai.com/v1
     AI_MODEL = (nepovinné) gpt-4o-mini
     AI_PROVIDER = (nepovinné) "anthropic" pro Claude
   ===================================================================== */

const SYSTEM = {
  chat: "Jsi NOVA AI, přátelský a všestranný osobní asistent. Odpovídej česky, srozumitelně, strukturovaně a k věci.",
  code: "Jsi NOVA AI v režimu programátorského asistenta. Odpovídej česky. Kód vždy vracej v ```blocích``` s uvedením jazyka.",
};

function demoReply(messages, mode) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  const text = last ? String(last.content || "").trim() : "";
  if (mode === "code") {
    return "Běžím v **DEMO režimu** – na serveru chybí `AI_API_KEY`.\n\nTvůj požadavek:\n```text\n" + text + "\n```";
  }
  return "Ahoj! 👋 Jsem **NOVA AI** v DEMO režimu.\n\nNa serveru stačí nastavit `AI_API_KEY` a budu odpovídat naplno.";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Použij metodu POST." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  if (!body || typeof body !== "object") body = {};

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const mode = body.mode === "code" ? "code" : "chat";
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;

  const provider = (process.env.AI_PROVIDER || "").toLowerCase();
  const apiKey =
    process.env.AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY || "";
  const baseUrl = (process.env.AI_BASE_URL || "").replace(/\/+$/, "");
  const isAnthropic = provider === "anthropic" || baseUrl.includes("anthropic.com");
  const model =
    body.model ||
    process.env.AI_MODEL ||
    (isAnthropic ? "claude-3-5-sonnet-latest" : "gpt-4o-mini");

  // Bez klíče i bez vlastní URL → demo režim (stránka pořád funguje)
  if (!apiKey && !baseUrl) {
    res.status(200).json({ demo: true, reply: demoReply(incoming, mode) });
    return;
  }

  // Vyčistit historii na to, co model očekává
  const chat = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    let reply;

    if (isAnthropic) {
      const url = (baseUrl || "https://api.anthropic.com/v1") + "/messages";
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature,
          system: SYSTEM[mode],
          messages: chat,
        }),
      });
      const data = await safeJson(r);
      if (!r.ok) throw new Error(errMsg(data, r));
      reply = data && data.content && data.content[0] && data.content[0].text;
    } else {
      // OpenAI-kompatibilní (OpenAI, Groq, OpenRouter, Ollama, …)
      const url = (baseUrl || "https://api.openai.com/v1") + "/chat/completions";
      const headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = "Bearer " + apiKey;

      const r = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          temperature,
          messages: [{ role: "system", content: SYSTEM[mode] }, ...chat],
        }),
      });
      const data = await safeJson(r);
      if (!r.ok) throw new Error(errMsg(data, r));
      reply = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    }

    if (!reply) throw new Error("Model nevrátil žádnou odpověď.");
    res.status(200).json({ reply, model });
  } catch (err) {
    res.status(502).json({ error: "Nepodařilo se získat odpověď: " + (err.message || err) });
  }
};

async function safeJson(r) { try { return await r.json(); } catch (_) { return null; } }

function errMsg(data, r) {
  if (data) {
    if (typeof data.error === "string") return data.error;
    if (data.error && data.error.message) return data.error.message;
    if (typeof data.message === "string") return data.message;
  }
  return "HTTP " + r.status;
}
