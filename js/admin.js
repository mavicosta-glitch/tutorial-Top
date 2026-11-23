/**
 * Controlador do Painel Administrativo (admin.html).
 * Permite criar, editar, ordenar e excluir Categorias e Subcategorias,
 * anexando textos explicativos, múltiplas fotos e múltiplos vídeos em ambas.
 */

import {
  ICON_PRESETS,
  escapeHtml,
  generateId,
  parseVideoSource,
} from "./media-utils.js";
import {
  clearSupabaseConfig,
  deleteCategory,
  deleteSubcategory,
  getSupabaseConfig,
  importStateBackup,
  isAdminLoggedIn,
  loadPortalState,
  saveSettings,
  saveSupabaseConfig,
  setAdminLoggedIn,
  testSupabaseConnection,
  uploadMediaFile,
  upsertCategory,
  upsertSubcategory,
} from "./store.js";

let appState = null;
let providerInfo = { provider: "browser", providerLabel: "Navegador Local" };
let expandedCategoryIds = new Set();
let editorPhotos = [];
let editorVideos = [];
let toastTimer = null;

const loginView = document.getElementById("admin-login-view");
const appView = document.getElementById("admin-app-view");
const categoriesContainer = document.getElementById("admin-categories-list");
const filterInput = document.getElementById("admin-filter-input");
const toastEl = document.getElementById("admin-toast");

function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle("is-error", isError);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 3600);
}

function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

