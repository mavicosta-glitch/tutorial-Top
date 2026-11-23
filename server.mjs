/**
 * Servidor HTTP leve (zero dependências externas) para a Central de Tutoriais.
 * - Compatível com execução local (`node server.mjs` ou `npm start`)
 * - Compatível com Vercel Node.js Serverless (`export default handler`)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { DEFAULT_STATE } from "./js/default-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const PORT = Number(process.env.TUTORIALS_PORT || process.env.PORT || 4100);
const WRITABLE_BASE = IS_VERCEL ? path.join("/tmp", "central-tutoriais") : __dirname;
const DATA_DIR = path.join(WRITABLE_BASE, "data");
const DATA_FILE = path.join(DATA_DIR, "tutorials.json");
const UPLOADS_DIR = path.join(WRITABLE_BASE, "uploads");
const SCHEMA_FILE = path.join(__dirname, "supabase", "schema.sql");

const MAX_UPLOAD_BYTES = 55 * 1024 * 1024; // 55 MB

/**
 * Mapa explícito com caminhos literais para que o bundler da Vercel (Node File Trace)
 * empacote 100% dos ativos estáticos (HTML, CSS, JS e SQL) automaticamente.
 */
const STATIC_ASSETS = {
  "/": { file: path.join(__dirname, "index.html"), type: "text/html; charset=utf-8" },
  "/index.html": { file: path.join(__dirname, "index.html"), type: "text/html; charset=utf-8" },
  "/admin": { file: path.join(__dirname, "admin.html"), type: "text/html; charset=utf-8" },
  "/admin/": { file: path.join(__dirname, "admin.html"), type: "text/html; charset=utf-8" },
  "/admin.html": { file: path.join(__dirname, "admin.html"), type: "text/html; charset=utf-8" },
  "/styles.css": { file: path.join(__dirname, "styles.css"), type: "text/css; charset=utf-8" },
  "/js/portal.js": { file: path.join(__dirname, "js", "portal.js"), type: "application/javascript; charset=utf-8" },
  "/js/admin.js": { file: path.join(__dirname, "js", "admin.js"), type: "application/javascript; charset=utf-8" },
  "/js/store.js": { file: path.join(__dirname, "js", "store.js"), type: "application/javascript; charset=utf-8" },
  "/js/media-utils.js": { file: path.join(__dirname, "js", "media-utils.js"), type: "application/javascript; charset=utf-8" },
  "/js/default-data.js": { file: path.join(__dirname, "js", "default-data.js"), type: "application/javascript; charset=utf-8" },
  "/supabase/schema.sql": { file: path.join(__dirname, "supabase", "schema.sql"), type: "text/plain; charset=utf-8" },
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "video/ogg",
  ".sql": "text/plain; charset=utf-8",
};

const ALLOWED_UPLOAD_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".webm",
  ".ogg",
]);

function ensureDirectories() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(path.join(UPLOADS_DIR, "photos"), { recursive: true });
    fs.mkdirSync(path.join(UPLOADS_DIR, "videos"), { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_STATE, null, 2), "utf-8");
    }
  } catch {
    // Em ambientes somente leitura, ignora criação em disco
  }
}

function readJsonState() {
  ensureDirectories();
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch {
    // fallback abaixo
  }
  return DEFAULT_STATE;
}

function writeJsonState(state) {
  ensureDirectories();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Arquivo excede o limite permitido."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeResolve(baseDir, requestPath) {
  const decoded = decodeURIComponent(requestPath).replace(/^\/+/, "");
  const resolved = path.resolve(baseDir, decoded);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    return null;
  }
  return resolved;
}

