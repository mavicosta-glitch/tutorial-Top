/**
 * Camada unificada de armazenamento da Central de Tutoriais:
 * 1) Supabase Cloud (PostgreSQL + Storage `tutorial-media`) quando configurado em "Conexão Supabase"
 * 2) Servidor Local Node (`server.mjs` -> /api/state e /api/upload) quando rodando via `node server.mjs`
 * 3) Fallback automático no navegador (localStorage + DataURL/IndexedDB) se aberto estaticamente sem servidor
 */

import { DEFAULT_STATE } from "./default-data.js";
import { generateId, slugify } from "./media-utils.js";

const SUPABASE_CFG_KEY = "central_tutoriais_supabase_cfg_v1";
const SUPABASE_MODE_KEY = "central_tutoriais_supabase_mode_v1";
const LOCAL_STATE_KEY = "central_tutoriais_state_v1";
const ADMIN_AUTH_KEY = "central_tutoriais_admin_session_v1";

export const DEFAULT_SUPABASE_CONFIG = {
  url: "https://qroemyfnpproahzfsuxt.supabase.co",
  key: "sb_publishable_bQrQ6hdRqglxazx5vinRLQ_DsThDbgn",
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function getSupabaseConfig() {
  try {
    // Se o usuário clicou explicitamente em "Usar Modo Local"
    if (localStorage.getItem(SUPABASE_MODE_KEY) === "local") {
      return null;
    }
    const raw = localStorage.getItem(SUPABASE_CFG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.url && parsed?.key) {
        return {
          url: String(parsed.url).trim().replace(/\/+$/, ""),
          key: String(parsed.key).trim(),
        };
      }
    }
  } catch {
    // ignora
  }
  return DEFAULT_SUPABASE_CONFIG;
}

export function saveSupabaseConfig(url, key) {
  const cleanUrl = String(url || "").trim().replace(/\/+$/, "");
  const cleanKey = String(key || "").trim();
  localStorage.removeItem(SUPABASE_MODE_KEY);
  if (!cleanUrl || !cleanKey) {
    localStorage.removeItem(SUPABASE_CFG_KEY);
    return null;
  }
  const cfg = { url: cleanUrl, key: cleanKey };
  localStorage.setItem(SUPABASE_CFG_KEY, JSON.stringify(cfg));
  return cfg;
}

export function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_CFG_KEY);
  localStorage.setItem(SUPABASE_MODE_KEY, "local");
}

export function isAdminLoggedIn() {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === "1";
}

export function setAdminLoggedIn(logged) {
  if (logged) sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
  else sessionStorage.removeItem(ADMIN_AUTH_KEY);
}

function supabaseHeaders(cfg, extra = {}) {
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function mapCategoryFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon || "📁",
    summary: row.summary || "",
    content: row.content || "",
    photos: Array.isArray(row.photos) ? row.photos : [],
    videos: Array.isArray(row.videos) ? row.videos : [],
    displayOrder: Number(row.display_order ?? 1),
    isPublished: row.is_published !== false,
  };
}

function mapSubcategoryFromDb(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    slug: row.slug,
    summary: row.summary || "",
    content: row.content || "",
    photos: Array.isArray(row.photos) ? row.photos : [],
    videos: Array.isArray(row.videos) ? row.videos : [],
    displayOrder: Number(row.display_order ?? 1),
    isPublished: row.is_published !== false,
  };
}

function mapSettingsFromDb(row) {
  if (!row) return clone(DEFAULT_STATE.settings);
  return {
    id: row.id || "default",
    brandName: row.brand_name || "TOP",
    brandBadge: row.brand_badge || "APP",
    heroTitle: row.hero_title || "Plataforma",
    heroSubtitle: row.hero_subtitle || DEFAULT_STATE.settings.heroSubtitle,
    whatsappUrl: row.whatsapp_url || DEFAULT_STATE.settings.whatsappUrl,
    whatsappLabel: row.whatsapp_label || DEFAULT_STATE.settings.whatsappLabel,
    adminPassword: row.admin_password || "admin123",
  };
}

