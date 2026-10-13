// ============================================================================
//  Esqueleto HTML de la app y manifiesto de la PWA — lógica pura
// ----------------------------------------------------------------------------
//  El nombre de la app y su título salen del NOMBRE COMERCIAL de Ajustes, y
//  los colores de la marca. Todo pasa por esc(). Sin estilos ni scripts en
//  línea (la CSP lo prohíbe): los colores viajan en <meta name="marca-colores">
//  y app.js los aplica como variables CSS.
//  El esqueleto no lleva ningún dato de clientes: se puede guardar en la
//  caché del móvil para que la app abra sin cobertura.
// ============================================================================
import { coloresInterfaz } from "../public/static/nucleo/marca.js";

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

export const tituloApp = (marca) => `${marca.nombreComercial} · Hojas firmadas`;

export function paginaApp({ marca, conLogo }) {
  const c = coloresInterfaz(marca);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloApp(marca))}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${esc(c.principal)}">
<meta name="marca-colores" content="${esc([c.principal, c.acento, c.sobrePrincipal, c.sobreAcento, c.titulos].join(","))}">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icono-192.png" type="image/png">
<link rel="apple-touch-icon" href="/icono-192.png">
<link rel="stylesheet" href="/static/estilos.css">
<script type="module" src="/static/app/app.js"></script>
</head>
<body>
<a class="saltar" href="#vista">Saltar al contenido</a>
<header class="barra">
  <a class="marca" href="#inicio">${conLogo ? `<span class="logo-caja"><img src="/marca/logo.jpg" alt="" class="logo"></span>` : ""}<span class="nombre-app">${esc(marca.nombreComercial)}</span></a>
  <span id="red" class="red" role="status" aria-live="polite"></span>
</header>
<div id="pendientes" class="pendientes" role="status" aria-live="polite" hidden></div>
<main id="vista" class="vista" tabindex="-1"><p class="cargando">Cargando…</p></main>
<nav class="pestanas" aria-label="Secciones" id="pestanas" hidden>
  <a href="#inicio" data-pestana="inicio">Inicio</a>
  <a href="#hojas" data-pestana="hojas">Hojas</a>
  <a href="#ajustes" data-pestana="ajustes">Ajustes</a>
</nav>
<div id="aviso" class="aviso" role="status" aria-live="polite" hidden></div>
<noscript><p class="noscript">Esta app necesita JavaScript.</p></noscript>
</body>
</html>`;
}

export function manifiesto(marca) {
  const c = coloresInterfaz(marca);
  return JSON.stringify({
    name: tituloApp(marca),
    short_name: marca.nombreComercial.slice(0, 24),
    description: `Hojas de visita y de captación firmadas con el dedo · ${marca.nombreComercial}`,
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: c.principal,
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
}

export function paginaMensaje({ titulo, texto }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title><meta name="robots" content="noindex, nofollow"><link rel="stylesheet" href="/static/estilos.css"></head>
<body><main class="vista"><h1>${esc(titulo)}</h1><p>${esc(texto)}</p><p><a class="boton" href="/">Volver</a></p></main></body></html>`;
}
