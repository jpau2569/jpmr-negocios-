// Comprobación rápida: dice si la clave de Clipdrop está configurada en Vercel.
export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    clipdropConfigured: Boolean(process.env.CLIPDROP_API_KEY),
    endpoints: ["remove-background", "remove-text", "image-upscaling", "cleanup"],
    runtime: "vercel",
  });
}
