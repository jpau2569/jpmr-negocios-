// ============================================================================
//  OPORTUNIDADES ÚNICAS — ficha pública de un inmueble  (/p/<slug>)
// ----------------------------------------------------------------------------
//  Esta función devuelve la página YA MONTADA desde el servidor, no un
//  esqueleto que se rellena con JavaScript. El motivo es concreto: cuando Pau
//  pega el enlace en WhatsApp, quien lo recibe tiene que ver la tarjeta con la
//  foto, el título y el precio. WhatsApp (y Facebook, y Telegram) leen las
//  etiquetas Open Graph del HTML sin ejecutar JavaScript: si la página se
//  montara en el navegador, la tarjeta saldría vacía.
//
//  Solo sirve inmuebles marcados como públicos, y solo los campos de la vista
//  `ou_publico`: la dirección exacta, las notas y los datos de clientes no
//  salen de aquí ni por equivocación, porque esa vista no los tiene.
// ============================================================================

import { CONTACTO, enlaceWhatsapp, texto } from "../lib/oportunidades.js";

const CARACTERISTICAS = {
  terraza: "Terraza", ascensor: "Ascensor", garaje: "Garaje", trastero: "Trastero",
  jardin: "Jardín", piscina: "Piscina", reformado: "Reformado", amueblado: "Amueblado",
  calefaccion: "Calefacción", exterior: "Exterior", vistas: "Vistas", "obra-nueva": "Obra nueva",
};

/** Escapa para meter texto dentro de HTML o de un atributo. Sin excepciones. */
export function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const euros = (n) =>
  n === null || n === undefined
    ? "Consultar precio"
    : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n));

/** Lee el inmueble de la vista pública. Sin sesión: la vista ya está acotada. */
async function leerFicha(slug) {
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/ou_publico?slug=eq.${encodeURIComponent(slug)}&limit=1`,
      {
        signal: ctrl.signal,
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!resp.ok) return null;
    const filas = await resp.json();
    return Array.isArray(filas) ? filas[0] || null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(alarma);
  }
}

function paginaDeError(titulo, mensaje) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(titulo)} · ${esc(CONTACTO.empresa)}</title>
<style>
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#F6F7F9;color:#16202B;
    display:grid;place-items:center;min-height:100dvh;margin:0;padding:24px;text-align:center}
  .caja{background:#fff;border:1px solid #E3E7EC;border-radius:16px;padding:36px 30px;max-width:420px}
  h1{font-family:Georgia,serif;font-size:23px;margin:0 0 10px}
  p{color:#5A6B7C;font-size:15px;line-height:1.6;margin:0 0 20px}
  a{display:inline-block;background:#0B3B60;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600}
</style></head>
<body><div class="caja">
  <h1>${esc(titulo)}</h1>
  <p>${esc(mensaje)}</p>
  <a href="${esc(enlaceWhatsapp("Hola, he abierto un enlace de un inmueble que ya no está disponible. ¿Tenéis algo parecido?"))}">Escríbenos por WhatsApp</a>
</div></body></html>`;
}

export function paginaFicha(inm, origen) {
  const titulo = `${inm.titulo} · ${euros(inm.precio)}${inm.operacion === "alquiler" ? "/mes" : ""}`;
  const donde = [inm.zona, inm.ciudad].filter(Boolean).join(", ");
  const datos = [
    inm.habitaciones ? `${inm.habitaciones} hab` : null,
    inm.banos ? `${inm.banos} baños` : null,
    inm.metros ? `${inm.metros} m²` : null,
  ].filter(Boolean);

  // La descripción para la tarjeta: datos reales, cortada sin dejar frases a medias.
  const resumen = [donde, datos.join(" · "), texto(inm.descripcion, 150)].filter(Boolean).join(". ");
  const fotos = Array.isArray(inm.fotos) ? inm.fotos.filter((f) => f && f.url) : [];
  const portada = inm.portada_url || fotos[0]?.url || "";

  const mensaje = `Hola, me interesa el inmueble ${inm.referencia}: ${inm.titulo}. ¿Podemos concertar una visita?`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(resumen)}" />
<meta name="theme-color" content="#0B3B60" />
<!-- Enlace pensado para mandarlo a un cliente concreto, no para que lo
     encuentre cualquiera en Google. Si algún día quieres que los buscadores
     indexen la cartera, cambia esta línea por "index, follow". -->
