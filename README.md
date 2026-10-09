# NOVA AI ✨

Barevný AI asistent pro **chat i programování**. Běží na tvém PC i na webu (Vercel).

```
index.html            – vzhled a rozložení
assets/css/style.css  – styl (barevné, světlý/tmavý režim)
assets/js/store.js    – ukládání historie a nastavení (localStorage)
assets/js/markdown.js – převod Markdownu (kód, seznamy, odkazy…)
assets/js/ai.js       – klient: posílá dotazy na /api/chat
assets/js/app.js      – ovládání celé aplikace
api/chat.js           – serverless funkce: drží API klíč a volá model
vercel.json           – nastavení pro Vercel
.env.example          – vzor proměnných (klíč apod.)
```

## 🖥️ Spustit lokálně (na PC)

**Nejjednodušeji:** dvojklik na `index.html`. Poběží v **DEMO režimu**
(menu i chat fungují, jen bez skutečných odpovědí).

**S opravdovou AI lokálně:** potřebuješ Node.js a Vercel CLI.

```powershell
npm i -g vercel
copy .env.example .env      # vyplň AI_API_KEY
vercel dev                  # otevři adresu, kterou vypíše (http://localhost:3000)
```

## 🌐 Nasadit na Vercel (web)

1. Nahraj složku na **GitHub** (nebo použij `vercel`).
2. Na [vercel.com](https://vercel.com) → **Add New → Project** → vyber repozitář → **Deploy**.
   Vercel sám pozná statické soubory i složku `api/`.
3. V projektu → **Settings → Environment Variables** přidej klíč (viz níže).
4. Klikni **Redeploy**.

Nebo z terminálu:

```powershell
npm i -g vercel
vercel            # první nasazení
vercel --prod     # ostrá verze
```

### Proměnné prostředí (Settings → Environment Variables)

| Název | Význam | Příklad |
|---|---|---|
| `AI_API_KEY` | klíč k modelu | `sk-...` |
| `AI_BASE_URL` | adresa API (nepovinné) | `https://api.openai.com/v1` |
| `AI_MODEL` | název modelu (nepovinné) | `gpt-4o-mini` |
| `AI_PROVIDER` | `anthropic` pro Claude | `anthropic` |

Podporuje všechny **OpenAI-kompatibilní** služby (OpenAI, Groq, OpenRouter,
Ollama, LM Studio…) i **Anthropic Claude**. Příklady najdeš v `.env.example`.

> 🔒 **Bezpečnost:** API klíč nikdy nedávej do `index.html` ani do JS.
> Vždy patří do proměnných prostředí – tam ho drží `api/chat.js`.

## 🎨 Co umí

- 💬 Chat i 💻 programátorský režim (přepínač nad vstupem)
- 🗂️ Historie chatů – ukládá se v prohlížeči, dá se mazat
- 🌗 Světlý a tmavý režim
- 📋 Kopírování odpovědí i bloků kódu, tlačítko „Znovu“
- ⏹️ Zastavení generování
- ✍️ Markdown (kód, seznamy, nadpisy, odkazy)
- 📱 Funguje na mobilu
