// ============================================================================
//  Módulo CITAS (sector servicios: peluquería, clínica, taller…)
// ----------------------------------------------------------------------------
//  Aquí está la diferencia real con la reserva de un restaurante: una mesa se
//  reserva "para el turno de las 21:00", pero una cita OCUPA UN RATO. Cortar y
//  peinar son 45 minutos; una endodoncia, hora y media; un cambio de aceite,
//  media hora. Así que las horas que se ofrecen dependen del servicio elegido:
//  solo se enseñan los huecos en los que ese trabajo cabe entero antes de
//  cerrar y sin pisar el descanso del mediodía.
//
//  Lo que este módulo NO hace, a propósito: no promete la hora. No conoce la
//  agenda real del negocio, así que la cita sale "pedida, pendiente de que te
//  confirmen". Prometer un hueco que luego está ocupado quema al cliente final
//  y quema al negocio con su cliente.
// ============================================================================

import {
  crear, abrirModal, aviso, campo, valores, bloqueEnvio,
  hoyISO, sumaDias, fechaLarga,
} from "../js/ui.js";
import { duracionTexto, precioTexto } from "./servicios.js";

export const meta = {
  id: "citas",
  nombre: "Pedir cita",
  modulo: "citas",
  sector: "servicios",
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/* --- Motor de huecos (puro, para poder probarlo sin navegador) ------------- */

// "09:30" → 570. Devuelve null si no es una hora válida.
export function aMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const horas = Number(m[1]), minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

// 570 → "09:30"
export const aHora = (minutos) =>
  `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/**
 * Huecos en los que un trabajo de `duracion` minutos cabe entero.
 * Se excluyen los que pisan el descanso y, si el día es hoy, los que ya pasaron.
 */
export function huecosDelDia({
  apertura = "09:30", cierre = "20:00", descanso = {}, intervalo = 15,
  duracion = 30, desdeMinutos = null,
} = {}) {
  const abre = aMinutos(apertura), cierra = aMinutos(cierre);
  const paso = Math.min(60, Math.max(5, Number(intervalo) || 15));
  const dura = Math.max(5, Number(duracion) || 30);
  if (abre === null || cierra === null || cierra <= abre) return [];

  const pausaIni = aMinutos(descanso.inicio);
  const pausaFin = aMinutos(descanso.fin);
  const hayPausa = pausaIni !== null && pausaFin !== null && pausaFin > pausaIni;

  const huecos = [];
  for (let t = abre; t + dura <= cierra; t += paso) {
    // Solape con el descanso: el trabajo empieza antes de que acabe la pausa y
    // termina después de que empiece.
    if (hayPausa && t < pausaFin && t + dura > pausaIni) continue;
    if (desdeMinutos !== null && t < desdeMinutos) continue;
    huecos.push(aHora(t));
  }
  return huecos;
}

/* --- Módulo ---------------------------------------------------------------- */

export function crearModulo(ctx) {
  const { config, almacen } = ctx;
  const ajustes = config.citas || {};
  const vocabulario = config.servicios?.vocabulario || {};
  const accion = vocabulario.accion || "Pedir cita";
  const nombreProfesional = vocabulario.profesional || "profesional";
  const moneda = config.servicios?.moneda || "€";
  const cerrados = (ajustes.diasCerrado || []).map(Number);

  const catalogo = (config.servicios?.categorias || [])
    .flatMap((c) => (c.items || []).map((s) => ({ ...s, categoria: c.nombre })));

  const estaCerrado = (iso) => {
    try { return cerrados.includes(new Date(iso + "T00:00:00").getDay()); } catch { return false; }
  };

  const servicioPorId = (id) => catalogo.find((s) => String(s.id) === String(id)) || null;

  const duracionDe = (servicio) =>
    Number(servicio?.duracion) || Number(ajustes.duracionPorDefecto) || 30;

  // Un profesional puede no hacer de todo: la peluquera que no hace barba o el
  // mecánico que no toca chapa. Si no se declara nada, vale para todo.
  const profesionalesPara = (servicio) =>
    (ajustes.profesionales || []).filter((p) =>
      !p.servicios?.length || !servicio || p.servicios.map(String).includes(String(servicio.id)));

  // Antelación mínima: nadie quiere una cita para dentro de 5 minutos.
  function minimoDeHoy(fechaISO) {
    if (fechaISO !== hoyISO()) return null;
    const ahora = new Date();
    const margen = Math.max(0, Number(ajustes.antelacionHoras) || 0) * 60;
    return ahora.getHours() * 60 + ahora.getMinutes() + margen;
  }

  function huecosPara(fechaISO, servicio) {
    return huecosDelDia({
      apertura: ajustes.horaApertura,
      cierre: ajustes.horaCierre,
      descanso: ajustes.descanso || {},
      intervalo: ajustes.intervaloMinutos,
      duracion: duracionDe(servicio),
      desdeMinutos: minimoDeHoy(fechaISO),
    });
  }

  function mensajeCita(c, servicio) {
    const extras = (ajustes.camposExtra || [])
      .map((campoExtra) => (c[campoExtra.id] ? `${campoExtra.etiqueta}: ${c[campoExtra.id]}` : null))
      .filter(Boolean);
    return [
      `Hola, quiero ${accion.toLowerCase()} en ${config.nombre}.`,
      "",
      servicio ? `Servicio: ${servicio.nombre}${duracionTexto(duracionDe(servicio)) ? ` (${duracionTexto(duracionDe(servicio))})` : ""}` : null,
      servicio ? `Precio indicado en la web: ${precioTexto(servicio, moneda)}` : null,
      `Día: ${fechaLarga(c.fecha)}`,
      `Hora que me viene bien: ${c.hora}`,
      c.profesional && c.profesional !== "Me da igual" ? `Con: ${c.profesional}` : null,
      ...extras,
      `Nombre: ${c.nombre}`,
      `Teléfono: ${c.telefono}`,
      c.notas ? `Notas: ${c.notas}` : null,
      "",
      `Referencia: ${c.id}`,
    ].filter(Boolean).join("\n");
  }

  /* --- Formulario --- */
  function abrir(servicioInicial = null) {
    const maximo = sumaDias(hoyISO(), Math.max(1, Number(ajustes.antelacionDias) || 60));
    const elegido = servicioInicial?.id ? servicioPorId(servicioInicial.id) || servicioInicial : null;

    const opcionesServicio = catalogo.map((s) => ({
      valor: String(s.id),
      texto: `${s.nombre}${duracionTexto(duracionDe(s)) ? ` · ${duracionTexto(duracionDe(s))}` : ""} · ${precioTexto(s, moneda)}`,
    }));

    const cuerpo = crear("form", { clase: "formulario", novalidate: true }, [
      ajustes.aviso ? crear("p", { clase: "aviso-demo", texto: ajustes.aviso }) : null,

      opcionesServicio.length
        ? campo({ id: "servicio", etiqueta: "¿Qué necesitas?", tipo: "select", requerido: true, opciones: opcionesServicio })
        : null,

      crear("div", { clase: "fila" }, [
        campo({ id: "fecha", etiqueta: "Día", tipo: "date", requerido: true, value: hoyISO(), min: hoyISO(), max: maximo }),
        campo({ id: "hora", etiqueta: "Hora", tipo: "select", requerido: true, opciones: [] }),
      ]),
      crear("p", { clase: "pequeno tenue", id: "aviso-dia" }),

      ajustes.pedirProfesional && (ajustes.profesionales || []).length
        ? campo({
            id: "profesional",
            etiqueta: `¿Con qué ${nombreProfesional}?`,
            tipo: "select",
            opciones: ["Me da igual"],
          })
        : null,

      // Campos propios del sector: matrícula y modelo en un taller, nada en una
      // peluquería. Se declaran en citas.camposExtra de negocio.json.
      ...(ajustes.camposExtra || []).map((c) => campo({
        id: c.id, etiqueta: c.etiqueta, tipo: c.tipo || "text",
        requerido: Boolean(c.requerido), placeholder: c.placeholder || "",
      })),

      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Tu nombre", requerido: true, autocomplete: "name" }),
        campo({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true, autocomplete: "tel" }),
      ]),
      campo({ id: "notas", etiqueta: "¿Algo que debamos saber?", tipo: "textarea" }),

      // Datos de salud y RGPD: en una clínica el "motivo" es un dato sensible.
      // El aviso lo pone el negocio en su JSON y se ve antes de enviar.
      ajustes.avisoDatos ? crear("p", { clase: "pequeno tenue", texto: ajustes.avisoDatos }) : null,

      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "submit", texto: accion }),
        config.contacto.telefono
          ? crear("a", { clase: "boton", href: "tel:" + config.contacto.telefono, texto: "Prefiero llamar" })
          : null,
      ]),
    ]);

    const selServicio = cuerpo.querySelector("#servicio");
    const selHora = cuerpo.querySelector("#hora");
    const selProfesional = cuerpo.querySelector("#profesional");
    const entradaFecha = cuerpo.querySelector("#fecha");
    const avisoDia = cuerpo.querySelector("#aviso-dia");
    const enviar = cuerpo.querySelector('button[type="submit"]');

    if (selServicio && elegido) selServicio.value = String(elegido.id);

    const servicioActual = () =>
      (selServicio ? servicioPorId(selServicio.value) : null) || elegido || null;

    // El repintado de horas es lo que hace que esto sea una agenda y no un
    // formulario: cambiar de servicio cambia los huecos que caben.
    function repintarHoras() {
      const servicio = servicioActual();
      const fecha = entradaFecha.value;
      const cerrado = estaCerrado(fecha);
      const huecos = cerrado ? [] : huecosPara(fecha, servicio);

      selHora.replaceChildren(...huecos.map((h) => crear("option", { value: h }, [document.createTextNode(h)])));

      if (cerrado) {
        const dia = DIAS[new Date(fecha + "T00:00:00").getDay()];
        avisoDia.textContent = `Ese día (${dia}) está cerrado. Elige otro.`;
      } else if (!huecos.length) {
        avisoDia.textContent = fecha === hoyISO()
          ? "Por hoy ya no quedan huecos para ese servicio. Prueba con mañana."
          : "Ese servicio no cabe en el horario de ese día. Prueba con otro día o llámanos.";
      } else {
        const dura = duracionTexto(duracionDe(servicio));
        avisoDia.textContent = `${fechaLarga(fecha)} · ${huecos.length} horas posibles${dura ? ` para ${dura}` : ""}.`;
      }
      selHora.disabled = !huecos.length;
      enviar.disabled = !huecos.length;

      if (selProfesional) {
        const posibles = profesionalesPara(servicio);
        selProfesional.replaceChildren(
          crear("option", { value: "Me da igual" }, [document.createTextNode("Me da igual")]),
          ...posibles.map((p) => crear("option", { value: p.nombre }, [document.createTextNode(p.nombre)])));
      }
    }

    entradaFecha.addEventListener("change", repintarHoras);
    selServicio?.addEventListener("change", repintarHoras);

    cuerpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const datos = valores(cuerpo);
      if (!datos.nombre || !datos.telefono) {
        return aviso("Necesitamos tu nombre y un teléfono para poder confirmarte la cita.", { error: true });
      }
      if (estaCerrado(datos.fecha)) return aviso("Ese día está cerrado.", { error: true });
      if (!datos.hora) return aviso("Elige una hora disponible.", { error: true });
      for (const extra of ajustes.camposExtra || []) {
        if (extra.requerido && !datos[extra.id]) {
          return aviso(`Falta un dato: ${extra.etiqueta}.`, { error: true });
        }
      }

      const servicio = servicioActual();
      const resultado = await almacen.guardarCita({
        ...datos,
        servicioId: servicio?.id || "",
        servicioNombre: servicio?.nombre || "",
        duracion: duracionDe(servicio),
      });
      const texto = mensajeCita({ ...datos, id: resultado.id }, servicio);

      abrirModal("Cita pedida", crear("div", {}, [
        crear("p", { html: `<strong>Referencia ${resultado.id}</strong>. ${resultado.enviado ? "Ya está en el sistema del negocio." : "Guardada en este dispositivo."}` }),
        crear("p", {
          texto: [
            servicio?.nombre,
            fechaLarga(datos.fecha),
            `a las ${datos.hora}`,
            datos.profesional && datos.profesional !== "Me da igual" ? `con ${datos.profesional}` : null,
          ].filter(Boolean).join(" · "),
        }),
        resultado.aviso ? crear("p", { clase: "aviso-demo", texto: resultado.aviso }) : null,
        crear("p", {
          clase: "pequeno tenue",
          texto: "La cita no está confirmada hasta que el negocio responde: esa hora podría estar ya cogida en su agenda. "
            + "Mándala por WhatsApp o llama para cerrarla al momento.",
        }),
        bloqueEnvio(config, { asunto: `Cita ${resultado.id} — ${config.nombre}`, mensaje: texto }),
      ]));
    });

    abrirModal(accion, cuerpo);
    repintarHoras();
  }

  return { meta: { ...meta, nombre: accion }, abrir };
}
