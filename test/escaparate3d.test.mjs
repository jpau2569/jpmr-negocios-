// ============================================================================
//  Tests del escaparate 3D — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  No salen a Internet: se intercepta fetch. Verifican el lector de fotos de
//  una ficha, el proxy de imágenes (lista de dominios) y el endpoint de fotos.
// ============================================================================

import { extraeFotos } from "../lib/fotos-ficha.js";
import foto, { dominioPermitido } from "../api/foto.js";
import fotos from "../api/fotos.js";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

function mockRes() {
  const r = { statusCode: 0, body: null, headers: {}, buffer: null };
  return {
    status(c) { r.statusCode = c; return this; },
    json(b) { r.body = b; return this; },
    setHeader(k, v) { r.headers[k] = v; },
    end(b) { r.buffer = b; return this; },
    r,
  };
}

// --- Ficha de ejemplo con la forma de las plantillas Inmoweb -----------------
const FICHA = `
<html><head><link rel="stylesheet" href="/css/estilo.css"></head><body>
  <img src="/img/logo-castresana.png" alt="logo">
  <img src="https://www.asesoriacastresana.com/img/icono-whatsapp.svg">
  <div class="galeria">
    <a href="https://fotos15.apinmo.com/1234/56789/1-g.jpg">
      <img src="https://fotos15.apinmo.com/1234/56789/1-p.jpg" alt="salón"></a>
    <a href="https://fotos15.apinmo.com/1234/56789/2-g.jpg">
      <img data-src="https://fotos15.apinmo.com/1234/56789/2-p.jpg" alt="cocina"></a>
    <img src="https://fotos15.apinmo.com/1234/56789/3.jpg" alt="baño">
    <img src="//fotos15.apinmo.com/1234/56789/4.jpg" alt="terraza">
    <img src="/fotos/plano-es1616045.jpg" alt="plano">
  </div>
  <img src="https://cdn.otrodominio.com/anuncio.jpg">
</body></html>`;

console.log("\n🏠 Lector de fotos de una ficha");
{
  const lista = extraeFotos(FICHA, "https://www.asesoriacastresana.com/piso-es1616045.html");
  check("encuentra las fotos del inmueble", lista.length === 5, `encontradas ${lista.length}: ${lista.join(", ")}`);
  check("descarta logos e iconos", !lista.some((u) => /logo|icono/.test(u)));
  check("descarta dominios ajenos", !lista.some((u) => u.includes("otrodominio")));
  check("se queda con el tamaño grande, no la miniatura",
    lista.includes("https://fotos15.apinmo.com/1234/56789/1-g.jpg") &&
    !lista.includes("https://fotos15.apinmo.com/1234/56789/1-p.jpg"));
  check("no repite la misma foto en dos tamaños",
    new Set(lista).size === lista.length && lista.filter((u) => u.includes("/1-")).length === 1);
  check("resuelve rutas relativas y sin protocolo",
    lista.includes("https://www.asesoriacastresana.com/fotos/plano-es1616045.jpg") &&
    lista.includes("https://fotos15.apinmo.com/1234/56789/4.jpg"));
  check("respeta el máximo", extraeFotos(FICHA, "https://www.asesoriacastresana.com/x.html", 2).length === 2);
  check("una página sin fotos no rompe", extraeFotos("<html></html>").length === 0);
  check("una entrada vacía no rompe", extraeFotos(null).length === 0);
}

console.log("\n🖼️  Proxy de fotos (/api/foto)");
{
  check("acepta el CDN del portal", dominioPermitido("https://fotos15.apinmo.com/a.jpg"));
  check("acepta la web oficial", dominioPermitido("https://www.asesoriacastresana.com/a.jpg"));
  check("rechaza otros dominios", !dominioPermitido("https://malicioso.com/a.jpg"));
  check("no se cuela con un dominio que acaba parecido", !dominioPermitido("https://apinmo.com.malo.net/a.jpg"));
  check("rechaza file:// y basura", !dominioPermitido("file:///etc/passwd") && !dominioPermitido("nada"));

  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    headers: { get: (k) => (k.toLowerCase() === "content-type" ? "image/jpeg" : null) },
    arrayBuffer: async () => new Uint8Array([255, 216, 255, 224, 1, 2, 3]).buffer,
  });
  let res = mockRes();
  await foto({ query: { u: "https://fotos15.apinmo.com/1.jpg" }, url: "/api/foto" }, res);
  check("sirve la imagen con su tipo y caché",
    res.r.statusCode === 200 && res.r.headers["Content-Type"] === "image/jpeg" &&
    /s-maxage/.test(res.r.headers["Cache-Control"]) && res.r.buffer?.length === 7);

  res = mockRes();
  await foto({ query: { u: "https://malicioso.com/1.jpg" }, url: "/api/foto" }, res);
  check("corta el dominio no permitido con 403", res.r.statusCode === 403);

  globalThis.fetch = async () => ({
    ok: true, status: 200,
    headers: { get: () => "text/html" },
    arrayBuffer: async () => new Uint8Array([1]).buffer,
  });
  res = mockRes();
  await foto({ query: { u: "https://fotos15.apinmo.com/1.jpg" }, url: "/api/foto" }, res);
  check("no sirve lo que no es una imagen", res.r.statusCode === 502);
  globalThis.fetch = original;
}

console.log("\n📷 Fotos de una ficha (/api/fotos)");
{
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => FICHA });
  let res = mockRes();
  await fotos({ query: { u: "https://www.asesoriacastresana.com/piso-es1616045.html" }, url: "/api/fotos" }, res);
  check("devuelve las fotos de la ficha", res.r.statusCode === 200 && res.r.body.total === 5 && res.r.body.ok);

  res = mockRes();
  await fotos({ query: { u: "https://otroportal.com/piso.html" }, url: "/api/fotos" }, res);
  check("no lee fichas de otros portales", res.r.statusCode === 403);

  globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => "" });
  res = mockRes();
  await fotos({ query: { u: "https://www.asesoriacastresana.com/no-existe.html" }, url: "/api/fotos" }, res);
  check("avisa si la ficha ya no está", res.r.statusCode === 502);
  globalThis.fetch = original;
}

console.log(`\n${fallados === 0 ? "✅" : "❌"} Escaparate 3D: ${pasados} pasados, ${fallados} fallados\n`);
process.exit(fallados === 0 ? 0 : 1);