function getSortedCategories() {
  return [...(appState?.categories || [])].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

function getSortedSubcategories(categoryId) {
  return (appState?.subcategories || [])
    .filter((s) => s.categoryId === categoryId)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function renderStatusAndStats() {
  const cats = getSortedCategories();
  const subs = appState.subcategories || [];

  const totalPhotos =
    cats.reduce((acc, c) => acc + (c.photos?.length || 0), 0) +
    subs.reduce((acc, s) => acc + (s.photos?.length || 0), 0);
  const totalVideos =
    cats.reduce((acc, c) => acc + (c.videos?.length || 0), 0) +
    subs.reduce((acc, s) => acc + (s.videos?.length || 0), 0);

  document.getElementById("admin-brand-label").textContent =
    appState.settings.brandName || "MONITOR";

  const pill = document.getElementById("storage-status-pill");
  const isCloud = providerInfo.provider === "supabase";
  pill.classList.toggle("is-local", !isCloud);
  document.getElementById("storage-status-text").textContent = isCloud
    ? "Conectado: Supabase Cloud"
    : `Ativo: ${providerInfo.providerLabel}`;

  document.getElementById("stat-categories").textContent = String(cats.length);
  document.getElementById("stat-subcategories").textContent = String(subs.length);
  document.getElementById("stat-storage-title").textContent = isCloud
    ? "Supabase Nuvem"
    : providerInfo.providerLabel;
  document.getElementById("stat-media-summary").textContent =
    `${totalPhotos} foto(s) • ${totalVideos} vídeo(s)`;
}

function renderCategoriesList() {
  const query = (filterInput.value || "").trim().toLowerCase();
  const cats = getSortedCategories();

  const filtered = cats.filter((cat) => {
    if (!query) return true;
    const subs = getSortedSubcategories(cat.id);
    const catMatch = `${cat.name} ${cat.summary}`.toLowerCase().includes(query);
    const subMatch = subs.some((s) =>
      `${s.title} ${s.summary}`.toLowerCase().includes(query)
    );
    return catMatch || subMatch;
  });

  if (filtered.length === 0) {
    categoriesContainer.innerHTML = `
      <div class="empty-state">
        <p style="margin:0 0 12px">Nenhuma categoria encontrada.</p>
        <button type="button" class="btn btn-gold btn-sm" data-action="new-category">
          + Criar primeira categoria
        </button>
      </div>
    `;
    return;
  }

  categoriesContainer.innerHTML = filtered
    .map((cat, index) => {
      const subs = getSortedSubcategories(cat.id);
      const visibleSubs = query
        ? subs.filter(
            (s) =>
              `${cat.name} ${cat.summary}`.toLowerCase().includes(query) ||
              `${s.title} ${s.summary}`.toLowerCase().includes(query)
          )
        : subs;

      const isOpen = Boolean(query) || expandedCategoryIds.has(cat.id);
      const orderTag = `#${String(cat.displayOrder ?? index + 1).padStart(2, "0")}`;
      const catPhotos = cat.photos?.length || 0;
      const catVideos = cat.videos?.length || 0;

      const metaParts = [
        `${subs.length} ${subs.length === 1 ? "subcategoria" : "subcategorias"}`,
        catPhotos ? `${catPhotos} foto(s) na categoria` : null,
        catVideos ? `${catVideos} vídeo(s) na categoria` : null,
        cat.isPublished === false ? "Oculta" : "Clique para expandir",
      ]
        .filter(Boolean)
        .join(" • ");

      return `
        <article class="admin-cat-card ${isOpen ? "is-open" : ""}">
          <div class="admin-cat-head">
            <button
              type="button"
              class="admin-cat-toggle"
              data-action="toggle-cat"
              data-id="${escapeHtml(cat.id)}"
              aria-expanded="${isOpen}"
            >
              <div class="category-icon-box">${escapeHtml(cat.icon)}</div>
              <div>
                <div style="display:flex;align-items:center;flex-wrap:wrap">
                  <strong style="font-size:1rem">${escapeHtml(cat.name)}</strong>
                  <span class="order-tag">${escapeHtml(orderTag)}</span>
                </div>
                <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px">
                  ${escapeHtml(metaParts)}
                </div>
              </div>
            </button>

            <div class="admin-cat-actions">
              <button
                type="button"
                class="btn btn-sm"
                data-action="new-sub"
                data-cat-id="${escapeHtml(cat.id)}"
              >
                + Subcategoria
              </button>
              <button
                type="button"
                class="btn btn-sm"
                data-action="edit-cat"
                data-id="${escapeHtml(cat.id)}"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                data-action="delete-cat"
                data-id="${escapeHtml(cat.id)}"
              >
                Excluir
              </button>
            </div>
          </div>

          ${
            isOpen
              ? `<div class="admin-cat-body">
                  <div class="admin-sub-header">
                    <span class="admin-sub-label">
                      Subcategorias de ${escapeHtml(cat.name)} (${visibleSubs.length})
                    </span>
                    <button
                      type="button"
                      class="btn btn-sm"
                      data-action="new-sub"
                      data-cat-id="${escapeHtml(cat.id)}"
                    >
                      + Adicionar Subcategoria
                    </button>
                  </div>

                  ${
                    visibleSubs.length === 0
                      ? `<p style="margin:8px 0 4px;font-size:0.84rem;color:var(--text-secondary)">
                          Nenhuma subcategoria cadastrada nesta categoria ainda. Clique em <strong>+ Adicionar Subcategoria</strong> para incluir um tutorial com textos, fotos e vídeos.
                        </p>`
                      : `<div style="overflow-x:auto">
                          <table class="sub-table">
                            <thead>
                              <tr>
                                <th>Ordem</th>
                                <th>Título da Subcategoria</th>
                                <th>Conteúdo & Mídias</th>
                                <th style="text-align:right">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${visibleSubs
                                .map((sub, sIdx) => {
                                  const pCount = sub.photos?.length || 0;
                                  const vCount = sub.videos?.length || 0;
                                  return `
                                    <tr>
                                      <td class="sub-order-cell">#${sIdx + 1}</td>
                                      <td>
                                        <strong>${escapeHtml(sub.title)}</strong>
                                        ${
                                          sub.summary
                                            ? `<div style="font-size:0.76rem;color:var(--text-secondary);margin-top:2px">${escapeHtml(sub.summary)}</div>`
                                            : ""
                                        }
                                      </td>
                                      <td>
                                        <span class="sub-media-pill">📝 ${sub.content ? "Texto" : "Sem texto"}</span>
                                        <span class="sub-media-pill">🖼️ ${pCount} foto(s)</span>
                                        <span class="sub-media-pill">🎥 ${vCount} vídeo(s)</span>
                                      </td>
                                      <td class="sub-actions-cell">
                                        <button
                                          type="button"
                                          class="btn btn-sm btn-icon"
                                          title="Subir ordem"
                                          data-action="move-sub"
                                          data-dir="up"
                                          data-id="${escapeHtml(sub.id)}"
                                          ${sIdx === 0 ? "disabled" : ""}
                                        >↑</button>
                                        <button
                                          type="button"
                                          class="btn btn-sm btn-icon"
                                          title="Descer ordem"
                                          data-action="move-sub"
                                          data-dir="down"
                                          data-id="${escapeHtml(sub.id)}"
                                          ${sIdx === visibleSubs.length - 1 ? "disabled" : ""}
                                        >↓</button>
                                        <button
                                          type="button"
                                          class="btn btn-sm"
                                          data-action="edit-sub"
                                          data-id="${escapeHtml(sub.id)}"
                                        >Editar</button>
                                        <button
                                          type="button"
                                          class="btn btn-danger btn-sm"
                                          data-action="delete-sub"
                                          data-id="${escapeHtml(sub.id)}"
                                        >Excluir</button>
                                      </td>
                                    </tr>
                                  `;
                                })
                                .join("")}
                            </tbody>
                          </table>
                        </div>`
                  }
                </div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  renderStatusAndStats();
  renderCategoriesList();
}

/* ---------- Editor Unificado (Categoria / Subcategoria) ---------- */

function renderIconPicker(selectedIcon) {
  const list = document.getElementById("icon-picker-list");
  list.innerHTML = ICON_PRESETS.map(
    (icon) => `
    <button
      type="button"
      class="icon-chip ${icon === selectedIcon ? "is-selected" : ""}"
      data-pick-icon="${escapeHtml(icon)}"
      title="Escolher ${escapeHtml(icon)}"
    >${escapeHtml(icon)}</button>
  `
  ).join("");
}

function renderEditorPhotos() {
  const container = document.getElementById("editor-photos-list");
  if (!editorPhotos.length) {
    container.innerHTML = `<div class="field-hint">Nenhuma foto adicionada ainda. Envie fotos do computador ou cole um link acima.</div>`;
    return;
  }

  container.innerHTML = editorPhotos
    .map(
      (photo, idx) => `
    <div class="media-item-row">
      <img class="media-preview-thumb" src="${escapeHtml(photo.url)}" alt="" />
      <div class="media-item-fields">
        <input
          type="text"
          value="${escapeHtml(photo.caption || "")}"
          placeholder="Legenda explicativa desta foto..."
          data-photo-caption-idx="${idx}"
        />
        <span class="media-url-preview">${escapeHtml(photo.url.slice(0, 80))}</span>
      </div>
      <div style="display:flex;gap:6px">
        <button type="button" class="btn btn-sm btn-icon" data-photo-move="up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn btn-sm btn-icon" data-photo-move="down" data-idx="${idx}" ${idx === editorPhotos.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="btn btn-danger btn-sm" data-photo-remove="${idx}">Remover</button>
      </div>
    </div>
  `
    )
    .join("");
}

function renderEditorVideos() {
  const container = document.getElementById("editor-videos-list");
  if (!editorVideos.length) {
    container.innerHTML = `<div class="field-hint">Nenhum vídeo adicionado ainda. Envie um arquivo MP4/WebM ou cole um link do YouTube/Vimeo/Loom.</div>`;
    return;
  }

  container.innerHTML = editorVideos
    .map((video, idx) => {
      const parsed = parseVideoSource(video.url);
      const badge = parsed?.provider || "Vídeo";
      return `
        <div class="media-item-row">
          <div class="media-preview-thumb">▶</div>
          <div class="media-item-fields">
            <input
              type="text"
              value="${escapeHtml(video.title || "")}"
              placeholder="Título explicativo do vídeo..."
              data-video-title-idx="${idx}"
            />
            <span class="media-url-preview">[${escapeHtml(badge)}] ${escapeHtml(video.url.slice(0, 75))}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-sm btn-icon" data-video-move="up" data-idx="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-sm btn-icon" data-video-move="down" data-idx="${idx}" ${idx === editorVideos.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger btn-sm" data-video-remove="${idx}">Remover</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function openCategoryEditor(cat = null) {
  document.getElementById("editor-kind").value = "category";
  document.getElementById("editor-id").value = cat?.id || "";
  document.getElementById("editor-modal-title").textContent = cat
    ? `Editar Categoria: ${cat.name}`
    : "Nova Categoria";
  document.getElementById("editor-title-label").textContent = "Nome da Categoria *";
  document.getElementById("editor-title").value = cat?.name || "";
  document.getElementById("editor-parent-wrap").hidden = true;
  document.getElementById("editor-icon-wrap").hidden = false;
  document.getElementById("editor-icon").value = cat?.icon || "📁";
  renderIconPicker(cat?.icon || "📁");
  document.getElementById("editor-order").value = String(
    cat?.displayOrder ?? appState.categories.length + 1
  );
  document.getElementById("editor-summary").value = cat?.summary || "";
  document.getElementById("editor-content").value = cat?.content || "";
  document.getElementById("editor-published").checked = cat ? cat.isPublished !== false : true;

  editorPhotos = (cat?.photos || []).map((p) => ({ ...p }));
  editorVideos = (cat?.videos || []).map((v) => ({ ...v }));
  renderEditorPhotos();
  renderEditorVideos();
  openModal("editor-modal");
}

function openSubcategoryEditor(sub = null, presetCategoryId = null) {
  const cats = getSortedCategories();
  if (cats.length === 0) {
    showToast("Crie primeiro uma categoria antes de adicionar subcategorias.", true);
    return;
  }

  const targetCatId = sub?.categoryId || presetCategoryId || cats[0].id;
  const parentSelect = document.getElementById("editor-parent-cat");
  parentSelect.innerHTML = cats
    .map(
      (c) =>
        `<option value="${escapeHtml(c.id)}" ${c.id === targetCatId ? "selected" : ""}>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</option>`
    )
    .join("");

  const siblingsCount = getSortedSubcategories(targetCatId).length;

  document.getElementById("editor-kind").value = "subcategory";
  document.getElementById("editor-id").value = sub?.id || "";
  document.getElementById("editor-modal-title").textContent = sub
    ? `Editar Subcategoria: ${sub.title}`
    : "Nova Subcategoria / Tutorial";
  document.getElementById("editor-title-label").textContent = "Título da Subcategoria *";
  document.getElementById("editor-title").value = sub?.title || "";
  document.getElementById("editor-parent-wrap").hidden = false;
  document.getElementById("editor-icon-wrap").hidden = true;
  document.getElementById("editor-order").value = String(
    sub?.displayOrder ?? siblingsCount + 1
  );
  document.getElementById("editor-summary").value = sub?.summary || "";
  document.getElementById("editor-content").value = sub?.content || "";
  document.getElementById("editor-published").checked = sub ? sub.isPublished !== false : true;

  editorPhotos = (sub?.photos || []).map((p) => ({ ...p }));
  editorVideos = (sub?.videos || []).map((v) => ({ ...v }));
  renderEditorPhotos();
  renderEditorVideos();
  openModal("editor-modal");
}

/* ---------- Eventos da Lista de Categorias ---------- */

categoriesContainer.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");

  if (action === "new-category") {
    openCategoryEditor(null);
    return;
  }

  if (action === "toggle-cat") {
    if (expandedCategoryIds.has(id)) expandedCategoryIds.delete(id);
    else expandedCategoryIds.add(id);
    renderCategoriesList();
    return;
  }

  if (action === "edit-cat") {
    const cat = appState.categories.find((c) => c.id === id);
    if (cat) openCategoryEditor(cat);
    return;
  }

  if (action === "delete-cat") {
    const cat = appState.categories.find((c) => c.id === id);
    if (!cat) return;
    if (!confirm(`Excluir a categoria "${cat.name}" e todas as suas subcategorias?`)) return;
    try {
      appState = await deleteCategory(appState, id);
      expandedCategoryIds.delete(id);
      renderAll();
      showToast(`Categoria "${cat.name}" excluída.`);
    } catch (err) {
      showToast(err.message || "Erro ao excluir categoria.", true);
    }
    return;
  }

  if (action === "new-sub") {
    const catId = btn.getAttribute("data-cat-id");
    expandedCategoryIds.add(catId);
    openSubcategoryEditor(null, catId);
    return;
  }

  if (action === "edit-sub") {
    const sub = appState.subcategories.find((s) => s.id === id);
    if (sub) openSubcategoryEditor(sub);
    return;
  }

  if (action === "delete-sub") {
    const sub = appState.subcategories.find((s) => s.id === id);
    if (!sub) return;
    if (!confirm(`Excluir a subcategoria "${sub.title}"?`)) return;
    try {
      appState = await deleteSubcategory(appState, id);
      renderAll();
      showToast(`Subcategoria "${sub.title}" excluída.`);
    } catch (err) {
      showToast(err.message || "Erro ao excluir subcategoria.", true);
    }
    return;
  }

  if (action === "move-sub") {
    const dir = btn.getAttribute("data-dir");
    const sub = appState.subcategories.find((s) => s.id === id);
    if (!sub) return;
    const siblings = getSortedSubcategories(sub.categoryId);
    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const target = siblings[swapIdx];
    const orderA = idx + 1;
    const orderB = swapIdx + 1;
    try {
      appState = await upsertSubcategory(appState, { ...sub, displayOrder: orderB });
      appState = await upsertSubcategory(appState, { ...target, displayOrder: orderA });
      renderAll();
      showToast("Ordem atualizada.");
    } catch (err) {
      showToast(err.message || "Erro ao reordenar.", true);
    }
  }
});

/* ---------- Eventos do Modal Editor ---------- */

document.getElementById("icon-picker-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pick-icon]");
  if (!btn) return;
  const icon = btn.getAttribute("data-pick-icon");
  document.getElementById("editor-icon").value = icon;
  renderIconPicker(icon);
});

document.querySelectorAll("[data-insert-snippet]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const textarea = document.getElementById("editor-content");
    const snippet = btn.getAttribute("data-insert-snippet").replace(/\\n/g, "\n");
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value =
      textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
  });
});

// Upload de fotos
document.getElementById("editor-photo-upload").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = "";
  if (!files.length) return;

  for (const file of files) {
    try {
      showToast(`Enviando foto "${file.name}"...`);
      const uploaded = await uploadMediaFile(file);
      editorPhotos.push({
        id: generateId(),
        url: uploaded.url,
        caption: file.name.replace(/\.[^.]+$/, ""),
      });
      renderEditorPhotos();
      showToast("Foto adicionada com sucesso!");
    } catch (err) {
      showToast(err.message || "Falha ao enviar foto.", true);
    }
  }
});

// Adicionar foto por URL
document.getElementById("btn-add-photo-url").addEventListener("click", () => {
  const urlInput = document.getElementById("editor-photo-url");
  const capInput = document.getElementById("editor-photo-caption");
  const url = urlInput.value.trim();
  if (!url) {
    showToast("Informe o link (URL) da foto.", true);
    return;
  }
  editorPhotos.push({
    id: generateId(),
    url,
    caption: capInput.value.trim(),
  });
  urlInput.value = "";
  capInput.value = "";
  renderEditorPhotos();
});

document.getElementById("editor-photos-list").addEventListener("input", (e) => {
  const idx = e.target.getAttribute("data-photo-caption-idx");
  if (idx !== null && editorPhotos[Number(idx)]) {
    editorPhotos[Number(idx)].caption = e.target.value;
  }
});

document.getElementById("editor-photos-list").addEventListener("click", (e) => {
  const rmBtn = e.target.closest("[data-photo-remove]");
  if (rmBtn) {
    editorPhotos.splice(Number(rmBtn.getAttribute("data-photo-remove")), 1);
    renderEditorPhotos();
    return;
  }
  const mvBtn = e.target.closest("[data-photo-move]");
  if (mvBtn) {
    const idx = Number(mvBtn.getAttribute("data-idx"));
    const dir = mvBtn.getAttribute("data-photo-move");
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target >= 0 && target < editorPhotos.length) {
      [editorPhotos[idx], editorPhotos[target]] = [editorPhotos[target], editorPhotos[idx]];
      renderEditorPhotos();
    }
  }
});

// Upload de vídeo
document.getElementById("editor-video-upload").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  try {
    showToast(`Enviando vídeo "${file.name}"...`);
    const uploaded = await uploadMediaFile(file);
    editorVideos.push({
      id: generateId(),
      url: uploaded.url,
      title: file.name.replace(/\.[^.]+$/, ""),
    });
    renderEditorVideos();
    showToast("Vídeo enviado com sucesso!");
  } catch (err) {
    showToast(err.message || "Falha ao enviar vídeo.", true);
  }
});

// Adicionar vídeo por link (YouTube / Vimeo / Loom / MP4)
document.getElementById("btn-add-video-url").addEventListener("click", () => {
  const urlInput = document.getElementById("editor-video-url");
  const titleInput = document.getElementById("editor-video-title");
  const url = urlInput.value.trim();
  if (!url || !parseVideoSource(url)) {
    showToast("Informe um link válido do YouTube, Vimeo, Loom ou arquivo MP4/WebM.", true);
    return;
  }
  editorVideos.push({
    id: generateId(),
    url,
    title: titleInput.value.trim() || "Vídeo explicativo",
  });
  urlInput.value = "";
  titleInput.value = "";
  renderEditorVideos();
});

document.getElementById("editor-videos-list").addEventListener("input", (e) => {
  const idx = e.target.getAttribute("data-video-title-idx");
  if (idx !== null && editorVideos[Number(idx)]) {
    editorVideos[Number(idx)].title = e.target.value;
  }
});

document.getElementById("editor-videos-list").addEventListener("click", (e) => {
  const rmBtn = e.target.closest("[data-video-remove]");
  if (rmBtn) {
    editorVideos.splice(Number(rmBtn.getAttribute("data-video-remove")), 1);
    renderEditorVideos();
    return;
  }
  const mvBtn = e.target.closest("[data-video-move]");
  if (mvBtn) {
    const idx = Number(mvBtn.getAttribute("data-idx"));
    const dir = mvBtn.getAttribute("data-video-move");
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target >= 0 && target < editorVideos.length) {
      [editorVideos[idx], editorVideos[target]] = [editorVideos[target], editorVideos[idx]];
      renderEditorVideos();
    }
  }
});

// Salvar Categoria ou Subcategoria
document.getElementById("editor-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("btn-save-editor");
  submitBtn.disabled = true;

  try {
    const kind = document.getElementById("editor-kind").value;
    const id = document.getElementById("editor-id").value || undefined;
    const titleVal = document.getElementById("editor-title").value.trim();
    if (!titleVal) {
      showToast("Informe o título/nome.", true);
      return;
    }

    const common = {
      id,
      summary: document.getElementById("editor-summary").value.trim(),
      content: document.getElementById("editor-content").value,
      photos: editorPhotos,
      videos: editorVideos,
      displayOrder: Number(document.getElementById("editor-order").value) || 1,
      isPublished: document.getElementById("editor-published").checked,
    };

    if (kind === "category") {
      appState = await upsertCategory(appState, {
        ...common,
        name: titleVal,
        icon: document.getElementById("editor-icon").value.trim() || "📁",
      });
      showToast(id ? "Categoria atualizada!" : "Categoria criada e publicada!");
    } else {
      const categoryId = document.getElementById("editor-parent-cat").value;
      appState = await upsertSubcategory(appState, {
        ...common,
        categoryId,
        title: titleVal,
      });
      expandedCategoryIds.add(categoryId);
      showToast(id ? "Subcategoria atualizada!" : "Subcategoria criada e publicada!");
    }

    closeModal("editor-modal");
    renderAll();
  } catch (err) {
    showToast(err.message || "Erro ao salvar.", true);
  } finally {
    submitBtn.disabled = false;
  }
});

/* ---------- Modal Conexão Supabase ---------- */

async function loadSqlPreview() {
  const preview = document.getElementById("sb-sql-preview");
  try {
    let res = await fetch("/api/schema");
    if (!res.ok) res = await fetch("./supabase/schema.sql");
    if (res.ok) {
      preview.textContent = await res.text();
    } else {
      preview.textContent = "Abra o arquivo central-tutoriais/supabase/schema.sql para copiar o SQL.";
    }
  } catch {
    preview.textContent = "Abra o arquivo central-tutoriais/supabase/schema.sql para copiar o SQL.";
  }
}

document.getElementById("btn-open-supabase").addEventListener("click", () => {
  const cfg = getSupabaseConfig();
  document.getElementById("sb-url").value = cfg?.url || "";
  document.getElementById("sb-key").value = cfg?.key || "";
  document.getElementById("sb-feedback").hidden = true;
  loadSqlPreview();
  openModal("supabase-modal");
});

document.getElementById("btn-copy-sql").addEventListener("click", async () => {
  const sql = document.getElementById("sb-sql-preview").textContent || "";
  try {
    await navigator.clipboard.writeText(sql);
    showToast("Script SQL copiado! Cole no SQL Editor do Supabase.");
  } catch {
    showToast("Não foi possível copiar automaticamente. Selecione o bloco SQL.", true);
  }
});

document.getElementById("btn-connect-sb").addEventListener("click", async () => {
  const url = document.getElementById("sb-url").value.trim();
  const key = document.getElementById("sb-key").value.trim();
  const fb = document.getElementById("sb-feedback");
  fb.hidden = false;
  fb.style.color = "var(--gold)";
  fb.textContent = "Testando conexão com Supabase...";

  try {
    await testSupabaseConnection(url, key);
    saveSupabaseConfig(url, key);
    const loaded = await loadPortalState();
    appState = loaded.state;
    providerInfo = loaded;
    renderAll();
    fb.style.color = "#4ade80";
    fb.textContent = "Conectado ao Supabase Cloud com sucesso!";
    showToast("Conectado ao Supabase Cloud!");
  } catch (err) {
    fb.style.color = "var(--red)";
    fb.textContent = err.message || "Falha ao conectar no Supabase.";
  }
});

document.getElementById("btn-disconnect-sb").addEventListener("click", async () => {
  clearSupabaseConfig();
  const loaded = await loadPortalState();
  appState = loaded.state;
  providerInfo = loaded;
  renderAll();
  closeModal("supabase-modal");
  showToast(`Modo local ativado (${providerInfo.providerLabel}).`);
});

/* ---------- Modal Configurações & Backup ---------- */

document.getElementById("btn-open-settings").addEventListener("click", () => {
  const s = appState.settings;
  document.getElementById("cfg-brand-name").value = s.brandName || "";
  document.getElementById("cfg-brand-badge").value = s.brandBadge || "";
  document.getElementById("cfg-hero-title").value = s.heroTitle || "";
  document.getElementById("cfg-hero-subtitle").value = s.heroSubtitle || "";
  document.getElementById("cfg-wa-label").value = s.whatsappLabel || "";
  document.getElementById("cfg-wa-url").value = s.whatsappUrl || "";
  document.getElementById("cfg-admin-pass").value = s.adminPassword || "admin123";
  openModal("settings-modal");
});

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    appState = await saveSettings(appState, {
      brandName: document.getElementById("cfg-brand-name").value.trim() || "TOP",
      brandBadge: document.getElementById("cfg-brand-badge").value.trim() || "APP",
      heroTitle: document.getElementById("cfg-hero-title").value.trim() || "Plataforma",
      heroSubtitle: document.getElementById("cfg-hero-subtitle").value.trim(),
      whatsappLabel: document.getElementById("cfg-wa-label").value.trim(),
      whatsappUrl: document.getElementById("cfg-wa-url").value.trim(),
      adminPassword: document.getElementById("cfg-admin-pass").value.trim() || "admin123",
    });
    closeModal("settings-modal");
    renderAll();
    showToast("Configurações do site salvas!");
  } catch (err) {
    showToast(err.message || "Erro ao salvar configurações.", true);
  }
});

document.getElementById("btn-export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(appState, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup-central-tutoriais-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup JSON baixado!");
});

document.getElementById("input-import-json").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    appState = await importStateBackup(text);
    renderAll();
    closeModal("settings-modal");
    showToast("Backup importado com sucesso!");
  } catch (err) {
    showToast(err.message || "Arquivo de backup inválido.", true);
  }
});

/* ---------- Login, Logout e Botões Gerais ---------- */

document.getElementById("btn-new-category-hero").addEventListener("click", () => {
  openCategoryEditor(null);
});
document.getElementById("btn-new-category-toolbar").addEventListener("click", () => {
  openCategoryEditor(null);
});
filterInput.addEventListener("input", renderCategoriesList);

document.querySelectorAll("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    closeModal(btn.getAttribute("data-close-modal"));
  });
});

document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.hidden = true;
  });
});

document.getElementById("admin-login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const typed = document.getElementById("login-password").value;
  const expected = appState?.settings?.adminPassword || "admin123";
  const errEl = document.getElementById("login-error");
  if (typed === expected) {
    errEl.hidden = true;
    setAdminLoggedIn(true);
    loginView.hidden = true;
    appView.hidden = false;
    renderAll();
  } else {
    errEl.textContent = "Senha incorreta. Tente novamente.";
    errEl.hidden = false;
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  setAdminLoggedIn(false);
  appView.hidden = true;
  loginView.hidden = false;
  document.getElementById("login-password").value = "";
});

async function init() {
  const loaded = await loadPortalState();
  appState = loaded.state;
  providerInfo = loaded;

  // Expande automaticamente a primeira categoria para facilitar o uso
  const firstCat = getSortedCategories()[0];
  if (firstCat) expandedCategoryIds.add(firstCat.id);

  if (isAdminLoggedIn()) {
    loginView.hidden = true;
    appView.hidden = false;
    renderAll();
  } else {
    loginView.hidden = false;
    appView.hidden = true;
  }
}

init();