function normalizeState(raw) {
  const base = clone(DEFAULT_STATE);
  if (!raw || typeof raw !== "object") return base;
  return {
    settings: { ...base.settings, ...(raw.settings || {}) },
    categories: Array.isArray(raw.categories)
      ? raw.categories
          .map((c, idx) => ({
            id: c.id || generateId(),
            name: c.name || "Sem título",
            slug: c.slug || slugify(c.name || `categoria-${idx + 1}`),
            icon: c.icon || "📁",
            summary: c.summary || "",
            content: c.content || "",
            photos: Array.isArray(c.photos) ? c.photos : [],
            videos: Array.isArray(c.videos) ? c.videos : [],
            displayOrder: Number(c.displayOrder ?? idx + 1),
            isPublished: c.isPublished !== false,
          }))
          .sort((a, b) => a.displayOrder - b.displayOrder)
      : base.categories,
    subcategories: Array.isArray(raw.subcategories)
      ? raw.subcategories
          .map((s, idx) => ({
            id: s.id || generateId(),
            categoryId: s.categoryId,
            title: s.title || "Sem título",
            slug: s.slug || slugify(s.title || `tutorial-${idx + 1}`),
            summary: s.summary || "",
            content: s.content || "",
            photos: Array.isArray(s.photos) ? s.photos : [],
            videos: Array.isArray(s.videos) ? s.videos : [],
            displayOrder: Number(s.displayOrder ?? idx + 1),
            isPublished: s.isPublished !== false,
          }))
          .sort((a, b) => a.displayOrder - b.displayOrder)
      : base.subcategories,
  };
}

let serverAvailableCache = null;

async function detectLocalServer() {
  if (serverAvailableCache !== null) return serverAvailableCache;
  if (typeof window === "undefined" || window.location.protocol === "file:") {
    serverAvailableCache = false;
    return false;
  }
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (res.ok) {
      const info = await res.json().catch(() => null);
      serverAvailableCache = info?.provider === "local-server";
    } else {
      serverAvailableCache = false;
    }
  } catch {
    serverAvailableCache = false;
  }
  return serverAvailableCache;
}

/**
 * Testa conexão com Supabase verificando se as tabelas já existem.
 */
export async function testSupabaseConnection(url, key) {
  const cfg = {
    url: String(url || "").trim().replace(/\/+$/, ""),
    key: String(key || "").trim(),
  };
  if (!cfg.url || !cfg.key) {
    throw new Error("Informe a Project URL e a Publishable/Anon Key.");
  }
  const res = await fetch(
    `${cfg.url}/rest/v1/tutorial_categories?select=id&limit=1`,
    { headers: supabaseHeaders(cfg) }
  );
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 404 || /tutorial_categories|PGRST205|relation/i.test(txt)) {
      throw new Error(
        "Conectou ao Supabase, mas as tabelas ainda não existem. Execute o script SQL no Supabase SQL Editor primeiro."
      );
    }
    throw new Error(`Erro Supabase (${res.status}): ${txt.slice(0, 180)}`);
  }
  return true;
}

/**
 * Carrega o estado completo (settings, categories, subcategories) e indica o provedor ativo.
 */
export async function loadPortalState() {
  const cfg = getSupabaseConfig();
  if (cfg) {
    try {
      const [settingsRes, catRes, subRes] = await Promise.all([
        fetch(`${cfg.url}/rest/v1/tutorial_settings?id=eq.default&select=*`, {
          headers: supabaseHeaders(cfg),
        }),
        fetch(
          `${cfg.url}/rest/v1/tutorial_categories?select=*&order=display_order.asc,created_at.asc`,
          { headers: supabaseHeaders(cfg) }
        ),
        fetch(
          `${cfg.url}/rest/v1/tutorial_subcategories?select=*&order=display_order.asc,created_at.asc`,
          { headers: supabaseHeaders(cfg) }
        ),
      ]);

      if (!catRes.ok || !subRes.ok) {
        throw new Error("Falha ao consultar tabelas do Supabase.");
      }

      const settingsRows = settingsRes.ok ? await settingsRes.json() : [];
      const catRows = await catRes.json();
      const subRows = await subRes.json();

      return {
        provider: "supabase",
        providerLabel: "Supabase Cloud",
        state: normalizeState({
          settings: mapSettingsFromDb(settingsRows[0]),
          categories: catRows.map(mapCategoryFromDb),
          subcategories: subRows.map(mapSubcategoryFromDb),
        }),
      };
    } catch (err) {
      console.warn("Fallback para modo local após falha Supabase:", err);
    }
  }

  if (await detectLocalServer()) {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      return {
        provider: "local-server",
        providerLabel: "Servidor Local",
        state: normalizeState(data),
      };
    }
  }

  try {
    const stored = localStorage.getItem(LOCAL_STATE_KEY);
    if (stored) {
      return {
        provider: "browser",
        providerLabel: "Navegador Local",
        state: normalizeState(JSON.parse(stored)),
      };
    }
  } catch {
    // ignora
  }

  const initial = clone(DEFAULT_STATE);
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(initial));
  } catch {
    // ignora
  }
  return {
    provider: "browser",
    providerLabel: "Navegador Local",
    state: initial,
  };
}

