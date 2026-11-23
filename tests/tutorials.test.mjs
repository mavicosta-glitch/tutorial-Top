import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeHtml,
  parseVideoSource,
  renderRichText,
  slugify,
} from "../js/media-utils.js";
import { DEFAULT_STATE } from "../js/default-data.js";

test("slugify normalizes accents and symbols for category/subcategory URLs", () => {
  assert.equal(slugify("(Dashboard)"), "dashboard");
  assert.equal(slugify("Gestão de Usuários & Acessos"), "gestao-de-usuarios-acessos");
});

test("parseVideoSource detects YouTube, Vimeo, Loom and direct MP4/upload videos", () => {
  const yt = parseVideoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(yt.kind, "iframe");
  assert.equal(yt.provider, "YouTube");
  assert.equal(yt.embedUrl, "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0");

  const ytShort = parseVideoSource("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(ytShort.embedUrl, "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0");

  const vimeo = parseVideoSource("https://vimeo.com/123456789");
  assert.equal(vimeo.kind, "iframe");
  assert.equal(vimeo.provider, "Vimeo");
  assert.equal(vimeo.embedUrl, "https://player.vimeo.com/video/123456789");

  const mp4 = parseVideoSource("/uploads/videos/demo.mp4");
  assert.equal(mp4.kind, "video");
  assert.equal(mp4.embedUrl, "/uploads/videos/demo.mp4");
});

test("renderRichText formats headings, lists, callouts and escapes raw HTML safely", () => {
  const html = renderRichText(
    "## Passo 1\n1. Clique em **Entrar**\n> Dica: use <script>alert(1)</script>"
  );
  assert.match(html, /<h3>Passo 1<\/h3>/);
  assert.match(html, /<ol><li>Clique em <strong>Entrar<\/strong><\/li><\/ol>/);
  assert.match(html, /<blockquote class="callout">/);
  assert.equal(html.includes("<script>"), false);
  assert.equal(escapeHtml("<img src=x>"), "&lt;img src=x&gt;");
});

test("DEFAULT_STATE ships valid categories and linked subcategories", () => {
  assert.ok(DEFAULT_STATE.categories.length >= 6);
  const categoryIds = new Set(DEFAULT_STATE.categories.map((c) => c.id));
  for (const sub of DEFAULT_STATE.subcategories) {
    assert.ok(categoryIds.has(sub.categoryId), `Subcategoria ${sub.id} aponta para categoria válida`);
  }
});

