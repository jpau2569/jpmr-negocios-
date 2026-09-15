// ============================================================================
//  Asistente: qué responde y, sobre todo, qué NO responde
// ----------------------------------------------------------------------------
//  El valor de este asistente está en sus límites. Si alguna vez contesta a una
//  pregunta fiscal en vez de derivarla a una persona, el problema no es un bug
//  de interfaz: es un problema para la asesoría.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { MENSAJE_DERIVACION, buscarRespuesta, requiereProfesional } from "../.test-build/lib/asistente.js";

const FUENTE = {
  entradas: [
    {
      id: "e1",
      title: "Dónde estamos",
      body: "La oficina está en la Calle Cabo Noval, 8 Bajo 2, 33007 Oviedo.",
      keywords: ["direccion", "donde", "oficina", "llegar"],
    },
    {
      id: "e2",
      title: "Cómo pedir una visita",
      body: "Desde la ficha del inmueble, con el botón «Solicitar visita».",
      keywords: ["visita", "ver el piso", "cita inmueble"],
    },
  ],
  faqs: [
    { id: "f1", question: "¿Cómo pido una valoración?", answer: "Rellena el formulario y te llamamos." },
  ],
};

test("deriva a una persona las preguntas legales, fiscales y laborales", () => {
  const preguntas = [
    "¿Cuánto IRPF pago si vendo el piso de mi madre?",
    "¿Me conviene aceptar la herencia?",
    "¿Qué indemnización me corresponde por despido?",
    "¿Qué plusvalía municipal tendré que pagar?",
    "¿Qué interés me van a poner en la hipoteca?",
    "¿Puedo poner una demanda por esta cláusula?",
  ];

  for (const pregunta of preguntas) {
    assert.equal(requiereProfesional(pregunta), true, `debería derivar: ${pregunta}`);
  }
});

test("no deriva las preguntas operativas normales", () => {
  const preguntas = ["¿Dónde está la oficina?", "¿Cómo pido una visita?", "¿Qué horario tenéis?"];
  for (const pregunta of preguntas) {
    assert.equal(requiereProfesional(pregunta), false, `no debería derivar: ${pregunta}`);
  }
});

test("nunca promete un precio ni una tasación automática", () => {
  assert.equal(requiereProfesional("¿Cuánto vale mi casa?"), true);
  assert.equal(requiereProfesional("Valórame el piso"), true);
});

test("responde con la base aprobada cuando encuentra coincidencia", () => {
  const respuesta = buscarRespuesta("¿dónde está vuestra oficina?", FUENTE);
  assert.ok(respuesta, "debería encontrar la entrada de dirección");
  assert.match(respuesta.texto, /Cabo Noval/);
  assert.equal(respuesta.origen, "conocimiento");
});

test("también busca en las FAQs publicadas", () => {
  const respuesta = buscarRespuesta("cómo pido una valoración", FUENTE);
  assert.ok(respuesta);
  assert.equal(respuesta.origen, "faq");
});

test("si no hay material aprobado, prefiere derivar antes que improvisar", () => {
  assert.equal(buscarRespuesta("¿tenéis piscina climatizada en el edificio?", FUENTE), null);
  assert.equal(buscarRespuesta("", FUENTE), null);
  assert.equal(buscarRespuesta("hola", { entradas: [], faqs: [] }), null);
});

test("el mensaje de derivación nombra al negocio y ofrece cita o WhatsApp", () => {
  const mensaje = MENSAJE_DERIVACION("Asesoría Castresana");
  assert.match(mensaje, /Asesoría Castresana/);
  assert.match(mensaje, /cita/);
  assert.match(mensaje, /WhatsApp/);
});