<meta name="robots" content="noindex, nofollow" />

<!-- Lo que lee WhatsApp para pintar la tarjeta del enlace -->
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${esc(CONTACTO.empresa)}" />
<meta property="og:title" content="${esc(titulo)}" />
<meta property="og:description" content="${esc(resumen)}" />
<meta property="og:url" content="${esc(origen)}/p/${esc(inm.slug)}" />
<meta property="og:locale" content="es_ES" />
${portada ? `<meta property="og:image" content="${esc(portada)}" />
<meta property="og:image:alt" content="${esc(inm.titulo)}" />
<meta name="twitter:card" content="summary_large_image" />` : '<meta name="twitter:card" content="summary" />'}

<link rel="icon" href='data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230B3B60"/%3E%3Ctext x="50" y="64" font-family="Georgia,serif" font-size="40" fill="%23D9B75F" text-anchor="middle"%3EOU%3C/text%3E%3C/svg%3E' />
<style>
  :root{--azul:#0B3B60;--oro:#D9B75F;--tinta:#16202B;--tinta-2:#5A6B7C;--linea:#E3E7EC;--papel:#F6F7F9}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--tinta);background:#fff;line-height:1.6}
  .cabecera{background:linear-gradient(160deg,var(--azul),#093150);color:#fff;padding:22px 20px}
  .dentro{max-width:960px;margin:0 auto}
  .marca{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none}
  .sigla{width:40px;height:40px;border-radius:11px;background:rgba(255,255,255,.12);border:1px solid rgba(217,183,95,.45);
    display:grid;place-items:center;font-family:Georgia,serif;color:var(--oro);font-size:16px;font-weight:600}
  .marca b{font-family:Georgia,serif;font-size:15.5px;font-weight:600;line-height:1.15;display:block}
  .marca span{font-size:12px;color:rgba(255,255,255,.72)}
  .galeria{display:grid;gap:3px;background:var(--linea)}
  .galeria.varias{grid-template-columns:2fr 1fr}
  .galeria img{width:100%;height:100%;object-fit:cover;display:block;background:#E9EDF2}
  .galeria .principal{aspect-ratio:4/3}
  .galeria .resto{display:grid;gap:3px;grid-template-rows:repeat(2,1fr)}
  /* En móvil las fotos secundarias van debajo. Con auto-fit, si solo hay una,
     ocupa el ancho entero en vez de dejar media rejilla en gris. */
  @media(max-width:700px){.galeria.varias{grid-template-columns:1fr}
    .galeria .resto{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));grid-template-rows:none}
    .galeria .resto img{aspect-ratio:4/3}}
  .cuerpo{max-width:960px;margin:0 auto;padding:26px 20px 40px}
  .precio{font-family:Georgia,serif;font-size:clamp(28px,6vw,38px);color:var(--azul);font-weight:600;line-height:1.1}
  h1{font-family:Georgia,serif;font-size:clamp(20px,4vw,26px);font-weight:600;margin:6px 0 2px}
  .donde{color:var(--tinta-2);font-size:15.5px}
  .datos{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}
  .dato{border:1px solid var(--linea);border-radius:10px;padding:10px 16px;min-width:88px}
  .dato b{display:block;font-family:Georgia,serif;font-size:20px;color:var(--azul)}
  .dato span{font-size:12.5px;color:var(--tinta-2)}
  .caracteristicas{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:22px}
  .caracteristicas span{background:#EEF3F8;color:var(--azul);border-radius:999px;padding:5px 13px;font-size:13.5px}
  .descripcion{white-space:pre-wrap;color:#33404E;border-top:1px solid var(--linea);padding-top:20px;margin-bottom:26px}
  .acciones{display:flex;flex-wrap:wrap;gap:10px;position:sticky;bottom:0;background:#fff;padding:14px 0;
    border-top:1px solid var(--linea)}
  .btn{flex:1 1 200px;display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--azul);
    color:#fff;text-decoration:none;padding:15px 22px;border-radius:11px;font-weight:600;font-size:15.5px}
  .btn.wasap{background:#1FA855}
  .btn.claro{background:#fff;color:var(--azul);border:1px solid var(--linea)}
  .pie{background:var(--papel);border-top:1px solid var(--linea);padding:26px 20px 40px;color:var(--tinta-2);font-size:13.5px}
  .pie b{color:var(--tinta);display:block;margin-bottom:5px}
  .pie a{color:var(--azul)}
  .ref{color:var(--tinta-2);font-size:13px;margin-top:14px}
</style>
</head>
<body>

<header class="cabecera">
  <div class="dentro">
    <a class="marca" href="https://www.${esc(CONTACTO.web)}" target="_blank" rel="noopener">
      <span class="sigla">OU</span>
      <span><b>Oportunidades Únicas</b><span>${esc(CONTACTO.empresa)}</span></span>
    </a>
  </div>
</header>

${portada ? `<div class="galeria${fotos.length > 1 ? " varias" : ""}">
  <div class="principal"><img src="${esc(portada)}" alt="${esc(inm.titulo)}" /></div>
  ${fotos.length > 1 ? `<div class="resto">${fotos.filter((f) => f.url !== portada).slice(0, 2)
    .map((f) => `<img src="${esc(f.url)}" alt="${esc(inm.titulo)}" loading="lazy" />`).join("")}</div>` : ""}
</div>` : ""}

<main class="cuerpo">
  <div class="precio">${esc(euros(inm.precio))}${inm.operacion === "alquiler" ? " al mes" : ""}</div>
  <h1>${esc(inm.titulo)}</h1>
  <div class="donde">${esc(donde)}</div>

  <div class="datos">
    ${inm.habitaciones ? `<div class="dato"><b>${esc(inm.habitaciones)}</b><span>habitaciones</span></div>` : ""}
    ${inm.banos ? `<div class="dato"><b>${esc(inm.banos)}</b><span>baños</span></div>` : ""}
    ${inm.metros ? `<div class="dato"><b>${esc(inm.metros)}</b><span>m² construidos</span></div>` : ""}
  </div>

  ${(inm.caracteristicas || []).length ? `<div class="caracteristicas">${(inm.caracteristicas || [])
    .map((c) => `<span>${esc(CARACTERISTICAS[c] || c)}</span>`).join("")}</div>` : ""}

  ${inm.descripcion ? `<div class="descripcion">${esc(inm.descripcion)}</div>` : ""}

  <div class="acciones">
    <a class="btn wasap" href="${esc(enlaceWhatsapp(mensaje))}" target="_blank" rel="noopener">Pedir visita por WhatsApp</a>
    <a class="btn claro" href="tel:+34${esc(CONTACTO.telefono.replace(/\s/g, ""))}">Llamar al despacho</a>
  </div>

  <p class="ref">Referencia ${esc(inm.referencia)}. Los datos son orientativos y no constituyen oferta contractual.</p>
</main>

<footer class="pie">
  <div class="dentro">
    <b>${esc(CONTACTO.empresa)}</b>
    ${esc(CONTACTO.ciudad)} ·
    <a href="tel:+34${esc(CONTACTO.telefono.replace(/\s/g, ""))}">${esc(CONTACTO.telefono)}</a> ·
    WhatsApp <a href="${esc(enlaceWhatsapp("Hola, os escribo desde una ficha de Oportunidades Únicas."))}">${esc(CONTACTO.whatsapp)}</a> ·
    <a href="https://www.${esc(CONTACTO.web)}" target="_blank" rel="noopener">${esc(CONTACTO.web)}</a>
  </div>
</footer>

</body>
</html>`;
}

export default async function handler(req, res) {
  // El slug llega por la reescritura /p/<slug> o por ?slug= al llamarla directa.
  const slug = texto(req.query?.slug || (req.url || "").split("/p/")[1] || "", 100)
    .split("?")[0]
    .replace(/[^a-z0-9-]/gi, "");

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(
      paginaDeError("Todavía no está configurado", "Esta ficha no se puede mostrar porque falta la conexión con la base de datos.")
    );
  }
  if (!slug) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).send(paginaDeError("Enlace incompleto", "Copia el enlace entero del mensaje que te enviamos."));
  }

  const inmueble = await leerFicha(slug);
  if (!inmueble) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).send(
      paginaDeError("Este inmueble ya no está disponible", "Puede que se haya vendido o que lo hayamos retirado. Escríbenos y te enseñamos algo parecido.")
    );
  }

  const origen = `https://${req.headers["x-forwarded-host"] || req.headers.host || ""}`;
  // Cinco minutos en el navegador y diez en el borde: si Pau cambia el precio,
  // la ficha se actualiza sola en poco rato sin machacar la base de datos.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  return res.status(200).send(paginaFicha(inmueble, origen));
}
