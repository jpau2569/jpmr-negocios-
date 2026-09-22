// ============================================================================
//  Genera los iconos de la app a partir del logo 3D (oportunidades/logo3d.js)
//  Uso:  node oportunidades/herramientas/generar-iconos.mjs
//  Necesita Playwright (ya está en devDependencies). Three.js se sirve desde
//  node_modules, así que funciona sin conexión.
// ============================================================================
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const RAIZ = new URL("../../", import.meta.url).pathname;
const SALIDA = join(RAIZ, "oportunidades/iconos");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png" };

const servidor = http.createServer(async (req, res) => {
  const ruta = decodeURIComponent(req.url.split("?")[0]);
  try {
    res.writeHead(200, { "content-type": MIME[extname(ruta)] || "application/octet-stream" }).end(await readFile(join(RAIZ, ruta)));
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => servidor.listen(8132, ok));

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const pagina = await navegador.newPage({ viewport: { width: 1024, height: 1024 } });
await pagina.route("https://unpkg.com/three@0.169.0/**", async (ruta) => {
  const archivo = ruta.request().url().split("three@0.169.0/")[1];
  ruta.fulfill({ contentType: "text/javascript", body: await readFile(join(RAIZ, "node_modules/three", archivo)) });
});

await mkdir(SALIDA, { recursive: true });
await pagina.goto("http://127.0.0.1:8132/oportunidades/herramientas/logo.html?modo=icono&tamano=1024");
await pagina.waitForFunction(() => document.body.dataset.listo);
if ((await pagina.evaluate(() => document.body.dataset.listo)) !== "si") throw new Error("Sin WebGL: no se pueden generar los iconos.");
const maestro = await pagina.locator("#logo canvas").screenshot();
await writeFile(join(SALIDA, "icono-1024.png"), maestro);

// Los tamaños se sacan del maestro con el propio navegador (sin sharp).
const b64 = maestro.toString("base64");
for (const [nombre, lado, margen] of [
  ["icono-512.png", 512, 0], ["icono-192.png", 192, 0], ["apple-touch-icon.png", 180, 0],
  ["icono-64.png", 64, 0], ["favicon-32.png", 32, 0],
  // «maskable»: Android recorta en círculo; el dibujo va al 80 % para que no se corte.
  ["icono-maskable-512.png", 512, 0.1],
]) {
  const datos = await pagina.evaluate(async ({ b64, lado, margen }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = lado;
    const x = c.getContext("2d");
    x.fillStyle = "#0B3B60";
    x.fillRect(0, 0, lado, lado);
    x.imageSmoothingQuality = "high";
    const m = lado * margen;
    x.drawImage(img, m, m, lado - 2 * m, lado - 2 * m);
    return c.toDataURL("image/png").split(",")[1];
  }, { b64, lado, margen });
  await writeFile(join(SALIDA, nombre), Buffer.from(datos, "base64"));
  console.log("✓", nombre);
}

await navegador.close();
servidor.close();
