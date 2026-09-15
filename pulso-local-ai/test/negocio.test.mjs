// ============================================================================
//  Tema, contraste y caducidad de la demo
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contraste, contrasteInsuficiente, cumpleAA, mezclar, normalizarHex, textoSobre, variablesTema,
} from "../.test-build/lib/tema.js";
import { aSlug, diasHasta, enlaceWhatsapp, precioInmueble, telefonoInternacional } from "../.test-build/lib/formato.js";

test("la paleta por defecto y los colores razonables cumplen AA", () => {
  for (const fondo of ["#0E2A3F", "#C2A06A", "#FFFFFF", "#FFFF00", "#123456"]) {
    const texto = textoSobre(fondo);
    assert.ok(contraste(texto, fondo) >= 4.5, `${texto} sobre ${fondo} no llega a AA`);
  }
});

test("textoSobre elige siempre la mejor de las dos opciones", () => {
  for (const fondo of ["#0E2A3F", "#C2A06A", "#FF0000", "#767676", "#FFFFFF"]) {
    const elegido = textoSobre(fondo);
    const otro = elegido === "#FFFFFF" ? "#101828" : "#FFFFFF";
    assert.ok(
      contraste(elegido, fondo) >= contraste(otro, fondo),
      `sobre ${fondo} debería elegir el color de más contraste`,
    );
  }
});

test("avisa de los colores donde ni blanco ni negro llegan a AA", () => {
  // Un rojo puro se queda en ~4:1 con las dos opciones: el panel tiene que
  // decírselo al negocio en vez de dejar un botón que casi se lee.
  const rojo = contrasteInsuficiente("#FF0000");
  assert.equal(rojo.problematico, true);
  assert.ok(rojo.mejorRatio < 4.5);

  assert.equal(contrasteInsuficiente("#0E2A3F").problematico, false);
  assert.equal(contrasteInsuficiente("#C2A06A").problematico, false);
});

test("cumpleAA reconoce los pares de la paleta por defecto", () => {
  assert.equal(cumpleAA("#FFFFFF", "#0E2A3F"), true);
  assert.equal(cumpleAA("#CCCCCC", "#FFFFFF"), false);
});

test("normaliza los hexadecimales y descarta lo que no lo es", () => {
  assert.equal(normalizarHex("#abc"), "#AABBCC");
  assert.equal(normalizarHex("#AABBCC"), "#AABBCC");
  assert.equal(normalizarHex("rojo"), null);
  assert.equal(normalizarHex(undefined), null);
});

test("un tema inválido no rompe la landing: se cae a los colores por defecto", () => {
  const variables = variablesTema({ marca: "esto-no-es-un-color", acento: "#C2A06A" });
  assert.equal(variables["--marca"], "#0E2A3F");
  assert.equal(variables["--acento"], "#C2A06A");
  assert.ok(variables["--marca-contraste"]);
});

test("mezclar aclara un color sin salirse del rango", () => {
  assert.equal(mezclar("#000000", "#FFFFFF", 0.5), "#808080");
  assert.equal(mezclar("#0E2A3F", "#FFFFFF", 0), "#0E2A3F");
  assert.equal(mezclar("#0E2A3F", "#FFFFFF", 1), "#FFFFFF");
});

test("los días que quedan de demo se calculan sobre la fecha real", () => {
  const enTresDias = new Date(Date.now() + 3 * 86400000 + 60000).toISOString();
  assert.equal(diasHasta(enTresDias), 4, "redondea hacia arriba: quedan 3 días y pico");

  const ayer = new Date(Date.now() - 86400000).toISOString();
  assert.ok(diasHasta(ayer) <= 0, "una demo vencida no puede dar días positivos");
  assert.equal(diasHasta(null), null);
});

test("el teléfono se convierte a formato internacional para WhatsApp", () => {
  assert.equal(telefonoInternacional("689 929 926"), "34689929926");
  assert.equal(telefonoInternacional("+34 689 929 926"), "34689929926");
  assert.equal(telefonoInternacional("0034689929926"), "34689929926");
  assert.equal(telefonoInternacional(null), null);
});

test("el enlace de WhatsApp lleva el mensaje codificado", () => {
  const enlace = enlaceWhatsapp("689929926", "Hola, ¿sigue disponible?");
  assert.match(enlace, /^https:\/\/wa\.me\/34689929926\?text=/);
  assert.match(enlace, /%C2%BFsigue/);
  assert.equal(enlaceWhatsapp(null, "hola"), null);
});

test("el precio se lee distinto en venta y en alquiler", () => {
  assert.match(precioInmueble({ price: 189000, price_on_request: false, operation_type: "venta" }), /189\.000/);
  assert.match(precioInmueble({ price: 780, price_on_request: false, operation_type: "alquiler" }), /\/mes$/);
  assert.equal(
    precioInmueble({ price: null, price_on_request: true, operation_type: "venta" }),
    "Precio a consultar",
  );
});

test("los slugs salen limpios de tildes, mayúsculas y símbolos", () => {
  assert.equal(aSlug("Ático con terraza en Oviedo"), "atico-con-terraza-en-oviedo");
  assert.equal(aSlug("  ¡Piso!! en   Gijón  "), "piso-en-gijon");
  assert.ok(aSlug("x".repeat(200)).length <= 60);
});
