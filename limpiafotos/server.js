// ============================================================================
//  LimpiaFotos JPMR — Backend seguro conectado con Clipdrop
// ----------------------------------------------------------------------------
//  Este servidor hace de "proxy": el navegador NUNCA ve tu clave de Clipdrop.
//  El frontend sube la imagen aquí, aquí se llama a Clipdrop con tu API key
//  (guardada en la variable de entorno CLIPDROP_API_KEY) y se devuelve la
//  imagen procesada al navegador para poder previsualizarla y DESCARGARLA.
//
//  Requiere Node.js 18+ (usa fetch, FormData y Blob nativos).
// ============================================================================

import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de Clipdrop -------------------------------------------------
const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;
const CLIPDROP_BASE = "https://clipdrop-api.co";

// Endpoints de Clipdrop que exponemos (nombre "amable" -> ruta real).
const CLIPDROP_ENDPOINTS = {
  "remove-background": "/remove-background/v1", // quitar fondo (transparente)
  "cleanup": "/cleanup/v1",                     // borrar objetos (necesita máscara)
  "remove-text": "/remove-text/v1",             // quitar texto de la imagen
  "image-upscaling": "/image-upscaling/v1/upscale", // aumentar resolución
};

// Aceptamos imágenes en memoria (máx. 30 MB, límite de Clipdrop).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Servimos el frontend (carpeta public/).
app.use(express.static(path.join(__dirname, "public")));

// --- Salud / comprobación rápida ----------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    clipdropConfigured: Boolean(CLIPDROP_API_KEY),
    endpoints: Object.keys(CLIPDROP_ENDPOINTS),
  });
});

// --- Ruta principal: procesar una foto con Clipdrop ---------------------------
// POST /api/process/:tool   (multipart/form-data con campo image_file [y mask_file])
app.post(
  "/api/process/:tool",
  upload.fields([
    { name: "image_file", maxCount: 1 },
    { name: "mask_file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const tool = req.params.tool;
      const endpoint = CLIPDROP_ENDPOINTS[tool];

      if (!endpoint) {
        return res.status(400).json({
          error: `Herramienta no válida: "${tool}". Opciones: ${Object.keys(
            CLIPDROP_ENDPOINTS
          ).join(", ")}`,
        });
      }

      if (!CLIPDROP_API_KEY) {
        return res.status(500).json({
          error:
            "Falta la clave de Clipdrop. Define la variable de entorno CLIPDROP_API_KEY antes de arrancar el servidor.",
        });
      }

      const imageFile = req.files?.image_file?.[0];
      if (!imageFile) {
        return res
          .status(400)
          .json({ error: "No se recibió ninguna imagen (campo image_file)." });
      }

      // Construimos el formulario que espera Clipdrop.
      const form = new FormData();
      form.append(
        "image_file",
        new Blob([imageFile.buffer], { type: imageFile.mimetype }),
        imageFile.originalname || "imagen.png"
      );

      // La herramienta cleanup necesita una máscara (zonas a borrar).
      const maskFile = req.files?.mask_file?.[0];
      if (maskFile) {
        form.append(
          "mask_file",
          new Blob([maskFile.buffer], { type: maskFile.mimetype }),
          maskFile.originalname || "mask.png"
        );
      }

      // Reenviamos cualquier parámetro extra (p.ej. target_width para upscaling).
      for (const [key, value] of Object.entries(req.body || {})) {
        if (value !== undefined && value !== null && value !== "") {
          form.append(key, String(value));
        }
      }

      const clipdropRes = await fetch(`${CLIPDROP_BASE}${endpoint}`, {
        method: "POST",
        headers: { "x-api-key": CLIPDROP_API_KEY },
        body: form,
      });

      if (!clipdropRes.ok) {
        // Clipdrop devuelve JSON o texto con el error.
        const detail = await clipdropRes.text().catch(() => "");
        return res.status(clipdropRes.status).json({
          error: `Clipdrop devolvió ${clipdropRes.status}.`,
          detail: detail?.slice(0, 500),
        });
      }

      // Reenviamos la imagen resultante tal cual (image/png normalmente),
      // más las cabeceras de créditos restantes por si quieres mostrarlas.
      const contentType =
        clipdropRes.headers.get("content-type") || "image/png";
      const remaining = clipdropRes.headers.get("x-remaining-credits");
      const consumed = clipdropRes.headers.get("x-credits-consumed");

      res.setHeader("Content-Type", contentType);
      if (remaining) res.setHeader("X-Remaining-Credits", remaining);
      if (consumed) res.setHeader("X-Credits-Consumed", consumed);
      res.setHeader(
        "Access-Control-Expose-Headers",
        "X-Remaining-Credits, X-Credits-Consumed"
      );

      const arrayBuffer = await clipdropRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error("Error procesando imagen:", err);
      res.status(500).json({
        error: "Error interno al procesar la imagen.",
        detail: String(err?.message || err),
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`\n  LimpiaFotos JPMR ✅  http://localhost:${PORT}`);
  console.log(
    `  Clipdrop: ${CLIPDROP_API_KEY ? "clave detectada ✔" : "⚠ falta CLIPDROP_API_KEY"}\n`
  );
});