async function handleRequest(req, res) {
  try {
    const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = reqUrl.pathname;

    // Health check
    if (pathname === "/api/health" && req.method === "GET") {
      const state = readJsonState();
      return sendJson(res, 200, {
        status: "ok",
        provider: IS_VERCEL ? "vercel" : "local-server",
        categoriesCount: state.categories?.length || 0,
        subcategoriesCount: state.subcategories?.length || 0,
      });
    }

    // Schema SQL
    if (pathname === "/api/schema" && req.method === "GET") {
      if (fs.existsSync(SCHEMA_FILE)) {
        const sql = fs.readFileSync(SCHEMA_FILE, "utf-8");
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(sql);
      }
      return sendJson(res, 404, { error: "schema.sql não encontrado." });
    }

    // Estado JSON local
    if (pathname === "/api/state") {
      if (req.method === "GET") {
        return sendJson(res, 200, readJsonState());
      }
      if (req.method === "PUT" || req.method === "POST") {
        const raw = await readRequestBody(req, 10 * 1024 * 1024);
        try {
          const nextState = JSON.parse(raw.toString("utf-8"));
          writeJsonState(nextState);
          return sendJson(res, 200, { ok: true, state: nextState });
        } catch (parseErr) {
          return sendJson(res, 400, { error: "JSON inválido: " + parseErr.message });
        }
      }
    }

    // Upload local de foto ou vídeo
    if (pathname === "/api/upload" && req.method === "POST") {
      const kind = reqUrl.searchParams.get("kind") === "video" ? "videos" : "photos";
      const ct = String(req.headers["content-type"] || "").toLowerCase();
      let ext = ".jpg";
      const urlExt = path.extname(reqUrl.searchParams.get("name") || reqUrl.searchParams.get("filename") || "").toLowerCase();

      if (ALLOWED_UPLOAD_EXT.has(urlExt)) {
        ext = urlExt;
      } else {
        if (ct.includes("png")) ext = ".png";
        else if (ct.includes("webp")) ext = ".webp";
        else if (ct.includes("gif")) ext = ".gif";
        else if (ct.includes("mp4")) ext = ".mp4";
        else if (ct.includes("webm")) ext = ".webm";
        else if (ct.includes("ogg")) ext = ".ogg";
        else if (ct.includes("jpeg") || ct.includes("jpg")) ext = ".jpg";
        else {
          return sendJson(res, 400, { error: "Formato de mídia não suportado." });
        }
      }

      const buffer = await readRequestBody(req, MAX_UPLOAD_BYTES);
      if (!buffer.length) {
        return sendJson(res, 400, { error: "Arquivo vazio." });
      }

      ensureDirectories();
      const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
      const destPath = path.join(UPLOADS_DIR, kind, filename);
      fs.writeFileSync(destPath, buffer);

      return sendJson(res, 201, {
        ok: true,
        url: `/uploads/${kind}/${filename}`,
        size: buffer.length,
      });
    }

    // 1) Serve ativos estáticos conhecidos (garantidos no bundle da Vercel)
    const staticAsset = STATIC_ASSETS[pathname];
    if (staticAsset && fs.existsSync(staticAsset.file)) {
      const content = fs.readFileSync(staticAsset.file);
      res.writeHead(200, {
        "Content-Type": staticAsset.type,
        "Cache-Control": pathname.endsWith(".html") || pathname === "/" || pathname === "/admin"
          ? "no-cache"
          : "public, max-age=3600",
      });
      return res.end(content);
    }

    // Fallback em memória para /js/default-data.js (quando o bundler da Vercel incorpora o módulo)
    if (pathname === "/js/default-data.js") {
      res.writeHead(200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
      return res.end(`export const DEFAULT_STATE = ${JSON.stringify(DEFAULT_STATE, null, 2)};\n`);
    }

    // 2) Fallback para uploads locais e demais arquivos estáticos
    let filePath = null;
    if (pathname.startsWith("/uploads/")) {
      filePath = safeResolve(WRITABLE_BASE, pathname);
    } else {
      filePath = safeResolve(__dirname, pathname);
      if (!filePath || !fs.existsSync(filePath)) {
        filePath = safeResolve(process.cwd(), pathname);
      }
    }

    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Recurso não encontrado.");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    // Suporte a Range Requests para streaming suave de vídeos MP4/WebM
    if (ext === ".mp4" || ext === ".webm" || ext === ".ogg") {
      const stat = fs.statSync(filePath);
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
        "Content-Type": contentType,
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (err) {
    sendJson(res, 500, { error: err?.message || "Erro interno no servidor." });
  }
}

export function createTutorialsServer() {
  ensureDirectories();
  return http.createServer(handleRequest);
}

// Exporta handler padrão para o runtime Node.js da Vercel
export default handleRequest;

// Inicia automaticamente quando executado diretamente pela linha de comando
if (!IS_VERCEL && process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = createTutorialsServer();
  const host = process.env.HOST || "0.0.0.0";
  server.listen(PORT, host, () => {
    console.log(`Central de Tutoriais rodando em: http://${host === "0.0.0.0" ? "localhost" : host}:${PORT}`);
    console.log(`Painel Administrativo:          http://${host === "0.0.0.0" ? "localhost" : host}:${PORT}/admin`);
  });
}
