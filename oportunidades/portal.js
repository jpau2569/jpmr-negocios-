/* ==========================================================================
   PORTAL DEL COMPRADOR
   --------------------------------------------------------------------------
   Lo que abre el cliente cuando Pau le manda su selección por WhatsApp.
   No hay usuario ni contraseña: el token del enlace (32 caracteres) es lo que
   identifica al cliente, y el backend solo devuelve los inmuebles que se le
   han autorizado, con los campos públicos. Ni teléfonos, ni notas, ni la
   dirección exacta.

   El token viaja en la parte de la dirección posterior a la almohadilla, que
   el navegador NO envía al servidor ni aparece en los registros del hosting.
   ========================================================================== */

const $ = (id) => document.getElementById(id);

const RESPUESTAS = [
  { id: "visita", texto: "Quiero visitarlo", clase: "btn" },
  { id: "interesa", texto: "Me interesa", clase: "btn claro" },
  { id: "similares", texto: "Enséñame parecidos", clase: "btn claro" },
  { id: "no_encaja", texto: "No me encaja", clase: "btn claro" },
];

const tokenDelEnlace = () => (location.hash || "").replace(/^#/, "").trim();

function el(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "clase") nodo.className = v;
    else if (k === "texto") nodo.textContent = v;
    else if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? "" : v);
  }
  for (const h of [].concat(hijos)) {
    if (h === null || h === undefined || h === false) continue;
    nodo.append(typeof h === "string" ? document.createTextNode(h) : h);
  }
  return nodo;
}

// Igual que en app.js: `replaceChildren()` del navegador escribe «null» cuando
// le llega uno, y aquí se pinta con `condición ? el(...) : null`.
function pintar(nodo, ...hijos) {
  nodo.replaceChildren(
    ...hijos.flat().filter((h) => h !== null && h !== undefined && h !== false)
  );
}

const euros = (n) =>
  n === null || n === undefined
    ? "Consultar"
    : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n));

function toast(mensaje) {
  const t = $("toast");
  t.textContent = mensaje;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3200);
}

async function api(accion, datos) {
  const resp = await fetch("/api/oportunidades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion, ...datos }),
  });
  const cuerpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(cuerpo.error || "No se pudo abrir tu selección.");
  return cuerpo;
}

function pintarInmueble(inm) {
  const foto = el("div", { clase: "foto" }, [inm.portada_url ? "" : "⌂"]);
  if (inm.portada_url) foto.style.backgroundImage = `url(${CSS.escape(inm.portada_url)})`;

  const datos = [
    inm.habitaciones ? `${inm.habitaciones} habitaciones` : null,
    inm.banos ? `${inm.banos} baños` : null,
    inm.metros ? `${inm.metros} m²` : null,
    [inm.zona, inm.ciudad].filter(Boolean).join(", "),
  ].filter(Boolean);

  const zonaRespuesta = el("div", { clase: "respuestas" });
  for (const r of RESPUESTAS) {
    zonaRespuesta.append(
      el("button", {
        clase: r.clase, type: "button", texto: r.texto,
        onclick: async (ev) => {
          const botones = [...zonaRespuesta.querySelectorAll("button")];
          botones.forEach((b) => (b.disabled = true));
          try {
            await api("portal.responder", { token: tokenDelEnlace(), slug: inm.slug, respuesta: r.id });
            zonaRespuesta.replaceWith(
              el("div", { clase: "respondido", texto:
                r.id === "visita"
                  ? "Perfecto: te llamamos para cuadrar la visita."
                  : r.id === "no_encaja"
                    ? "Anotado, no te enseñaremos más como este."
                    : "Gracias, lo tenemos en cuenta. Te escribimos enseguida." })
            );
          } catch (e) {
            botones.forEach((b) => (b.disabled = false));
            toast(e.message);
          }
        },
      })
    );
  }

  return el("article", { clase: "pieza" }, [
    foto,
    el("div", { clase: "cuerpo" }, [
      el("div", { clase: "precio", texto: euros(inm.precio) + (inm.operacion === "alquiler" ? " al mes" : "") }),
      el("h2", { texto: inm.titulo }),
      el("div", { clase: "datos" }, datos.map((d) => el("span", { texto: d }))),
      inm.descripcion ? el("p", { clase: "descripcion", texto: inm.descripcion }) : null,
      zonaRespuesta,
    ]),
  ]);
}

async function abrir() {
  const token = tokenDelEnlace();
  if (!token || token.length < 24) {
    pintar($("contenido"), 
      el("div", { clase: "vacio" }, [
        el("b", { texto: "Este enlace no está completo" }),
        el("p", { clase: "apunte", style: "margin-top:6px", texto: "Copia el enlace entero del mensaje que te enviamos, o pídenos uno nuevo." }),
      ])
    );
    return;
  }

  try {
    const datos = await api("portal.leer", { token });
    const nombre = datos.cliente?.nombre || "";
    $("saludo").textContent = nombre ? `Hola, ${nombre}` : "Tu selección";
    $("intro").textContent = datos.inmuebles.length === 1
      ? "Este es el inmueble que hemos preparado para ti. Dinos qué te parece."
      : `Estos son los ${datos.inmuebles.length} inmuebles que hemos preparado para ti. Dinos cuáles te interesan.`;

    pintar($("contenido"), 
      ...(datos.inmuebles.length
        ? datos.inmuebles.map(pintarInmueble)
        : [el("div", { clase: "vacio", texto: "Todavía no hay inmuebles en tu selección. Te avisamos en cuanto tengamos algo que encaje." })])
    );
  } catch (e) {
    pintar($("contenido"), 
      el("div", { clase: "vacio" }, [
        el("b", { texto: "No hemos podido abrir tu selección" }),
        el("p", { clase: "apunte", style: "margin-top:6px", texto: e.message }),
        el("p", { clase: "apunte", style: "margin-top:10px" }, [
          "Escríbenos y te mandamos un enlace nuevo: ",
          el("a", {
            href: "https://wa.me/34663263842?text=" + encodeURIComponent("Hola, el enlace de mi selección no me funciona."),
            target: "_blank", rel: "noopener", texto: "WhatsApp 663 26 38 42",
          }),
          " · ",
          el("a", { href: "tel:+34985210468", texto: "985 210 468" }),
        ]),
      ])
    );
  }
}

// Si el cliente pega otro enlace en la misma pestaña, el navegador no recarga
// la página: solo cambia la almohadilla. Hay que volver a abrir la selección.
window.addEventListener("hashchange", abrir);
abrir();
