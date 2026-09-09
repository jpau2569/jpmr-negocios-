// ============================================================================
//  Módulo VALORACIÓN GRATIS (sector inmobiliaria)
// ----------------------------------------------------------------------------
//  Es la puerta de captación: el propietario pide saber cuánto vale su casa y
//  la inmobiliaria consigue el contacto y la dirección.
//
//  Sobre el rango orientativo: SOLO se calcula si el cliente ha metido en
//  negocio.json sus propios precios por m² y zona (valoracion.preciosZona).
//  Sin esos datos no se inventa ninguna cifra: se recoge el contacto y se dice
//  la verdad — que el rango lo da la agencia tras mirar la vivienda.
// ============================================================================

import { crear, euros, abrirModal, aviso, campo, valores, bloqueEnvio } from "../js/ui.js";

export const meta = {
  id: "valoracion",
  nombre: "Valoración gratis",
  modulo: "valoracionGratis",
  sector: "inmobiliaria",
};

const ESTADOS = [
  { valor: "reformado", texto: "Reformado o a estrenar", factor: 1.1 },
  { valor: "bien", texto: "Bien conservado", factor: 1 },
  { valor: "actualizar", texto: "Para actualizar", factor: 0.9 },
  { valor: "reformar", texto: "Para reformar entero", factor: 0.78 },
];

// Rango a partir de los precios por m² que haya cargado la agencia.
export function calcularRango({ zona, metros, estado }, preciosZona = []) {
  const ficha = preciosZona.find((p) => p.zona === zona);
  const m = Number(metros);
  if (!ficha || !m || m <= 0) return null;
  const factor = ESTADOS.find((e) => e.valor === estado)?.factor ?? 1;
  const min = Math.round((Number(ficha.minM2) || 0) * m * factor / 500) * 500;
  const max = Math.round((Number(ficha.maxM2) || 0) * m * factor / 500) * 500;
  return min > 0 && max >= min ? { min, max, zona, metros: m } : null;
}

export function crearModulo(ctx) {
  const { config, almacen } = ctx;
  const ajustes = config.valoracion || {};
  const precios = ajustes.preciosZona || [];

  function abrir() {
    const zonas = precios.map((p) => p.zona);
    const cuerpo = crear("form", { clase: "formulario", novalidate: true }, [
      ajustes.texto ? crear("p", { texto: ajustes.texto }) : null,
      crear("div", { clase: "fila" }, [
        zonas.length
          ? campo({ id: "zona", etiqueta: "Zona", tipo: "select", requerido: true, opciones: zonas })
          : campo({ id: "zona", etiqueta: "Zona o barrio", requerido: true, placeholder: "Oviedo centro, Mieres…" }),
        campo({ id: "metros", etiqueta: "Metros construidos", tipo: "number", min: 10, max: 1000, requerido: true }),
      ]),
      crear("div", { clase: "fila" }, [
        campo({ id: "habitaciones", etiqueta: "Habitaciones", tipo: "number", min: 0, max: 20 }),
        campo({ id: "estado", etiqueta: "Estado", tipo: "select", opciones: ESTADOS.map((e) => ({ valor: e.valor, texto: e.texto })) }),
      ]),
      ajustes.preguntarDireccion ? campo({ id: "direccion", etiqueta: "Dirección (no se publica)", placeholder: "Calle y número" }) : null,
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Tu nombre", requerido: true, autocomplete: "name" }),
        campo({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", autocomplete: "tel" }),
      ]),
      campo({ id: "email", etiqueta: "Correo", tipo: "email", autocomplete: "email" }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "submit", texto: "Quiero mi valoración" }),
      ]),
      crear("p", { clase: "pequeno tenue", texto: "Sin compromiso y sin exclusiva: valorar no es vender." }),
    ]);

    cuerpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const datos = valores(cuerpo);
      if (!datos.nombre) return aviso("Necesitamos tu nombre.", { error: true });
      if (!datos.telefono && !datos.email) return aviso("Déjanos un teléfono o un correo para darte la valoración.", { error: true });

      const rango = calcularRango(datos, precios);
      const resultado = await almacen.guardarLead({ ...datos, tipo: "valoracion", origen: `escaparate3d-pro:${config.id}` });
      const mensaje = [
        `Hola, quiero una valoración de mi vivienda (${config.nombre}).`,
        "",
        `Zona: ${datos.zona}`,
        `Metros: ${datos.metros}`,
        datos.habitaciones ? `Habitaciones: ${datos.habitaciones}` : null,
        `Estado: ${ESTADOS.find((e) => e.valor === datos.estado)?.texto || datos.estado}`,
        datos.direccion ? `Dirección: ${datos.direccion}` : null,
        "",
        `Nombre: ${datos.nombre}`,
        datos.telefono ? `Teléfono: ${datos.telefono}` : null,
        datos.email ? `Correo: ${datos.email}` : null,
        "",
        `Referencia: ${resultado.id}`,
      ].filter(Boolean).join("\n");

      abrirModal("Valoración en marcha", crear("div", {}, [
        rango
          ? crear("p", { html: `Rango orientativo con los precios por m² de la agencia en <strong>${rango.zona}</strong>:<br><strong style="font-size:1.3rem">${euros(rango.min)} – ${euros(rango.max)}</strong>` })
          : crear("p", { texto: "El rango exacto te lo damos nosotros: depende de la altura, la orientación, el ascensor y de lo que se esté cerrando de verdad en tu calle. No queremos darte un número inventado por una máquina." }),
        rango ? crear("p", { clase: "pequeno tenue", texto: "Es una horquilla orientativa calculada con los precios que maneja la agencia, no una tasación." }) : null,
        crear("p", { html: `<strong>Referencia ${resultado.id}</strong>. ${resultado.enviado ? "Ya tenemos tus datos." : "Guardado en este dispositivo."}` }),
        resultado.aviso ? crear("p", { clase: "aviso-demo", texto: resultado.aviso }) : null,
        bloqueEnvio(config, { asunto: `Valoración ${resultado.id} — ${config.nombre}`, mensaje }),
      ]));
    });

    abrirModal(ajustes.titulo || "Valoración gratis", cuerpo);
  }

  return { meta, abrir };
}
