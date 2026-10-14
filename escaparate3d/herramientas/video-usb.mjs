#!/usr/bin/env node
// ============================================================================
//  Vídeo para la TV del escaparate (por USB)
// ----------------------------------------------------------------------------
//  Convierte la cartera actual de asesoriacastresana.com en un vídeo MP4 en
//  bucle para la tele de la oficina: una diapositiva por inmueble (fotos,
//  precio, datos, referencia y QR a su ficha) y, cada pocos pisos, una de
//  presentación de Asesoría Castresana con textos sacados de su propia web.
//
//  Uso:
//    node escaparate3d/herramientas/video-usb.mjs --datos cartera.json [--salida carpeta]
//      [--segundos 8] [--cada 4] [--sin-video]
//
//  «cartera.json» es { out: [ {ref, operacion, localidad, precio, m2,
//  habitaciones, banos, url, foto?, ficha?: {fotos[], extras[], …}} ] }: lo
//  que dan lib/cartera.js (obtenerCartera) + lib/ficha-inmueble.js
//  (parsearFicha) sobre la web oficial.
//
//  Salida (en --salida, por defecto escaparate3d/usb/):
//    1-vertical.mp4             1080×1920, para una tele que ya muestra la
//                               imagen en vertical.
//    2-girado-izquierda.mp4     girado 90° a un lado y 3-girado-derecha.mp4 al
//                               otro: para una tele colgada en vertical que
//                               sigue en modo horizontal (cuál vale depende de
//                               hacia qué lado se giró la tele al colgarla).
//    4-vertical-boca-abajo.mp4  el vertical girado 180°.
//    diapositivas/NN-*.jpg      cada diapositiva suelta (sirve como pase de
//                               fotos desde el USB si la tele no lee el vídeo).
//  Nada inventado: lo que el inmueble no publica no sale. Los textos de
//  presentación están en PRESENTACION (de la web oficial; editables).
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { svg as qrSvg } from "../../fotos-faciles/nucleo/qr.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Textos de presentación: salen de www.asesoriacastresana.com (portada, leída
// el 14-10-2026). Si se cambian, que sea por textos reales del despacho.
export const PRESENTACION = {
  nombre: "Asesoría Castresana",
  lema: "Gestión inmobiliaria",
  desde: "Empresa fundada en 1993",
  servicios: "Asesoramiento jurídico, fiscal, laboral y administración de fincas",
  inmobiliaria: "Gestión inmobiliaria personalizada, adaptándonos a las necesidades de nuestros clientes",
  direccion: "Calle Cabo Noval, 8 Bajo 2 · 33007 Oviedo (Asturias)",
  telefonos: ["985 210 468", "689 929 926"],
  web: "www.asesoriacastresana.com",
};

const arg = (n, def) => {
  const i = process.argv.indexOf(`--${n}`);
  return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true);
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const miles = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function precioTexto(p) {
  const v = Number(p?.precio ?? p);
  if (!Number.isFinite(v) || v <= 0) return "Precio a consultar";
  return p?.operacion === "alquiler" ? `${miles(v)} €/mes` : `${miles(v)} €`;
}

