// ============================================================================
//  Servidor de desarrollo para el proyecto JPMR Negocios
// ----------------------------------------------------------------------------
//  El proyecto está pensado para Vercel: ficheros HTML estáticos en la raíz +
//  funciones serverless en api/. Este servidor emula ese comportamiento en
//  local sin necesidad de Vercel CLI ni Express: usa únicamente módulos
//  integrados de Node (http, fs, path) y sirve tanto los estáticos como las
//  funciones de /api/*.
// ============================================================================

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

// --- Utilidades -------------------------------------------------------------

function parseQuery(rawUrl) {
  const u = new URL(rawUrl, `http://localhost:${PORT}`);
  const q = {};
  for (const [k, v] of u.searchParams) q[k] = v;
  return q;
}

function enhanceRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf-8"));
  } catch {
    return raw;
  }
}

function serveStatic(filePath, res) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // Probar con extensión .html
      const html = filePath.replace(/\/$/, "") + ".html";
      fs.stat(html, (e2, s2) => {
        if (e2 || !s2.isFile()) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end("404 — No encontrado");
          return;
        }
        streamFile(html, res);
      });
      return;
    }
    streamFile(filePath, res);
  });
}

function streamFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");
  fs.createReadStream(filePath).pipe(res);
}

// --- Rutas de la API --------------------------------------------------------

async function apiHandler(ruta, req, res) {
  try {
    const mod = await import(`./api/_${ruta}.js`);
    if (!mod.default) {
      return res.status(404).json({ error: `No existe /api/${ruta}` });
    }
    // Leer el cuerpo para POST/PUT/PATCH (los handlers usan req.body)
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      req.body = await readBody(req);
    }
    return mod.default(req, res);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      return res.status(404).json({ error: `No existe /api/${ruta}` });
    }
    console.error(`Error en /api/${ruta}:`, e);
    if (!res.headersSent) res.status(500).json({ error: String(e?.message || e) });
  }
}

// --- Servidor ---------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = u.pathname;
  const query = parseQuery(req.url);

  enhanceRes(res);
  req.query = query;
  req.headers = req.headers || {};

  // --- /api/process/:tool (cuerpo crudo, sin parsear) ---
  const procMatch = pathname.match(/^\/api\/process\/([^/]+)$/);
  if (procMatch) {
    req.query.tool = procMatch[1];
    try {
      const mod = await import("./api/process/[tool].js");
      return mod.default(req, res);
    } catch (e) {
      console.error("Error en /api/process:", e);
      if (!res.headersSent) res.status(500).json({ error: String(e?.message || e) });
    }
    return;
  }

  // --- /api/:ruta ---
  const apiMatch = pathname.match(/^\/api\/([^/]+)$/);
  if (apiMatch) {
    return apiHandler(apiMatch[1], req, res);
  }

  // --- Rewrite: /p/:slug → /api/oportunidades-ficha?slug=:slug ---
  const pMatch = pathname.match(/^\/p\/([^/]+)$/);
  if (pMatch) {
    req.query = { slug: pMatch[1] };
    try {
      const mod = await import("./api/_oportunidades-ficha.js");
      return mod.default(req, res);
    } catch (e) {
      console.error("Error en /p/:slug:", e);
      if (!res.headersSent) res.status(500).json({ error: String(e?.message || e) });
    }
    return;
  }

  // --- Ficheros estáticos ---
  let filePath = path.join(__dirname, decodeURIComponent(pathname));

  // Si termina en /, servir index.html del directorio
  if (pathname.endsWith("/")) {
    filePath = path.join(filePath, "index.html");
  }
  // Si es la raíz, servir index.html
  if (pathname === "/") {
    filePath = path.join(__dirname, "index.html");
  }

  serveStatic(filePath, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`▶ Servidor de desarrollo JPMR en http://0.0.0.0:${PORT}`);
});
