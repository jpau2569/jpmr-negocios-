// ============================================================================
//  Módulo "QUIERO MI DEMO" (apartado comercial, común a los dos sectores)
// ----------------------------------------------------------------------------
//  Es el apartado que convierte a quien ve la demo en cliente: "esto mismo, con
//  tu negocio dentro". Ojo con el destino: este formulario NO va al negocio de
//  la demo, va a quien vende el producto (config.comercial). Por eso tiene su
//  propio bloque de contacto y su propio origen de lead.
// ============================================================================

import { crear, abrirModal, aviso, campo, valores, icono, euros, enlaceWhatsapp, enlaceCorreo } from "../js/ui.js";
import { svg as qrSvg } from "../js/qr.js";

export const meta = {
  id: "demo",
  nombre: "Quiero esto para mi negocio",
  modulo: "pedirDemo",
  sector: "todos",
};

const SECTORES = [
  "Restaurante o sidrería", "Inmobiliaria", "Clínica dental", "Despacho de abogados",
  "Gestoría o asesoría", "Farmacia", "Peluquería o estética", "Taller",
  "Hotel o casa rural", "Otro",
];

export function crearModulo(ctx) {
  const { config, almacen } = ctx;
  const comercial = config.comercial || {};

  // El contacto comercial es distinto del contacto del negocio de la demo.
  const contactoComercial = {
    contacto: { whatsapp: comercial.whatsapp || "", email: comercial.email || "", telefono: "", telefonoTexto: "" },
  };

  function mensaje(datos) {
    return [
      `Hola ${comercial.responsable || ""}, he visto la demo de ${config.nombre} y quiero una para mi negocio.`.trim(),
      "",
      `Negocio: ${datos.negocio}`,
      `Sector: ${datos.sector}`,
      datos.web ? `Web o Instagram: ${datos.web}` : "Todavía no tengo web",
      datos.problema ? `Lo que más me molesta hoy: ${datos.problema}` : null,
      "",
      `Nombre: ${datos.nombre}`,
      datos.telefono ? `Teléfono: ${datos.telefono}` : null,
      datos.email ? `Correo: ${datos.email}` : null,
    ].filter(Boolean).join("\n");
  }

  function abrir() {
    const cuerpo = crear("form", { clase: "formulario", novalidate: true }, [
      crear("p", { texto: comercial.texto || "" }),
      crear("div", { clase: "fila" }, [
        campo({ id: "negocio", etiqueta: "Nombre del negocio", requerido: true }),
        campo({ id: "sector", etiqueta: "Sector", tipo: "select", opciones: SECTORES }),
      ]),
      campo({ id: "web", etiqueta: "Web o Instagram (de ahí sacamos fotos y datos)", placeholder: "www.tunegocio.com" }),
      campo({ id: "problema", etiqueta: "¿Qué es lo que más tiempo te quita hoy?", tipo: "textarea", placeholder: "Coger reservas por teléfono, mandar pisos por WhatsApp uno a uno…" }),
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Tu nombre", requerido: true, autocomplete: "name" }),
        campo({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", autocomplete: "tel" }),
      ]),
      campo({ id: "email", etiqueta: "Correo", tipo: "email", autocomplete: "email" }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "submit", texto: "Quiero mi demo" }),
      ]),
      comercial.plazo ? crear("p", { clase: "pequeno tenue", texto: comercial.plazo }) : null,
    ]);

    cuerpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const datos = valores(cuerpo);
      if (!datos.negocio || !datos.nombre) return aviso("Dime al menos el nombre del negocio y el tuyo.", { error: true });
      if (!datos.telefono && !datos.email) return aviso("Déjame un teléfono o un correo para poder contestarte.", { error: true });

      const resultado = await almacen.guardarLead({ ...datos, tipo: "peticion-demo", origen: "escaparate3d-pro:demo" });
      const texto = mensaje(datos);
      const wasap = enlaceWhatsapp(contactoComercial, texto);
      const correo = enlaceCorreo(contactoComercial, `Quiero una demo — ${datos.negocio}`, texto);

      abrirModal("Petición enviada", crear("div", {}, [
        crear("p", { html: `<strong>Referencia ${resultado.id}</strong>. ${resultado.enviado ? "Ya me ha llegado." : "Guardada en este dispositivo."}` }),
        crear("p", { clase: "pequeno tenue", texto: "Para que sea inmediato, mándamelo también por WhatsApp: te contesto con la demo de tu negocio." }),
        crear("div", { clase: "botonera" }, [
          wasap ? crear("a", { clase: "boton principal", href: wasap, target: "_blank", rel: "noopener", html: `${icono("whatsapp")}<span>Mandármelo por WhatsApp</span>` }) : null,
          correo ? crear("a", { clase: "boton", href: correo, texto: "Mandármelo por correo" }) : null,
        ]),
        crear("details", {}, [crear("summary", { texto: "Ver el mensaje" }), crear("pre", { clase: "mensaje", texto })]),
      ]));
    });

    abrirModal(comercial.titulo || meta.nombre, cuerpo);
  }

  // Enlace de ESTA demo, limpio de parámetros de sesión (mesa, borrador...).
  function enlaceDeLaDemo() {
    if (comercial.enlaceDemo) return comercial.enlaceDemo;
    const url = new URL(location.href);
    url.hash = "";
    for (const suelto of ["mesa", "borrador", "t", "auto"]) url.searchParams.delete(suelto);
    if (config.id) url.searchParams.set("negocio", config.id);
    return url.href;
  }

  // El mensaje tiene que explicar la demo SIN que tú estés delante: quien la
  // recibe por WhatsApp no sabe qué es ni qué gana, y sin eso no la abre.
  function mensajeParaMandar(enlace) {
    const precio = comercial.precio ? euros(comercial.precio) : null;
    return [
      `Mira esto: es una web de verdad para ${config.sector === "restaurante" ? "un restaurante" : "una inmobiliaria"}, funcionando.`,
      "",
      enlace,
      "",
      "Ábrelo en el móvil y toca lo que quieras: no es un vídeo, se puede usar.",
      config.sector === "restaurante"
        ? "Verás la carta en 3D, se puede pedir y reservar mesa, y hay un QR para cada mesa del local."
        : "Verás la cartera en 3D, se marcan los pisos que te gustan y se pide visita solo con esos.",
      "Dentro tienes un botón que te lo explica en 2 minutos.",
      "",
      precio ? `Montarla con tus datos no cuesta nada; la tuya de verdad son ${precio}.` : null,
    ].filter(Boolean).join("\n");
  }

  function compartir() {
    const enlace = enlaceDeLaDemo();
    const texto = mensajeParaMandar(enlace);
    const wasap = `https://wa.me/?text=${encodeURIComponent(texto)}`;

    abrirModal("Mandar esta demo", crear("div", { clase: "formulario" }, [
      crear("p", { clase: "pequeno tenue", texto: "El mensaje ya va explicado: quien lo reciba entiende qué está viendo sin que tú estés delante." }),
      crear("label", { clase: "campo" }, [
        crear("span", { texto: "Enlace de esta demo" }),
        crear("input", { value: enlace, readonly: true, onclick: (ev) => ev.target.select() }),
      ]),
      crear("div", { clase: "botonera" }, [
        crear("a", { clase: "boton principal", href: wasap, target: "_blank", rel: "noopener", html: `${icono("whatsapp")}<span>Mandar por WhatsApp</span>` }),
        crear("a", { clase: "boton", href: `mailto:?subject=${encodeURIComponent("Mira esta web, funciona de verdad")}&body=${encodeURIComponent(texto)}`, texto: "Mandar por correo" }),
        crear("button", {
          clase: "boton plano", type: "button", texto: "Copiar el enlace",
          onclick: async () => {
            try { await navigator.clipboard.writeText(enlace); aviso("Enlace copiado."); }
            catch { aviso("Tu navegador no deja copiar automáticamente.", { error: true }); }
          },
        }),
      ]),
      crear("p", { clase: "pequeno tenue", texto: "O que la abra en su móvil escaneando esto:" }),
      crear("div", { clase: "tarjeta-qr", style: "max-width:220px" }, [
        crear("div", { html: qrSvg(enlace, { nivel: "M", margen: 2 }) }),
        crear("strong", { texto: config.nombre }),
      ]),
      crear("details", {}, [crear("summary", { texto: "Ver el mensaje" }), crear("pre", { clase: "mensaje", texto })]),
    ]));
  }

  // Bloque fijo en la página, no solo un botón: es la parte que vende.
  function montarSeccion(nodo) {
    nodo.append(
      crear("h2", { texto: comercial.titulo || meta.nombre }),
      crear("p", { texto: comercial.texto || "" }),
      crear("ul", { clase: "lista-lineas" }, [
        crear("li", { texto: "Tus colores, tu logo, tu teléfono y tus redes: el mismo escaparate, con tu marca." }),
        crear("li", { texto: "Tus productos de verdad: la carta del restaurante o la cartera de pisos, no fotos de catálogo." }),
        crear("li", { texto: "Pedidos, reservas, QR de mesas o solicitudes de visita funcionando, no un maquetado." }),
        crear("li", { texto: "Se ve bien en el móvil del cliente y en la tele del escaparate." }),
      ]),
      comercial.precio
        ? crear("p", { html: `${comercial.demoGratis ? "<strong>La demo con tu negocio dentro es gratis.</strong> " : ""}La tuya de verdad, con tus datos y todo funcionando: <strong style="color:var(--color-acento);font-size:1.25rem">${euros(comercial.precio)}</strong>.` })
        : null,
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "button", texto: "Quiero la mía", onclick: abrir }),
        crear("button", { clase: "boton", type: "button", html: `${icono("whatsapp")}<span>Mandársela a alguien</span>`, onclick: compartir }),
        comercial.whatsapp
          ? crear("a", {
              clase: "boton", target: "_blank", rel: "noopener",
              href: enlaceWhatsapp(contactoComercial, `Hola, he visto la demo de ${config.nombre} y quiero una para mi negocio.`),
              html: `${icono("whatsapp")}<span>Preguntar por WhatsApp</span>`,
            })
          : null,
      ]),
      comercial.plazo ? crear("p", { clase: "pequeno tenue", texto: comercial.plazo }) : null
    );
  }

  return { meta, abrir, compartir, montarSeccion, tituloSeccion: null };
}
