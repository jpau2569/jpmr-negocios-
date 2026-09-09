// ============================================================================
//  Módulo PEDIDOS A DOMICILIO / PARA RECOGER (sector restaurante)
// ----------------------------------------------------------------------------
//  Un pedido de verdad: carrito con cantidades, zona de reparto con su coste y
//  su mínimo, datos del cliente, forma de pago y confirmación. El pedido se
//  guarda por la capa de datos (local / API / Firebase) y además queda listo
//  para mandar por WhatsApp, que es como lo trabajan de verdad los locales.
// ============================================================================

import { crear, vaciar, euros, abrirModal, cerrarModal, aviso, campo, valores, bloqueEnvio } from "../js/ui.js";

export const meta = {
  id: "pedidos",
  nombre: "Pedir a domicilio",
  modulo: "pedidosDomicilio",
  sector: "restaurante",
};

export function crearModulo(ctx) {
  const { config, carrito, almacen } = ctx;
  const ajustes = config.pedidos || {};
  const zonas = ajustes.zonasReparto || [];
  const dinero = (n) => euros(n, { decimales: n % 1 ? 2 : 0 });

  // La entrega elegida decide coste y pedido mínimo.
  function entregaDe(clave) {
    if (clave === "mesa") return { tipo: "mesa", nombre: `${config.qr?.prefijoMesa || "Mesa"} ${ctx.mesa}`, coste: 0, minimo: 0 };
    if (clave === "recogida") return { tipo: "recogida", nombre: "Recojo en el local", coste: 0, minimo: 0 };
    const zona = zonas[Number(clave)] || zonas[0];
    return zona
      ? { tipo: "reparto", nombre: zona.nombre, coste: Number(zona.coste) || 0, minimo: Number(zona.minimo) || Number(ajustes.pedidoMinimo) || 0 }
      : { tipo: "reparto", nombre: "A domicilio", coste: 0, minimo: Number(ajustes.pedidoMinimo) || 0 };
  }

  function mensajePedido(pedido) {
    const lineas = pedido.lineas.map((l) => ` · ${l.cantidad} × ${l.nombre} — ${dinero(l.cantidad * l.precio)}`);
    return [
      `Hola, quiero hacer un pedido en ${config.nombre}.`,
      "",
      ...lineas,
      "",
      pedido.entrega.tipo === "mesa" ? `Servir en la ${pedido.entrega.nombre}`
        : pedido.entrega.tipo === "recogida" ? "Recojo en el local"
        : "Reparto a " + pedido.entrega.nombre,
      pedido.entrega.coste ? `Gastos de reparto: ${dinero(pedido.entrega.coste)}` : null,
      `TOTAL: ${dinero(pedido.total)}`,
      "",
      `Nombre: ${pedido.nombre}`,
      `Teléfono: ${pedido.telefono}`,
      pedido.direccion ? `Dirección: ${pedido.direccion}` : null,
      pedido.hora ? `Hora deseada: ${pedido.hora}` : null,
      pedido.pago ? `Pago: ${pedido.pago}` : null,
      pedido.notas ? `Notas: ${pedido.notas}` : null,
      "",
      `Referencia: ${pedido.id}`,
    ].filter(Boolean).join("\n");
  }

  function abrir() {
    if (carrito.vacio()) {
      aviso("Añade algún plato de la carta antes de hacer el pedido.");
      ctx.abrirModulo("carta");
      return;
    }

    const cuerpo = crear("form", { clase: "formulario", novalidate: true });
    const listaNodo = crear("ul", { clase: "lista-lineas" });
    const totalNodo = crear("div", { clase: "total" });
    const avisoMinimo = crear("p", { clase: "pequeno tenue" });

    const selectorEntrega = crear("select", { id: "entrega", name: "entrega" }, [
      // Si se ha entrado por el QR de una mesa, esa es la opción por defecto.
      ...(ctx.mesa ? [crear("option", { value: "mesa" }, [document.createTextNode(`Servir en la ${config.qr?.prefijoMesa || "Mesa"} ${ctx.mesa}`)])] : []),
      ...(ajustes.recogidaEnLocal ? [crear("option", { value: "recogida" }, [document.createTextNode("Recojo yo en el local (sin coste)")])] : []),
      ...zonas.map((z, i) => crear("option", { value: String(i) }, [
        document.createTextNode(`${z.nombre} — reparto ${z.coste ? dinero(z.coste) : "gratis"}${z.minimo ? `, mínimo ${dinero(z.minimo)}` : ""}`),
      ])),
    ]);

    const campoDireccion = campo({ id: "direccion", etiqueta: "Dirección de entrega", requerido: false, placeholder: "Calle, número, piso" });

    function pintar() {
      vaciar(listaNodo);
      for (const linea of carrito.lineas()) {
        listaNodo.append(crear("li", {}, [
          crear("span", { clase: "crece", texto: linea.nombre }),
          crear("span", { clase: "contador-cantidad" }, [
            crear("button", { clase: "boton chico", type: "button", texto: "−", "aria-label": `Quitar una unidad de ${linea.nombre}`, onclick: () => { carrito.fijar(linea.id, linea.cantidad - 1); pintar(); } }),
            crear("strong", { texto: String(linea.cantidad) }),
            crear("button", { clase: "boton chico", type: "button", texto: "+", "aria-label": `Añadir una unidad de ${linea.nombre}`, onclick: () => { carrito.fijar(linea.id, linea.cantidad + 1); pintar(); } }),
          ]),
          crear("strong", { texto: dinero(linea.cantidad * linea.precio) }),
        ]));
      }
      const entrega = entregaDe(selectorEntrega.value);
      const subtotal = carrito.total();
      const total = subtotal + entrega.coste;
      vaciar(totalNodo).append(
        crear("span", { texto: entrega.coste ? `Total (con ${dinero(entrega.coste)} de reparto)` : "Total" }),
        crear("span", { texto: dinero(total) })
      );
      campoDireccion.hidden = entrega.tipo !== "reparto";
      campoDireccion.querySelector("input").required = entrega.tipo === "reparto";
      const falta = entrega.minimo - subtotal;
      avisoMinimo.textContent = falta > 0
        ? `Para ${entrega.nombre} el pedido mínimo es ${dinero(entrega.minimo)}: te faltan ${dinero(falta)}.`
        : "";
      cuerpo.querySelector("#confirmar").disabled = falta > 0 || carrito.vacio();
      if (carrito.vacio()) { cerrarModal(); aviso("Pedido vacío."); }
    }

    selectorEntrega.addEventListener("change", pintar);

    cuerpo.append(
      listaNodo,
      totalNodo,
      crear("label", { clase: "campo", for: "entrega" }, [crear("span", { texto: "¿Cómo lo quieres? *" }), selectorEntrega]),
      avisoMinimo,
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Tu nombre", requerido: true, autocomplete: "name" }),
        campo({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", requerido: true, autocomplete: "tel" }),
      ]),
      campoDireccion,
      crear("div", { clase: "fila" }, [
        campo({ id: "hora", etiqueta: "Hora deseada", tipo: "time" }),
        ajustes.formasPago?.length
          ? campo({ id: "pago", etiqueta: "Forma de pago", tipo: "select", opciones: ajustes.formasPago })
          : null,
      ]),
      campo({ id: "notas", etiqueta: "Alergias, cambios o indicaciones", tipo: "textarea" }),
      ajustes.avisoLegal ? crear("p", { clase: "pequeno tenue", texto: ajustes.avisoLegal }) : null,
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "submit", id: "confirmar", texto: "Confirmar pedido" }),
        crear("button", { clase: "boton plano", type: "button", texto: "Vaciar", onclick: () => { carrito.vaciar(); pintar(); } }),
      ])
    );

    cuerpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const datos = valores(cuerpo);
      const entrega = entregaDe(datos.entrega);
      if (!datos.nombre || !datos.telefono) return aviso("Necesitamos tu nombre y un teléfono para confirmar el pedido.", { error: true });
      if (entrega.tipo === "reparto" && !datos.direccion) return aviso("Falta la dirección de entrega.", { error: true });

      const lineas = carrito.lineas();
      const total = carrito.total() + entrega.coste;
      const resultado = await almacen.guardarPedido({ ...datos, mesa: ctx.mesa || null, entrega, lineas, subtotal: carrito.total(), total });
      const pedido = { ...resultado.registro, lineas, entrega, total, id: resultado.id };
      const texto = mensajePedido(pedido);
      carrito.vaciar();

      abrirModal("Pedido preparado", crear("div", {}, [
        crear("p", { html: `<strong>Referencia ${resultado.id}</strong>. ${resultado.enviado ? "Ya ha entrado en el sistema del restaurante." : "Guardado en este dispositivo."}` }),
        resultado.aviso ? crear("p", { clase: "aviso-demo", texto: resultado.aviso }) : null,
        crear("p", { clase: "pequeno tenue", texto: "Mándalo también por WhatsApp o llama: así el restaurante lo ve al momento y te confirma la hora." }),
        bloqueEnvio(config, { asunto: `Pedido ${resultado.id} — ${config.nombre}`, mensaje: texto }),
      ]));
    });

    abrirModal("Tu pedido", cuerpo);
    pintar();
  }

  return { meta, abrir, insignia: () => carrito.unidades() || "" };
}
