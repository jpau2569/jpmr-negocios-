// ============================================================================
//  Validación de los formularios públicos
// ----------------------------------------------------------------------------
//  Son los mismos esquemas que usa el servidor. Si alguno dejara de exigir el
//  consentimiento, aquí se ve antes de que llegue a producción.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esquemaBusqueda, esquemaContacto, esquemaOpinion, esquemaValoracion, esquemaVisita,
} from "../.test-build/lib/validaciones/formularios.js";
import { esBot, sanear } from "../.test-build/lib/validaciones/comunes.js";

const BASE = { businessSlug: "asesoria-castresana", consent: true };

test("un contacto válido pasa y se queda con los datos limpios", () => {
  const r = esquemaContacto.safeParse({
    ...BASE,
    tipo: "seller",
    nombre: "  María López  ",
    telefono: "689 92 99 26",
    email: "",
    mensaje: "Quiero vender el piso.",
  });
  assert.equal(r.success, true);
  assert.equal(r.data.nombre, "María López");
  assert.equal(r.data.email, undefined, "un email vacío no debe guardarse como cadena vacía");
});

test("sin consentimiento no hay lead, en ningún formulario", () => {
  const sinConsentimiento = { ...BASE, consent: false };

  assert.equal(
    esquemaContacto.safeParse({ ...sinConsentimiento, tipo: "buyer", nombre: "Ana", telefono: "600000000" }).success,
    false,
  );
  assert.equal(
    esquemaVisita.safeParse({ ...sinConsentimiento, nombre: "Ana", telefono: "600000000" }).success,
    false,
  );
  assert.equal(
    esquemaValoracion.safeParse({
      ...sinConsentimiento,
      tipoInmueble: "piso",
      objetivo: "venta",
      municipio: "Oviedo",
      nombre: "Ana",
      telefono: "600000000",
    }).success,
    false,
  );
  assert.equal(
    esquemaBusqueda.safeParse({ ...sinConsentimiento, operacion: "venta", nombre: "Ana", telefono: "600000000" })
      .success,
    false,
  );
});

test("rechaza teléfonos que no lo son", () => {
  for (const telefono of ["", "123", "no tengo", "60000"]) {
    const r = esquemaContacto.safeParse({ ...BASE, tipo: "buyer", nombre: "Ana", telefono });
    assert.equal(r.success, false, `debería rechazar "${telefono}"`);
  }
});

test("acepta el teléfono escrito como lo escribe la gente", () => {
  for (const telefono of ["689929926", "689 92 99 26", "+34 689 929 926", "985210468"]) {
    const r = esquemaContacto.safeParse({ ...BASE, tipo: "buyer", nombre: "Ana", telefono });
    assert.equal(r.success, true, `debería aceptar "${telefono}"`);
  }
});

test("la valoración exige municipio y tipo de inmueble", () => {
  const incompleta = esquemaValoracion.safeParse({
    ...BASE,
    tipoInmueble: "piso",
    objetivo: "venta",
    municipio: "",
    nombre: "Ana",
    telefono: "600000000",
  });
  assert.equal(incompleta.success, false);

  const completa = esquemaValoracion.safeParse({
    ...BASE,
    tipoInmueble: "atico",
    objetivo: "herencia",
    municipio: "Oviedo",
    metros: "95",
    nombre: "Ana",
    telefono: "600000000",
  });
  assert.equal(completa.success, true);
  assert.equal(completa.data.metros, 95, "los metros llegan como texto del formulario y deben quedar en número");
});

test("una opinión anónima no exige datos personales", () => {
  const r = esquemaOpinion.safeParse({
    businessSlug: "asesoria-castresana",
    puntuacion: 5,
    comentario: "Todo perfecto.",
    quiereContacto: false,
  });
  assert.equal(r.success, true);
});

test("si la opinión pide contacto, entonces sí exige datos y consentimiento", () => {
  const sinDatos = esquemaOpinion.safeParse({
    businessSlug: "asesoria-castresana",
    puntuacion: 2,
    quiereContacto: true,
    consent: true,
  });
  assert.equal(sinDatos.success, false, "pedir contacto sin teléfono ni correo no tiene sentido");

  const sinConsentimiento = esquemaOpinion.safeParse({
    businessSlug: "asesoria-castresana",
    puntuacion: 2,
    quiereContacto: true,
    telefono: "600000000",
  });
  assert.equal(sinConsentimiento.success, false);

  const correcta = esquemaOpinion.safeParse({
    businessSlug: "asesoria-castresana",
    puntuacion: 2,
    quiereContacto: true,
    telefono: "600000000",
    consent: true,
  });
  assert.equal(correcta.success, true);
});

test("la puntuación vive entre 1 y 5", () => {
  for (const puntuacion of [0, 6, -1]) {
    assert.equal(esquemaOpinion.safeParse({ businessSlug: "x", puntuacion }).success, false);
  }
});

test("el honeypot distingue a un bot de una persona", () => {
  assert.equal(esBot(undefined), false);
  assert.equal(esBot(""), false);
  assert.equal(esBot("   "), false);
  assert.equal(esBot("https://spam.example"), true);
});

test("el saneado quita etiquetas y caracteres de control", () => {
  assert.equal(sanear("<b>Hola</b>   mundo"), "Hola mundo");
  assert.equal(sanear("<script>alert(1)</script>"), "alert(1)");
  assert.equal(sanear("  "), null);
  assert.equal(sanear(null), null);
});

test("los textos largos se rechazan en vez de recortarse a lo bruto", () => {
  const r = esquemaContacto.safeParse({
    ...BASE,
    tipo: "buyer",
    nombre: "Ana",
    telefono: "600000000",
    mensaje: "x".repeat(1500),
  });
  assert.equal(r.success, false);
});