async function persistLocalState(state) {
  const normalized = normalizeState(state);
  if (await detectLocalServer()) {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    if (!res.ok) {
      throw new Error("Não foi possível salvar os dados no servidor local.");
    }
    return normalized;
  }
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(normalized));
  return normalized;
}

/**
 * Salva configurações do site.
 */
export async function saveSettings(currentState, settingsInput) {
  const nextSettings = { ...currentState.settings, ...settingsInput };
  const cfg = getSupabaseConfig();
  if (cfg) {
    const res = await fetch(`${cfg.url}/rest/v1/tutorial_settings?id=eq.default`, {
      method: "PATCH",
      headers: supabaseHeaders(cfg, { Prefer: "return=representation" }),
      body: JSON.stringify({
        brand_name: nextSettings.brandName,
        brand_badge: nextSettings.brandBadge,
        hero_title: nextSettings.heroTitle,
        hero_subtitle: nextSettings.heroSubtitle,
        whatsapp_url: nextSettings.whatsappUrl,
        whatsapp_label: nextSettings.whatsappLabel,
        admin_password: nextSettings.adminPassword,
      }),
    });
    if (!res.ok) {
      throw new Error("Erro ao salvar configurações no Supabase.");
    }
    return { ...currentState, settings: nextSettings };
  }

  return persistLocalState({ ...currentState, settings: nextSettings });
}

/**
 * Cria ou atualiza uma Categoria (com texto, fotos e vídeos próprios).
 */
export async function upsertCategory(currentState, categoryInput) {
  const isEditing = Boolean(categoryInput.id);
  const existing = isEditing
    ? currentState.categories.find((c) => c.id === categoryInput.id)
    : null;

  const baseSlug = slugify(categoryInput.slug || categoryInput.name);
  let uniqueSlug = baseSlug;
  let counter = 2;
  while (
    currentState.categories.some(
      (c) => c.slug === uniqueSlug && c.id !== categoryInput.id
    )
  ) {
    uniqueSlug = `${baseSlug}-${counter++}`;
  }

  const record = {
    id: existing ? existing.id : generateId(),
    name: String(categoryInput.name || "").trim(),
    slug: uniqueSlug,
    icon: String(categoryInput.icon || "📁").trim() || "📁",
    summary: String(categoryInput.summary || "").trim(),
    content: String(categoryInput.content || ""),
    photos: Array.isArray(categoryInput.photos) ? categoryInput.photos : [],
    videos: Array.isArray(categoryInput.videos) ? categoryInput.videos : [],
    displayOrder: Number(
      categoryInput.displayOrder ?? currentState.categories.length + 1
    ),
    isPublished: categoryInput.isPublished !== false,
  };

  const cfg = getSupabaseConfig();
  if (cfg) {
    const dbPayload = {
      name: record.name,
      slug: record.slug,
      icon: record.icon,
      summary: record.summary,
      content: record.content,
      photos: record.photos,
      videos: record.videos,
      display_order: record.displayOrder,
      is_published: record.isPublished,
    };

    const res = existing
      ? await fetch(
          `${cfg.url}/rest/v1/tutorial_categories?id=eq.${encodeURIComponent(record.id)}`,
          {
            method: "PATCH",
            headers: supabaseHeaders(cfg, { Prefer: "return=representation" }),
            body: JSON.stringify(dbPayload),
          }
        )
      : await fetch(`${cfg.url}/rest/v1/tutorial_categories`, {
          method: "POST",
          headers: supabaseHeaders(cfg, { Prefer: "return=representation" }),
          body: JSON.stringify(dbPayload),
        });

    if (!res.ok) {
      throw new Error(`Erro ao salvar categoria no Supabase: ${await res.text()}`);
    }
    const [saved] = await res.json();
    const mapped = mapCategoryFromDb(saved);
    const categories = existing
      ? currentState.categories.map((c) => (c.id === mapped.id ? mapped : c))
      : [...currentState.categories, mapped];
    return normalizeState({ ...currentState, categories });
  }

  const categories = existing
    ? currentState.categories.map((c) => (c.id === record.id ? record : c))
    : [...currentState.categories, record];
  return persistLocalState({ ...currentState, categories });
}

