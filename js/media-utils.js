/**
 * Utilitários de texto, slugs, segurança HTML e detecção/incorporação de vídeos e fotos.
 */

export function slugify(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converte URLs de YouTube, Vimeo, Loom ou arquivos de vídeo diretos (MP4/WebM/Ogg/DataURL/Upload local)
 * em um objeto padronizado para renderização no player.
 */
export function parseVideoSource(rawUrl = "") {
  const url = String(rawUrl || "").trim();
  if (!url) return null;

  // YouTube: watch?v=, youtu.be/, shorts/, embed/
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  if (ytMatch) {
    return {
      kind: "iframe",
      provider: "YouTube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`,
      originalUrl: url,
    };
  }

  // Vimeo: vimeo.com/123456789 ou player.vimeo.com/video/123456789
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i
  );
  if (vimeoMatch) {
    return {
      kind: "iframe",
      provider: "Vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      originalUrl: url,
    };
  }

  // Loom: loom.com/share/abc ou loom.com/embed/abc
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([A-Za-z0-9]+)/i);
  if (loomMatch) {
    return {
      kind: "iframe",
      provider: "Loom",
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
      originalUrl: url,
    };
  }

  // Vídeo direto (MP4, WebM, Ogg, blob:, data:video/, /uploads/...)
  if (
    /^data:video\//i.test(url) ||
    /^blob:/i.test(url) ||
    /^\/uploads\//i.test(url) ||
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) ||
    url.includes("/storage/v1/object/public/")
  ) {
    return {
      kind: "video",
      provider: "Vídeo",
      embedUrl: url,
      originalUrl: url,
    };
  }

  // Fallback seguro para links externos HTTP(S)
  if (/^https?:\/\//i.test(url)) {
    return {
      kind: "link",
      provider: "Link Externo",
      embedUrl: url,
      originalUrl: url,
    };
  }

  return null;
}

/**
 * Formata texto explicativo simples em HTML seguro e legível:
 * - "## Título" -> subtítulo de seção
 * - "> Dica: ..." -> caixa de destaque dourada
 * - "- item" ou "* item" -> lista com marcadores
 * - "1. passo" -> lista numerada
 * - "**negrito**" e "`código`" inline
 */
export function renderRichText(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) return "";

  const formatInline = (line) =>
    escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const lines = text.split(/\r?\n/);
  const blocks = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    blocks.push(`<${listType}>${listItems.join("")}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(`<h3>${formatInline(line.slice(3))}</h3>`);
      continue;
    }

    if (line.startsWith("# ")) {
      flushList();
      blocks.push(`<h2>${formatInline(line.slice(2))}</h2>`);
      continue;
    }

    if (line.startsWith("> ")) {
      flushList();
      blocks.push(`<blockquote class="callout">${formatInline(line.slice(2))}</blockquote>`);
      continue;
    }

    const ulMatch = line.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    flushList();
    blocks.push(`<p>${formatInline(line)}</p>`);
  }

  flushList();
  return blocks.join("\n");
}

export function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const ICON_PRESETS = [
  "📊",
  "👥",
  "🚗",
  "💰",
  "💬",
  "⚙️",
  "📁",
  "🚀",
  "📱",
  "🗺️",
  "🛡️",
  "📄",
  "🔔",
  "🎯",
  "💳",
  "🎥",
  "🧩",
  "✨",
];

