// ============================================================================
//  Módulo QR DE MESAS (sector restaurante)
// ----------------------------------------------------------------------------
//  Genera un QR por mesa que abre la carta de este mismo escaparate con la mesa
//  ya identificada (?mesa=7). Se imprime en una hoja y se pega en la mesa: el
//  cliente escanea, ve la carta y —si el módulo está activo— pide sin levantarse.
//  El generador de QR es propio (js/qr.js): no depende de ninguna librería ni
//  de un servicio externo, así que funciona aunque el local no tenga internet.
// ============================================================================

import { crear, vaciar, abrirModal, aviso } from "../js/ui.js";
import { svg as qrSvg } from "../js/qr.js";

export const meta = {
  id: "qr",
  nombre: "QR de las mesas",
  modulo: "qrMesas",
  sector: "restaurante",
  soloDueno: true,
};

export function crearModulo(ctx) {
  const { config } = ctx;
  const ajustes = config.qr || {};

  // URL de la mesa: la propia página, con el negocio y la mesa en la dirección.
  function urlMesa(numero, base = location.href) {
    const url = new URL(base);
    url.hash = "";
    url.searchParams.set("mesa", String(numero));
    if (config.id) url.searchParams.set("negocio", config.id);
    url.hash = ajustes.destino === "pedido" ? "#pedido" : "#carta";
    return url.href;
  }

  function abrir() {
    const total = Math.max(0, Number(ajustes.mesas) || 0);
    if (!total) {
      aviso("Indica cuántas mesas tiene el local en negocio.json (qr.mesas).", { error: true });
      return;
    }

    const rejilla = crear("div", { clase: "rejilla-qr" });
    const prefijo = ajustes.prefijoMesa || "Mesa";
    for (let i = 1; i <= total; i++) {
      const enlace = urlMesa(i);
      rejilla.append(crear("div", { clase: "tarjeta-qr" }, [
        crear("div", { html: qrSvg(enlace, { nivel: "M", margen: 2 }) }),
        crear("strong", { texto: `${prefijo} ${i}` }),
        crear("span", { clase: "pequeno", texto: config.nombre }),
      ]));
    }

    abrirModal("QR de las mesas", crear("div", {}, [
      crear("p", { clase: "pequeno tenue", texto: "Imprime esta hoja y pega un QR en cada mesa. Al escanearlo se abre la carta con la mesa ya identificada." }),
      crear("div", { clase: "botonera no-imprimir" }, [
        crear("button", { clase: "boton principal", type: "button", texto: "Imprimir", onclick: () => window.print() }),
        crear("button", {
          clase: "boton", type: "button", texto: "Copiar los enlaces",
          onclick: async () => {
            const lineas = Array.from({ length: total }, (_, i) => `${prefijo} ${i + 1}: ${urlMesa(i + 1)}`);
            try { await navigator.clipboard.writeText(lineas.join("\n")); aviso("Enlaces copiados."); }
            catch { aviso("Tu navegador no deja copiar automáticamente.", { error: true }); }
          },
        }),
      ]),
      rejilla,
    ]));
  }

  return { meta, abrir, urlMesa };
}