/**
 * Exclui uma Categoria e todas as suas Subcategorias vinculadas.
 */
export async function deleteCategory(currentState, categoryId) {
  const cfg = getSupabaseConfig();
  if (cfg) {
    const res = await fetch(
      `${cfg.url}/rest/v1/tutorial_categories?id=eq.${encodeURIComponent(categoryId)}`,
      {
        method: "DELETE",
        headers: supabaseHeaders(cfg),
      }
    );
    if (!res.ok) {
      throw new Error("Erro ao excluir categoria no Supabase.");
    }
  }

  const nextState = {
    ...currentState,
    categories: currentState.categories.filter((c) => c.id !== categoryId),
    subcategories: currentState.subcategories.filter(
      (s) => s.categoryId !== categoryId
    ),
  };

  return cfg ? normalizeState(nextState) : persistLocalState(nextState);
}

/**
 * Cria ou atualiza uma Subcategoria / Tutorial (com texto, fotos e vídeos próprios).
 */
export async function upsertSubcategory(currentState, subInput) {
  const isEditing = Boolean(subInput.id);
  const existing = isEditing
    ? currentState.subcategories.find((s) => s.id === subInput.id)
    : null;

  const baseSlug = slugify(subInput.slug || subInput.title);
  let uniqueSlug = baseSlug;
  let counter = 2;
  while (
    currentState.subcategories.some(
      (s) =>
        s.categoryId === subInput.categoryId &&
        s.slug === uniqueSlug &&
        s.id !== subInput.id
    )
  ) {
    uniqueSlug = `${baseSlug}-${counter++}`;
  }

  const siblingCount = currentState.subcategories.filter(
    (s) => s.categoryId === subInput.categoryId
  ).length;

  const record = {
    id: existing ? existing.id : generateId(),
    categoryId: subInput.categoryId,
    title: String(subInput.title || "").trim(),
    slug: uniqueSlug,
    summary: String(subInput.summary || "").trim(),
    content: String(subInput.content || ""),
    photos: Array.isArray(subInput.photos) ? subInput.photos : [],
    videos: Array.isArray(subInput.videos) ? subInput.videos : [],
    displayOrder: Number(subInput.displayOrder ?? siblingCount + 1),
    isPublished: subInput.isPublished !== false,
  };

  const cfg = getSupabaseConfig();
  if (cfg) {
    const dbPayload = {
      category_id: record.categoryId,
      title: record.title,
      slug: record.slug,
      summary: record.summary,
      content: record.content,
      photos: record.photos,
      videos: record.videos,
      display_order: record.displayOrder,
      is_published: record.isPublished,
    };

    const res = existing
      ? await fetch(
          `${cfg.url}/rest/v1/tutorial_subcategories?id=eq.${encodeURIComponent(record.id)}`,
          {
            method: "PATCH",
            headers: supabaseHeaders(cfg, { Prefer: "return=representation" }),
            body: JSON.stringify(dbPayload),
          }
        )
      : await fetch(`${cfg.url}/rest/v1/tutorial_subcategories`, {
          method: "POST",
          headers: supabaseHeaders(cfg, { Prefer: "return=representation" }),
          body: JSON.stringify(dbPayload),
        });

    if (!res.ok) {
      throw new Error(`Erro ao salvar subcategoria no Supabase: ${await res.text()}`);
    }
    const [saved] = await res.json();
    const mapped = mapSubcategoryFromDb(saved);
    const subcategories = existing
      ? currentState.subcategories.map((s) => (s.id === mapped.id ? mapped : s))
      : [...currentState.subcategories, mapped];
    return normalizeState({ ...currentState, subcategories });
  }

  const subcategories = existing
    ? currentState.subcategories.map((s) => (s.id === record.id ? record : s))
    : [...currentState.subcategories, record];
  return persistLocalState({ ...currentState, subcategories });
}

/**
 * Exclui uma Subcategoria.
 */
export async function deleteSubcategory(currentState, subId) {
  const cfg = getSupabaseConfig();
  if (cfg) {
    const res = await fetch(
      `${cfg.url}/rest/v1/tutorial_subcategories?id=eq.${encodeURIComponent(subId)}`,
      {
        method: "DELETE",
        headers: supabaseHeaders(cfg),
      }
    );
    if (!res.ok) {
      throw new Error("Erro ao excluir subcategoria no Supabase.");
    }
  }

  const nextState = {
    ...currentState,
    subcategories: currentState.subcategories.filter((s) => s.id !== subId),
  };

  return cfg ? normalizeState(nextState) : persistLocalState(nextState);
}

