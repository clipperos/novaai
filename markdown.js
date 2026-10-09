/* =====================================================================
   markdown.js — lehký a bezpečný převod Markdownu na HTML.
   Podporuje: nadpisy, tučné/kurzíva, `inline kód`, ```bloky```,
   seznamy, citace, odkazy, oddělovače. Vstup se nejdřív escapuje.
   ===================================================================== */

const Markdown = (() => {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;");

  function inline(s) {
    // inline kód
    s = s.replace(/`([^`\n]+)`/g, (_, c) => "<code>" + c + "</code>");
    // tučné
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    // kurzíva
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
    // odkazy [text](url)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function textBlock(text) {
    const lines = text.split("\n");
    let html = "";
    let para = [];
    let list = null; // "ul" | "ol"

    const flushPara = () => {
      if (para.length) {
        html += "<p>" + inline(para.join("<br>")) + "</p>";
        para = [];
      }
    };
    const flushList = () => {
      if (list) { html += "</" + list.tag + ">"; list = null; }
    };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, "");

      if (!line.trim()) { flushPara(); flushList(); continue; }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { flushPara(); flushList(); const lvl = h[1].length; html += "<h" + lvl + ">" + inline(h[2]) + "</h" + lvl + ">"; continue; }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flushPara(); flushList(); html += "<hr>"; continue; }

      const q = line.match(/^>\s?(.*)$/);
      if (q) { flushPara(); flushList(); html += "<blockquote>" + inline(q[1]) + "</blockquote>"; continue; }

      const ul = line.match(/^[-*+]\s+(.*)$/);
      if (ul) {
        flushPara();
        if (!list || list.tag !== "ul") { flushList(); html += "<ul>"; list = { tag: "ul" }; }
        html += "<li>" + inline(ul[1]) + "</li>"; continue;
      }
      const ol = line.match(/^\d+\.\s+(.*)$/);
      if (ol) {
        flushPara();
        if (!list || list.tag !== "ol") { flushList(); html += "<ol>"; list = { tag: "ol" }; }
        html += "<li>" + inline(ol[1]) + "</li>"; continue;
      }

      flushList();
      para.push(line);
    }
    flushPara();
    flushList();
    return html;
  }

  function codeBlock(code, lang) {
    const language = (lang || "kód").trim() || "kód";
    return (
      '<div class="code-block">' +
        '<div class="code-head">' +
          '<span class="code-lang">' + esc(language) + "</span>" +
          '<button class="copy-btn" type="button">Kopírovat</button>' +
        "</div>" +
        "<pre><code>" + esc(code.replace(/\n$/, "")) + "</code></pre>" +
      "</div>"
    );
  }

  function render(md) {
    if (!md) return "";
    const parts = String(md).split("```");
    let out = "";
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        const nl = part.indexOf("\n");
        let lang = "", code = part;
        if (nl !== -1) { lang = part.slice(0, nl); code = part.slice(nl + 1); }
        out += codeBlock(code, lang);
      } else {
        out += textBlock(part);
      }
    });
    return out;
  }

  return { render };
})();