// Datos de un inmueble, solo con lo que publica la web.
export function normaliza(x) {
  const f = x.ficha || {};
  const fotos = (f.fotos && f.fotos.length ? f.fotos : x.foto ? [x.foto] : []).slice(0, 3);
  const m2 = x.m2 || (f.util ? parseInt(f.util, 10) : null) || (f.construida ? parseInt(f.construida, 10) : null);
  const datos = [];
  if (m2) datos.push(`${m2} m²`);
  const hab = x.habitaciones ?? f.hab;
  if (hab) datos.push(`${hab} hab.`);
  const banos = x.banos ?? f.banos;
  if (banos) datos.push(`${banos} ${banos == 1 ? "baño" : "baños"}`);
  if (f.planta) datos.push(`Planta ${f.planta}`);
  const tipo = String(x.titulo || f.titulo || "Inmueble").replace(/,?\s*(venta|alquiler)\s*$/i, "").replace(/\s+en\s+[^,]+$/i, "").trim();
  return {
    ref: f.referencia || x.ref || "",
    operacion: x.operacion === "alquiler" ? "alquiler" : "venta",
    tipo: tipo || "Inmueble",
    localidad: x.localidad || "",
    precio: precioTexto({ precio: x.precio, operacion: x.operacion }),
    datos,
    extras: (f.extras || []).slice(0, 4),
    url: x.url || "",
    fotos,
  };
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#10203a;font-family:"Liberation Sans","DejaVu Sans",Arial,sans-serif;color:#fff}
.cab{height:150px;display:flex;align-items:center;gap:26px;padding:0 48px;background:#fff;color:#10203a;border-bottom:8px solid #c9a227}
.cab img{height:96px}
.cab .t{font:700 34px/1.1 "Liberation Serif","DejaVu Serif",serif;letter-spacing:1px}
.cab .s{font-size:24px;color:#7d600c;letter-spacing:4px;text-transform:uppercase;margin-top:6px}
.foto{width:1080px;height:860px;background:#0b1628 center/cover no-repeat}
.sinfoto{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;background:#16294a}
.sinfoto img{width:480px;background:#fff;padding:22px;border-radius:14px}
.sinfoto span{font-size:36px;color:#e6ecf6}
.minis{display:flex;gap:8px;height:300px;margin-top:8px}
.minis div{flex:1;background:#0b1628 center/cover no-repeat}
.cuerpo{padding:34px 48px 0}
.etiq{display:inline-block;background:#c9a227;color:#10203a;font-weight:700;font-size:30px;padding:8px 22px;border-radius:8px;text-transform:uppercase;letter-spacing:2px}
.lugar{display:inline-block;margin-left:18px;font-size:34px;color:#e6ecf6}
.tipo{font:700 52px/1.15 "Liberation Serif","DejaVu Serif",serif;margin-top:20px;max-height:120px;overflow:hidden}
.precio{font:700 96px/1.05 "Liberation Sans",sans-serif;color:#f3d77a;margin-top:14px}
.datos{font-size:38px;margin-top:16px;color:#fff}
.extras{font-size:28px;margin-top:10px;color:#c9d6ee}
.pie{position:absolute;left:0;right:0;bottom:0;height:210px;background:#fff;color:#10203a;display:flex;align-items:center;justify-content:space-between;padding:0 48px}
.pie .ref{font-size:28px;color:#575e6b}
.pie .ref b{display:block;font-size:44px;color:#10203a;margin-top:4px}
.pie .tel{font-size:30px;margin-top:10px}
.pie .qr{display:flex;align-items:center;gap:16px;font-size:24px;color:#575e6b;text-align:right}
.pie .qr svg{width:170px;height:170px}
.pres{height:1770px;display:flex;flex-direction:column;justify-content:center;padding:0 80px;text-align:center}
.pres .grande{font:700 88px/1.1 "Liberation Serif","DejaVu Serif",serif;color:#f3d77a}
.pres .medio{font-size:50px;line-height:1.3;margin-top:46px}
.pres .linea{width:220px;height:6px;background:#c9a227;margin:56px auto}
.pres .peq{font-size:40px;line-height:1.5;color:#e6ecf6}
.pres img{width:520px;margin:0 auto 60px;background:#fff;padding:24px;border-radius:16px}
`;

const cabecera = (logo) => `<div class="cab"><img src="${logo}" alt=""><div><div class="t">ASESORÍA CASTRESANA</div><div class="s">${esc(PRESENTACION.lema)}</div></div></div>`;

export function htmlInmueble(p, { logo, fotosLocales = [] }) {
  const [f1, f2, f3] = fotosLocales;
  const qr = p.url ? qrSvg(p.url, { nivel: "M", margen: 1, oscuro: "#10203a" }) : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${cabecera(logo)}
${f1 ? `<div class="foto" style="background-image:url('${f1}')"></div>` : `<div class="foto sinfoto"><img src="${logo}" alt=""><span>Fotos en la ficha: escanea el código</span></div>`}
${f2 || f3 ? `<div class="minis">${f2 ? `<div style="background-image:url('${f2}')"></div>` : ""}${f3 ? `<div style="background-image:url('${f3}')"></div>` : ""}</div>` : ""}
<div class="cuerpo">
  <span class="etiq">${p.operacion === "alquiler" ? "En alquiler" : "En venta"}</span>${p.localidad ? `<span class="lugar">${esc(p.localidad)}</span>` : ""}
  <div class="tipo">${esc(p.tipo)}</div>
  <div class="precio">${esc(p.precio)}</div>
  ${p.datos.length ? `<div class="datos">${esc(p.datos.join(" · "))}</div>` : ""}
  ${p.extras.length ? `<div class="extras">${esc(p.extras.join(" · "))}</div>` : ""}
</div>
<div class="pie">
  <div><div class="ref">Referencia<b>${esc(p.ref)}</b></div><div class="tel">☎ ${esc(PRESENTACION.telefonos.join(" · "))}</div></div>
  ${qr ? `<div class="qr"><span>Escanea y<br>mira la ficha</span>${qr}</div>` : ""}
</div></body></html>`;
}

export function htmlPresentacion(n, { logo }) {
  const P = PRESENTACION;
  const vistas = [
    `<img src="${logo}" alt=""><div class="grande">${esc(P.nombre)}</div><div class="linea"></div><div class="medio">${esc(P.desde)}</div><div class="peq" style="margin-top:30px">${esc(P.servicios)}</div>`,
    `<div class="grande">${esc(P.lema)}</div><div class="linea"></div><div class="medio">${esc(P.inmobiliaria)}</div>`,
    `<div class="grande">Visítanos</div><div class="linea"></div><div class="medio">${esc(P.direccion)}</div><div class="peq" style="margin-top:40px">☎ ${esc(P.telefonos.join(" · "))}<br>${esc(P.web)}</div>`,
  ];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${cabecera(logo)}<div class="pres">${vistas[n % vistas.length]}</div></body></html>`;
}

// Orden: presentación, 4 inmuebles, presentación, 4 inmuebles… y cierre con contacto.
export function planDiapositivas(pisos, cada = 4) {
  const plan = [{ tipo: "pres", n: 0 }];
  pisos.forEach((p, i) => {
    plan.push({ tipo: "piso", p });
    if ((i + 1) % cada === 0 && i < pisos.length - 1) plan.push({ tipo: "pres", n: plan.filter((x) => x.tipo === "pres").length });
  });
  plan.push({ tipo: "pres", n: 2 });
  return plan;
}

async function descarga(url, destino) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

async function principal() {
  const datos = arg("datos");
  if (!datos || datos === true) {
    console.error("Falta --datos cartera.json");
    process.exit(1);
  }
  const salida = arg("salida", join(RAIZ, "escaparate3d", "usb"));
  const segundos = Number(arg("segundos", 8)) || 8;
  const cada = Number(arg("cada", 4)) || 4;
  const crudo = JSON.parse(readFileSync(datos, "utf8"));
  const pisos = (crudo.out || crudo.inmuebles || crudo).map(normaliza);
  const plan = planDiapositivas(pisos, cada);

  const dirDiapos = join(salida, "diapositivas");
  const dirFotos = join(salida, ".fotos");
  rmSync(dirDiapos, { recursive: true, force: true });
  mkdirSync(dirDiapos, { recursive: true });
  mkdirSync(dirFotos, { recursive: true });
  const logo = "data:image/jpeg;base64," + readFileSync(join(RAIZ, "cerebro", "logo-castresana.jpg")).toString("base64");

  const { chromium } = await import("playwright");
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
  const pag = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
  let n = 0;
  for (const d of plan) {
    n++;
    let html;
    let nombre;
    if (d.tipo === "piso") {
      const locales = [];
      for (const [i, u] of d.p.fotos.entries()) {
        const f = join(dirFotos, `${d.p.ref.replace(/[^\w-]/g, "_")}-${i}.jpg`);
        try {
          if (!existsSync(f)) await descarga(u, f);
          locales.push("data:image/jpeg;base64," + readFileSync(f).toString("base64"));
        } catch (e) {
          console.warn(`  ⚠ ${d.p.ref}: no se pudo bajar una foto (${e.message})`);
        }
      }
      html = htmlInmueble(d.p, { logo, fotosLocales: locales });
      nombre = d.p.ref;
    } else {
      html = htmlPresentacion(d.n, { logo });
      nombre = "castresana";
    }
    await pag.setContent(html, { waitUntil: "load" });
    await pag.screenshot({ path: join(dirDiapos, `${String(n).padStart(2, "0")}-${nombre.replace(/[^\w-]/g, "_")}.jpg`), type: "jpeg", quality: 90 });
  }
  await nav.close();
  console.log(`✅ ${n} diapositivas (${pisos.length} inmuebles) en ${dirDiapos}`);

  if (arg("sin-video")) return;
  let ffmpeg = process.env.FFMPEG || "ffmpeg";
  try {
    execFileSync(ffmpeg, ["-version"], { stdio: "ignore" });
  } catch {
    try {
      ffmpeg = (await import("ffmpeg-static")).default;
    } catch {
      console.error("No encuentro ffmpeg: quedan las diapositivas JPG (sirven como pase de fotos en la tele).");
      return;
    }
  }
  const lista = join(salida, ".lista.txt");
  const archivos = plan.map((_, i) => i + 1);
  const { readdirSync } = await import("node:fs");
  const jpgs = readdirSync(dirDiapos).filter((f) => f.endsWith(".jpg")).sort();
  writeFileSync(lista, jpgs.map((f) => `file '${join(dirDiapos, f).replace(/'/g, "'\\''")}'\nduration ${segundos}`).join("\n") + `\nfile '${join(dirDiapos, jpgs.at(-1))}'\n`);
  const vertical = join(salida, "1-vertical.mp4");
  const comunes = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", "-an"];
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lista, "-vf", "scale=1080:1920,format=yuv420p", ...comunes, vertical], { stdio: "inherit" });
  // Una tele colgada en vertical puede estar girada hacia cualquiera de los dos
  // lados (o mostrar la imagen boca abajo): se sacan todas las orientaciones y
  // en la tienda se prueba la que se vea derecha.
  const giros = [["2-girado-izquierda.mp4", "transpose=2"], ["3-girado-derecha.mp4", "transpose=1"], ["4-vertical-boca-abajo.mp4", "hflip,vflip"]];
  for (const [nombre, filtro] of giros) {
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", vertical, "-vf", filtro, ...comunes, join(salida, nombre)], { stdio: "inherit" });
  }
  rmSync(lista, { force: true });
  console.log(`✅ Vídeos en ${salida}: 1-vertical, ${giros.map(([n]) => n.replace(".mp4", "")).join(", ")}  (${archivos.length} diapositivas × ${segundos} s)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