/**
 * Faz upload de foto ou vídeo:
 * 1) Supabase Storage (`tutorial-media`) se Supabase estiver conectado
 * 2) Servidor local (`/api/upload`) se rodando via `node server.mjs`
 * 3) DataURL (para imagens/vídeos pequenos no modo somente navegador)
 */
export async function uploadMediaFile(file) {
  if (!file) throw new Error("Nenhum arquivo selecionado.");

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new Error("Selecione apenas arquivos de imagem (JPG, PNG, WebP, GIF) ou vídeo (MP4, WebM).");
  }

  const maxBytes = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      isVideo
        ? "O vídeo ultrapassa o limite de 50 MB. Para vídeos maiores, use link do YouTube ou Vimeo."
        : "A imagem ultrapassa o limite de 10 MB."
    );
  }

  const ext = (file.name.split(".").pop() || (isVideo ? "mp4" : "png"))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const folder = isVideo ? "videos" : "photos";
  const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 1) Supabase Storage
  const cfg = getSupabaseConfig();
  if (cfg) {
    const uploadRes = await fetch(
      `${cfg.url}/storage/v1/object/tutorial-media/${filePath}`,
      {
        method: "POST",
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true",
        },
        body: file,
      }
    );

    if (!uploadRes.ok) {
      throw new Error(
        `Falha no upload para o Supabase Storage (${uploadRes.status}). Verifique se executou o script SQL com o bucket 'tutorial-media'.`
      );
    }

    return {
      url: `${cfg.url}/storage/v1/object/public/tutorial-media/${filePath}`,
      name: file.name,
      type: isVideo ? "video" : "photo",
    };
  }

  // 2) Servidor local Node (`server.mjs`)
  if (await detectLocalServer()) {
    const buffer = await file.arrayBuffer();
    const res = await fetch(
      `/api/upload?name=${encodeURIComponent(file.name)}&kind=${folder}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: buffer,
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || "Falha ao enviar arquivo para o servidor local.");
    }
    const json = await res.json();
    return {
      url: json.url,
      name: file.name,
      type: isVideo ? "video" : "photo",
    };
  }

  // 3) Fallback somente navegador
  if (isVideo && file.size > 4 * 1024 * 1024) {
    throw new Error(
      "Sem servidor ou Supabase conectado, vídeos acima de 4 MB devem ser adicionados por link (YouTube/Vimeo) ou rode `node central-tutoriais/server.mjs`."
    );
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });

  return {
    url: dataUrl,
    name: file.name,
    type: isVideo ? "video" : "photo",
  };
}

/**
 * Importa um JSON de backup completo para o armazenamento atual.
 */
export async function importStateBackup(rawJson) {
  const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  const normalized = normalizeState(parsed);
  const cfg = getSupabaseConfig();
  if (cfg) {
    // No Supabase, sincroniza configurações, categorias e subcategorias
    await saveSettings(normalized, normalized.settings);
    const idMap = new Map();
    for (const cat of normalized.categories) {
      const res = await fetch(`${cfg.url}/rest/v1/tutorial_categories`, {
        method: "POST",
        headers: supabaseHeaders(cfg, {
          Prefer: "return=representation,resolution=merge-duplicates",
        }),
        body: JSON.stringify({
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          summary: cat.summary,
          content: cat.content,
          photos: cat.photos,
          videos: cat.videos,
          display_order: cat.displayOrder,
          is_published: cat.isPublished,
        }),
      });
      if (res.ok) {
        const [saved] = await res.json();
        if (saved?.id) idMap.set(cat.id, saved.id);
      }
    }
    for (const sub of normalized.subcategories) {
      const targetCatId = idMap.get(sub.categoryId);
      if (!targetCatId) continue;
      await fetch(`${cfg.url}/rest/v1/tutorial_subcategories`, {
        method: "POST",
        headers: supabaseHeaders(cfg, {
          Prefer: "resolution=merge-duplicates",
        }),
        body: JSON.stringify({
          category_id: targetCatId,
          title: sub.title,
          slug: sub.slug,
          summary: sub.summary,
          content: sub.content,
          photos: sub.photos,
          videos: sub.videos,
          display_order: sub.displayOrder,
          is_published: sub.isPublished,
        }),
      });
    }
    return (await loadPortalState()).state;
  }

  return persistLocalState(normalized);
}

