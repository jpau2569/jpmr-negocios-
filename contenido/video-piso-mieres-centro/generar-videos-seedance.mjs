// Generador de clips Seedance 2.0 (fal.ai) — Piso Mieres centro 114.000 €
//
// Uso:
//   1. npm install @fal-ai/client
//   2. Crea un .env con FAL_KEY=tu_clave (https://fal.ai → API Keys)
//   3. Pon las fotos del piso en ./fotos/ con los nombres indicados en CLIPS
//   4. node generar-videos-seedance.mjs
//
// Genera un clip vertical 9:16 de 5 s por cada foto (image-to-video).
// Luego se montan en CapCut/InShot siguiendo el orden de GUION_Y_COPIES.md.

import { fal } from "@fal-ai/client";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

fal.config({ credentials: process.env.FAL_KEY });

const BASE_STYLE =
  "smooth slow cinematic camera movement, natural daylight, premium real estate showcase, photorealistic, no people, 9:16 vertical";

// Nombre de archivo de foto → prompt de movimiento de cámara
const CLIPS = [
  ["01-salon-tv.jpg", `Slow dolly-in through a bright living room with modern TV unit in an apartment in Mieres Asturias Spain, gray walls, ${BASE_STYLE}`],
  ["02-salon-sofa.jpg", `Gentle pan across a cozy living room with corner sofa and sheer curtains, warm afternoon light, ${BASE_STYLE}`],
  ["03-cocina.jpg", `Slow push-in through a fully equipped kitchen with orange cabinets, oven and washing machine, ${BASE_STYLE}`],
  ["04-dormitorio-principal.jpg", `Slow dolly-in into a bedroom with dark tufted headboard and white bedding, soft window light, ${BASE_STYLE}`],
  ["05-dormitorio-tv.jpg", `Gentle pan across a bedroom with wall-mounted TV and colorful duvet, ${BASE_STYLE}`],
  ["06-dormitorio-flores.jpg", `Slow push-in into a bright bedroom with floral bedding and pendant lamp, ${BASE_STYLE}`],
  ["07-vestidor.jpg", `Reveal shot moving into a full walk-in closet with white wardrobes and shelving, chandelier light, ${BASE_STYLE}`],
  ["08-bano.jpg", `Slow pan across a bathroom with shower enclosure and warm tiles, ${BASE_STYLE}`],
  ["09-terraza.jpg", `Slow pan across an exterior terrace of an apartment in Mieres Asturias, daylight, ${BASE_STYLE}`],
];

async function generarClip(foto, prompt) {
  const file = await readFile(path.join("fotos", foto));
  const imageUrl = await fal.storage.upload(new Blob([file], { type: "image/jpeg" }));

  const result = await fal.subscribe("bytedance/seedance-2.0/image-to-video", {
    input: {
      prompt,
      image_url: imageUrl,
      resolution: "720p",
      duration: "5",
      aspect_ratio: "9:16",
      generate_audio: false,
    },
    logs: true,
    onQueueUpdate: (u) => {
      if (u.status === "IN_PROGRESS") console.log(`⏳ ${foto}…`);
    },
  });

  const videoUrl = result.data.video?.url;
  if (!videoUrl) throw new Error(`Sin URL de vídeo para ${foto}`);
  console.log(`✅ ${foto} → ${videoUrl}`);
  return { foto, videoUrl };
}

const resultados = [];
for (const [foto, prompt] of CLIPS) {
  try {
    resultados.push(await generarClip(foto, prompt));
  } catch (err) {
    console.error(`❌ Error con ${foto}:`, err.message ?? err);
  }
}

await writeFile("clips-generados.json", JSON.stringify(resultados, null, 2));
console.log(`\n🎬 ${resultados.length}/${CLIPS.length} clips generados. URLs en clips-generados.json`);
console.log("Monta los clips en este orden en CapCut siguiendo GUION_Y_COPIES.md");
