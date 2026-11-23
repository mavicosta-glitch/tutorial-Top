/**
 * Controlador do Site Principal de Tutoriais (index.html).
 * Exibe categorias, subcategorias, textos explicativos, galeria de fotos (com lightbox)
 * e vídeos incorporados (YouTube, Vimeo, Loom ou arquivo MP4/WebM).
 */

import { escapeHtml, parseVideoSource, renderRichText } from "./media-utils.js";
import { loadPortalState } from "./store.js";

const root = document.getElementById("portal-root");
const lightbox = document.getElementById("photo-lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");

let appState = null;

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (!hash) return { view: "home" };
  const parts = hash.split("/").filter(Boolean);
  if (parts[0] === "categoria" && parts[1]) {
    if (parts[2]) {
      return { view: "subcategory", categorySlug: parts[1], subSlug: parts[2] };
    }
    return { view: "category", categorySlug: parts[1] };
  }
  return { view: "home" };
}

function navigate(hash) {
  window.location.hash = hash;
}

function getPublishedCategories() {
  return (appState?.categories || [])
    .filter((c) => c.isPublished !== false)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function getPublishedSubcategories(categoryId) {
  return (appState?.subcategories || [])
    .filter((s) => s.categoryId === categoryId && s.isPublished !== false)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function applyHeaderSettings() {
  const s = appState.settings;
  document.title = `${s.brandName} ${s.brandBadge} — ${s.heroTitle}`;
  document.getElementById("brand-name").textContent = s.brandName;
  document.getElementById("brand-badge").textContent = s.brandBadge;
  const wa = document.getElementById("whatsapp-cta");
  wa.href = s.whatsappUrl || "#";
  document.getElementById("whatsapp-label").textContent =
    s.whatsappLabel || "Fale Conosco no WhatsApp";
}

function renderPhotosSection(photos = []) {
  if (!photos.length) return "";
  return `
    <section class="media-section">
      <h2 class="media-section-title">🖼️ Fotos Explicativas (${photos.length})</h2>
      <div class="photo-gallery">
        ${photos
          .map(
            (photo, idx) => `
          <figure class="photo-figure">
            <button
              type="button"
              class="photo-thumb-btn"
              data-lightbox-src="${escapeHtml(photo.url)}"
              data-lightbox-caption="${escapeHtml(photo.caption || `Imagem ${idx + 1}`)}"
              aria-label="Ampliar imagem ${idx + 1}"
            >
              <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || `Foto explicativa ${idx + 1}`)}" loading="lazy" />
            </button>
            ${
              photo.caption
                ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>`
                : ""
            }
          </figure>
        `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderVideosSection(videos = []) {
  if (!videos.length) return "";
  return `
    <section class="media-section">
      <h2 class="media-section-title">🎥 Vídeos Explicativos (${videos.length})</h2>
      <div class="video-list">
        ${videos
          .map((video, idx) => {
            const parsed = parseVideoSource(video.url);
            if (!parsed) return "";
            const title = video.title || `Vídeo explicativo ${idx + 1}`;

            if (parsed.kind === "iframe") {
              return `
                <article class="video-card">
                  <div class="video-frame-wrap">
                    <iframe
                      src="${escapeHtml(parsed.embedUrl)}"
                      title="${escapeHtml(title)}"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowfullscreen
                    ></iframe>
                  </div>
                  <div class="video-card-caption">
                    <span>${escapeHtml(title)}</span>
                    <span class="sub-media-pill">${escapeHtml(parsed.provider)}</span>
                  </div>
                </article>
              `;
            }

            if (parsed.kind === "video") {
              return `
                <article class="video-card">
                  <div class="video-frame-wrap">
                    <video controls preload="metadata" src="${escapeHtml(parsed.embedUrl)}"></video>
                  </div>
                  <div class="video-card-caption">
                    <span>${escapeHtml(title)}</span>
                    <span class="sub-media-pill">Vídeo</span>
                  </div>
                </article>
              `;
            }

            return `
              <article class="video-card">
                <div class="video-card-caption">
                  <span>🎥 ${escapeHtml(title)}</span>
                  <a href="${escapeHtml(parsed.originalUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-gold btn-sm">
                    Assistir vídeo ↗
                  </a>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSidebar(activeCatId, activeSubId = null) {
  const categories = getPublishedCategories();
  return `
    <aside class="reader-sidebar" aria-label="Navegação de categorias e subcategorias">
      <div class="sidebar-heading">Categorias & Subcategorias</div>
      ${categories
        .map((cat) => {
          const subs = getPublishedSubcategories(cat.id);
          const isCatActive = cat.id === activeCatId;
          return `
            <div class="sidebar-cat-group">
              <button
                type="button"
                class="sidebar-cat-btn ${isCatActive && !activeSubId ? "is-active" : ""}"
                data-nav="#/categoria/${escapeHtml(cat.slug)}"
              >
                <span>${escapeHtml(cat.icon)} ${escapeHtml(cat.name)}</span>
                <span style="font-size:0.72rem;opacity:0.7">${subs.length}</span>
              </button>
              ${
                subs.length > 0
                  ? `<div class="sidebar-sub-list">
                      ${subs
                        .map(
                          (sub) => `
                        <button
                          type="button"
                          class="sidebar-sub-btn ${sub.id === activeSubId ? "is-active" : ""}"
                          data-nav="#/categoria/${escapeHtml(cat.slug)}/${escapeHtml(sub.slug)}"
                        >
                          ${escapeHtml(sub.title)}
                        </button>
                      `
                        )
                        .join("")}
                    </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </aside>
  `;
}

function renderHome() {
  const categories = getPublishedCategories();
  const s = appState.settings;

  root.innerHTML = `
    <section class="portal-hero">
      <h1>${escapeHtml(s.heroTitle)}</h1>
      <p>${escapeHtml(s.heroSubtitle)}</p>

      <div class="search-wrap">
        <span class="search-icon" aria-hidden="true">🔍</span>
        <input
          id="portal-search-input"
          type="search"
          class="search-input"
          placeholder="Buscar por categorias, subcategorias ou tutoriais..."
          autocomplete="off"
        />
        <span class="search-kbd">Ctrl K</span>
        <div id="portal-search-results" class="search-results-dropdown" hidden></div>
      </div>
    </section>

    <section aria-label="Categorias de Tutoriais" id="categories-section">
      ${
        categories.length === 0
          ? `<div class="empty-state">
              <p>Nenhuma categoria cadastrada ainda.</p>
              <a href="./admin.html" class="btn btn-gold" style="margin-top:10px">Abrir Painel Admin</a>
            </div>`
          : `<div class="category-grid">
              ${categories
                .map((cat) => {
                  const subs = getPublishedSubcategories(cat.id);
                  const photoCount =
                    (cat.photos?.length || 0) +
                    subs.reduce((acc, sub) => acc + (sub.photos?.length || 0), 0);
                  const videoCount =
                    (cat.videos?.length || 0) +
                    subs.reduce((acc, sub) => acc + (sub.videos?.length || 0), 0);
                  const mediaSummary = [
                    `${subs.length} ${subs.length === 1 ? "subcategoria" : "subcategorias"}`,
                    photoCount ? `${photoCount} ${photoCount === 1 ? "foto" : "fotos"}` : null,
                    videoCount ? `${videoCount} ${videoCount === 1 ? "vídeo" : "vídeos"}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return `
                    <button
                      type="button"
                      class="category-card"
                      data-nav="#/categoria/${escapeHtml(cat.slug)}"
                    >
                      <div class="category-card-left">
                        <div class="category-icon-box">${escapeHtml(cat.icon)}</div>
                        <div>
                          <h2 class="category-card-title">${escapeHtml(cat.name)}</h2>
                          <p class="category-card-meta">${escapeHtml(mediaSummary || "Guia prático")}</p>
                        </div>
                      </div>
                      <span class="category-card-arrow" aria-hidden="true">›</span>
                    </button>
                  `;
                })
                .join("")}
            </div>`
      }
    </section>
  `;

  bindSearchHandlers();
}

function renderCategoryView(categorySlug) {
  const categories = getPublishedCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) {
    renderHome();
    return;
  }

  const subs = getPublishedSubcategories(category.id);
  const htmlContent = renderRichText(category.content);

  root.innerHTML = `
    <div class="reader-layout">
      ${renderSidebar(category.id)}

      <article class="reader-article">
        <nav class="breadcrumb" aria-label="Caminho">
          <button type="button" data-nav="#/">Início</button>
          <span>›</span>
          <span>${escapeHtml(category.name)}</span>
        </nav>

        <header class="article-header">
          <span class="article-eyebrow">${escapeHtml(category.icon)} Categoria</span>
          <h1>${escapeHtml(category.name)}</h1>
          ${
            category.summary
              ? `<p class="article-summary">${escapeHtml(category.summary)}</p>`
              : ""
          }
        </header>

        ${htmlContent ? `<div class="rich-content">${htmlContent}</div>` : ""}
        ${renderPhotosSection(category.photos)}
        ${renderVideosSection(category.videos)}

        <section class="media-section">
          <h2 class="media-section-title">📚 Subcategorias e Tutoriais (${subs.length})</h2>
          ${
            subs.length === 0
              ? `<div class="empty-state">Esta categoria ainda não possui subcategorias cadastradas.</div>`
              : `<div class="subcards-grid">
                  ${subs
                    .map(
                      (sub, idx) => `
                    <button
                      type="button"
                      class="subcard"
                      data-nav="#/categoria/${escapeHtml(category.slug)}/${escapeHtml(sub.slug)}"
                    >
                      <div>
                        <span class="subcard-order">#${idx + 1}</span>
                        <h3 class="subcard-title">${escapeHtml(sub.title)}</h3>
                        ${
                          sub.summary
                            ? `<p class="subcard-summary">${escapeHtml(sub.summary)}</p>`
                            : ""
                        }
                      </div>
                      <div class="subcard-badges">
                        ${sub.photos?.length ? `<span>🖼️ ${sub.photos.length} foto(s)</span>` : ""}
                        ${sub.videos?.length ? `<span>🎥 ${sub.videos.length} vídeo(s)</span>` : ""}
                        <span>Abrir guia ›</span>
                      </div>
                    </button>
                  `
                    )
                    .join("")}
                </div>`
          }
        </section>
      </article>
    </div>
  `;
}

function renderSubcategoryView(categorySlug, subSlug) {
  const categories = getPublishedCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) {
    renderHome();
    return;
  }

  const subs = getPublishedSubcategories(category.id);
  const subIndex = subs.findIndex((s) => s.slug === subSlug);
  const sub = subs[subIndex];
  if (!sub) {
    renderCategoryView(categorySlug);
    return;
  }

  const prevSub = subIndex > 0 ? subs[subIndex - 1] : null;
  const nextSub = subIndex < subs.length - 1 ? subs[subIndex + 1] : null;
  const htmlContent = renderRichText(sub.content);

  root.innerHTML = `
    <div class="reader-layout">
      ${renderSidebar(category.id, sub.id)}

      <article class="reader-article">
        <nav class="breadcrumb" aria-label="Caminho">
          <button type="button" data-nav="#/">Início</button>
          <span>›</span>
          <button type="button" data-nav="#/categoria/${escapeHtml(category.slug)}">
            ${escapeHtml(category.name)}
          </button>
          <span>›</span>
          <span>${escapeHtml(sub.title)}</span>
        </nav>

        <header class="article-header">
          <span class="article-eyebrow">
            ${escapeHtml(category.icon)} ${escapeHtml(category.name)} • Passo #${subIndex + 1}
          </span>
          <h1>${escapeHtml(sub.title)}</h1>
          ${
            sub.summary
              ? `<p class="article-summary">${escapeHtml(sub.summary)}</p>`
              : ""
          }
        </header>

        ${
          htmlContent
            ? `<div class="rich-content">${htmlContent}</div>`
            : `<div class="rich-content"><p>Conteúdo explicativo em preparação.</p></div>`
        }

        ${renderPhotosSection(sub.photos)}
        ${renderVideosSection(sub.videos)}

        <div class="pager-row">
          <div>
            ${
              prevSub
                ? `<button type="button" class="btn" data-nav="#/categoria/${escapeHtml(category.slug)}/${escapeHtml(prevSub.slug)}">
                    ← Anterior: ${escapeHtml(prevSub.title)}
                  </button>`
                : `<button type="button" class="btn" data-nav="#/categoria/${escapeHtml(category.slug)}">
                    ← Voltar para ${escapeHtml(category.name)}
                  </button>`
            }
          </div>
          <div>
            ${
              nextSub
                ? `<button type="button" class="btn btn-gold" data-nav="#/categoria/${escapeHtml(category.slug)}/${escapeHtml(nextSub.slug)}">
                    Próximo: ${escapeHtml(nextSub.title)} →
                  </button>`
                : ""
            }
          </div>
        </div>
      </article>
    </div>
  `;
}

function bindSearchHandlers() {
  const input = document.getElementById("portal-search-input");
  const dropdown = document.getElementById("portal-search-results");
  if (!input || !dropdown) return;

  const updateResults = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      dropdown.hidden = true;
      dropdown.innerHTML = "";
      return;
    }

    const categories = getPublishedCategories();
    const matches = [];

    for (const cat of categories) {
      const catHaystack = `${cat.name} ${cat.summary} ${cat.content}`.toLowerCase();
      if (catHaystack.includes(q)) {
        matches.push({
          type: "Categoria",
          icon: cat.icon,
          title: cat.name,
          subtitle: cat.summary || "Categoria principal",
          hash: `#/categoria/${cat.slug}`,
        });
      }
      for (const sub of getPublishedSubcategories(cat.id)) {
        const subHaystack = `${sub.title} ${sub.summary} ${sub.content}`.toLowerCase();
        if (subHaystack.includes(q)) {
          matches.push({
            type: cat.name,
            icon: "📄",
            title: sub.title,
            subtitle: sub.summary || `Subcategoria de ${cat.name}`,
            hash: `#/categoria/${cat.slug}/${sub.slug}`,
          });
        }
      }
    }

    if (matches.length === 0) {
      dropdown.innerHTML = `<div style="padding:14px 16px;font-size:0.85rem;color:var(--text-secondary)">Nenhum tutorial encontrado para "${escapeHtml(input.value)}".</div>`;
    } else {
      dropdown.innerHTML = matches
        .slice(0, 12)
        .map(
          (m) => `
        <button type="button" class="search-result-item" data-nav="${escapeHtml(m.hash)}">
          <div>
            <div style="font-weight:700;font-size:0.88rem">${escapeHtml(m.icon)} ${escapeHtml(m.title)}</div>
            <div style="font-size:0.76rem;color:var(--text-secondary);margin-top:2px">${escapeHtml(m.subtitle)}</div>
          </div>
          <span class="sub-media-pill">${escapeHtml(m.type)}</span>
        </button>
      `
        )
        .join("");
    }
    dropdown.hidden = false;
  };

  input.addEventListener("input", updateResults);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) {
      dropdown.hidden = true;
    }
  });
}

