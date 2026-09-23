// ============================================================================
//  Módulo RESERVAS (sector restaurante)
// ----------------------------------------------------------------------------
//  Reserva con día, turno y número de comensales, respetando los días de cierre
//  y la antelación máxima que el restaurante define en negocio.json. Igual que
//  los pedidos: se guarda por la capa de datos y queda lista para WhatsApp o
//  para llamar, porque en un restaurante la reserva se cierra hablando.
// ============================================================================

import { crear, abrirModal, aviso, campo, valores, bloqueEnvio, hoyISO, sumaDias, fechaLarga } from "../js/ui.js";

export const meta = {
  id: "reservas",
  nombre: "Reservar mesa",
  modulo: "reservas",
  sector: "restaurante",
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function crearModulo(ctx) {
  const { config, almacen } = ctx;
  const ajustes = config.reservas || {};
  const cerrados = (ajustes.diasCerrado || []).map(Number);

  const estaCerrado = (iso) => {
    try { return cerrados.includes(new Date(iso + "T00:00:00").getDay()); } catch { return false; }
  };

  function mensajeReserva(r) {
    return [
      `Hola, quiero reservar mesa en ${config.nombre}.`,
      "",
      `Día: ${fechaLarga(r.fecha)}`,
      `Hora: ${r.turno}`,
      `Personas: ${r.comensales}`,
      `Nombre: ${r.nombre}`,
      `Teléfono: ${r.telefono}`,
      r.notas ? `Notas: ${r.notas}` : null,
      "",
      `Referencia: ${r.id}`,
    ].filter(Boolean).join("\n");
  }

  function abrir() {
    const maximo = sumaDias(hoyISO(), Math.max(1, Number(ajustes.antelacionDias) || 30));
    const turnos = ajustes.turnos?.length ? ajustes.turnos : ["13:30", "21:00"];
    const maxComensales = Math.max(1, Number(ajustes.maxComensales) || 10);

    const cuerpo = crear("form", { clase: "formulario", novalidate: true }, [
      ajustes.aviso ? crear("p", { clase: "aviso-demo", texto: ajustes.aviso }) : null,
      crear("div", { clase: "fila" }, [
        campo({ id: "fecha", etiqueta: "Día", tipo: "date", requerido: true, value: hoyISO(), min: hoyISO(), max: maximo }),
        campo({ id: "turno", etiqueta: "Hora", tipo: "select", requerido: true, opciones: turnos }),
        campo({
          id: "comensales", etiqueta: "Personas", tipo: "select", requerido: true,
          opciones: Array.from({ length: maxComensales }, (_, i) => String(i + 1)),
        }),
      ]),
      crear("p", { clase: "pequeno tenue", id: "aviso-dia" }),
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Tu nombre", requerido: true, autocomplete: "name" }),
        campo({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true, autocomplete: "tel" }),
      ]),
      campo({ id: "notas", etiqueta: "Trona, alergias, celebración…", tipo: "textarea" }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "submit", texto: "Pedir la reserva" }),
        config.contacto.telefono
          ? crear("a", { clase: "boton", href: "tel:" + config.contacto.telefono, texto: "Prefiero llamar" })
          : null,
      ]),
    ]);

    const entradaFecha = cuerpo.querySelector("#fecha");
    const avisoDia = cuerpo.querySelector("#aviso-dia");
    const revisarDia = () => {
      const cerrado = estaCerrado(entradaFecha.value);
      avisoDia.textContent = cerrado
        ? `Ese día (${DIAS[new Date(entradaFecha.value + "T00:00:00").getDay()]}) el restaurante cierra. Elige otro.`
        : entradaFecha.value ? fechaLarga(entradaFecha.value) : "";
      cuerpo.querySelector('button[type="submit"]').disabled = cerrado;
    };
    entradaFecha.addEventListener("change", revisarDia);

    cuerpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const datos = valores(cuerpo);
      if (!datos.nombre || !datos.telefono) return aviso("Necesitamos tu nombre y un teléfono para guardar la reserva.", { error: true });
      if (estaCerrado(datos.fecha)) return aviso("Ese día está cerrado.", { error: true });

      const resultado = await almacen.guardarReserva(datos);
      const texto = mensajeReserva({ ...datos, id: resultado.id });
      abrirModal("Reserva preparada", crear("div", {}, [
        crear("p", { html: `<strong>Referencia ${resultado.id}</strong>. ${resultado.enviado ? "Ya está en el sistema del restaurante." : "Guardada en este dispositivo."}` }),
        crear("p", { texto: `${fechaLarga(datos.fecha)} a las ${datos.turno}, ${datos.comensales} persona(s).` }),
        resultado.aviso ? crear("p", { clase: "aviso-demo", texto: resultado.aviso }) : null,
        crear("p", { clase: "pequeno tenue", texto: "La reserva no está confirmada hasta que el restaurante responde. Mándala por WhatsApp o llama para cerrarla al momento." }),
        bloqueEnvio(config, { asunto: `Reserva ${resultado.id} — ${config.nombre}`, mensaje: texto }),
      ]));
    });

    abrirModal("Reservar mesa", cuerpo);
    revisarDia();
  }

  return { meta, abrir };
}