function renderCurrentRoute() {
  if (!appState) return;
  const route = parseRoute();
  if (route.view === "category") {
    renderCategoryView(route.categorySlug);
  } else if (route.view === "subcategory") {
    renderSubcategoryView(route.categorySlug, route.subSlug);
  } else {
    renderHome();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Delegação de cliques (navegação + lightbox)
root.addEventListener("click", (event) => {
  const navBtn = event.target.closest("[data-nav]");
  if (navBtn) {
    navigate(navBtn.getAttribute("data-nav"));
    return;
  }

  const photoBtn = event.target.closest("[data-lightbox-src]");
  if (photoBtn) {
    lightboxImg.src = photoBtn.getAttribute("data-lightbox-src");
    lightboxImg.alt = photoBtn.getAttribute("data-lightbox-caption") || "";
    lightboxCaption.textContent = photoBtn.getAttribute("data-lightbox-caption") || "";
    lightbox.hidden = false;
  }
});

document.getElementById("lightbox-close").addEventListener("click", () => {
  lightbox.hidden = true;
  lightboxImg.src = "";
});

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    lightbox.hidden = true;
    lightboxImg.src = "";
  }
});

document.getElementById("nav-home").addEventListener("click", () => navigate("#/"));
document.getElementById("nav-categories").addEventListener("click", () => {
  if (parseRoute().view !== "home") {
    navigate("#/");
  }
  setTimeout(() => {
    document.getElementById("categories-section")?.scrollIntoView({ behavior: "smooth" });
  }, 50);
});

// Atalho Ctrl+K para focar na busca
window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if (parseRoute().view !== "home") {
      navigate("#/");
    }
    setTimeout(() => {
      document.getElementById("portal-search-input")?.focus();
    }, 60);
  }
  if (e.key === "Escape" && !lightbox.hidden) {
    lightbox.hidden = true;
  }
});

window.addEventListener("hashchange", renderCurrentRoute);

async function init() {
  root.innerHTML = `<div class="empty-state" style="margin-top:40px">Carregando Central de Tutoriais...</div>`;
  const loaded = await loadPortalState();
  appState = loaded.state;
  applyHeaderSettings();
  renderCurrentRoute();
}

init();

