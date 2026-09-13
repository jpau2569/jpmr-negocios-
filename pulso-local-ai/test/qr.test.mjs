// ============================================================================
//  QR y carteles
// ----------------------------------------------------------------------------
//  Un QR mal generado no se detecta hasta que alguien imprime 200 carteles y
//  ninguno funciona. Estos tests comparan módulo a módulo con el generador ya
//  verificado del monorepo y comprueban las reglas propias del panel.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { matriz as matrizLocal } from "../src/lib/qr/qr.mjs";
import { matriz as matrizMonorepo } from "../../fotos-faciles/nucleo/qr.mjs";
import { cartelSvg, qrSvg, validarContrasteQr } from "../.test-build/lib/qr/index.js";

const URLS = [
  "https://pulso.local/q/castresana",
  "https://pulso.local/q/castresana-demo-001",
  "https://ejemplo.test/b/asesoria-castresana/valoracion?utm_source=qr",
];

test("genera la misma matriz que el generador del monorepo", () => {
  for (const url of URLS) {
    for (const nivel of ["L", "M", "Q", "H"]) {
      const local = matrizLocal(url, { nivel });
      const referencia = matrizMonorepo(url, { nivel });
      assert.equal(local.tamano, referencia.tamano, `tamaño distinto en ${url} nivel ${nivel}`);
      assert.deepEqual(local.modulos, referencia.modulos, `módulos distintos en ${url} nivel ${nivel}`);
    }
  }
});

test("el SVG lleva el viewBox del tamaño real y los colores pedidos", () => {
  const svg = qrSvg(URLS[0], { colorOscuro: "#123456", colorClaro: "#FEDCBA", nivel: "Q" });
  const { tamano } = matrizLocal(URLS[0], { nivel: "Q" });
  assert.match(svg, new RegExp(`viewBox="0 0 ${tamano + 4} ${tamano + 4}"`));
  assert.match(svg, /#123456/);
  assert.match(svg, /#FEDCBA/);
});

test("con logo sube a corrección H para que el código siga leyéndose", () => {
  const conLogo = qrSvg(URLS[0], { logoUrl: "https://ejemplo.test/logo.png" });
  const sinLogo = qrSvg(URLS[0], { nivel: "Q" });
  const ladoConLogo = Number(conLogo.match(/viewBox="0 0 (\d+)/)[1]);
  const ladoSinLogo = Number(sinLogo.match(/viewBox="0 0 (\d+)/)[1]);
  assert.ok(ladoConLogo >= ladoSinLogo, "el nivel H debe necesitar al menos tantos módulos");
  assert.match(conLogo, /<image /);
});

test("el logo se escapa: una URL con comillas no puede romper el SVG", () => {
  const svg = qrSvg(URLS[0], { logoUrl: 'https://ejemplo.test/a.png"/><script>alert(1)</script>' });
  assert.ok(!svg.includes("<script>"), "no debe colarse una etiqueta script");
  assert.match(svg, /&quot;/);
});

test("rechaza combinaciones de color ilegibles y acepta las buenas", () => {
  const malo = validarContrasteQr("#CCCCCC", "#FFFFFF");
  assert.equal(malo.valido, false);
  assert.ok(malo.aviso);

  const justo = validarContrasteQr("#767676", "#FFFFFF");
  assert.equal(justo.valido, true);
  assert.ok(justo.aviso, "entre 3:1 y 7:1 debe avisar aunque sea válido");

  const bueno = validarContrasteQr("#0E2A3F", "#FFFFFF");
  assert.equal(bueno.valido, true);
  assert.equal(bueno.aviso, undefined);
});

test("los carteles salen en milímetros reales, no en píxeles", () => {
  const medidas = { A4: [210, 297], A5: [148, 210], tarjeta: [85, 55], escaparate: [210, 210] };

  for (const [formato, [ancho, alto]] of Object.entries(medidas)) {
    const svg = cartelSvg({
      titulo: "¿Cuánto vale tu casa?",
      negocio: "Asesoría Castresana",
      url: URLS[0],
      formato,
    });
    assert.match(svg, new RegExp(`width="${ancho}mm"`), `${formato}: ancho incorrecto`);
    assert.match(svg, new RegExp(`height="${alto}mm"`), `${formato}: alto incorrecto`);
    assert.match(svg, /Asesoría Castresana/);
  }
});

test("el cartel escapa el texto que escribe el usuario", () => {
  const svg = cartelSvg({
    titulo: '<script>alert("x")</script>',
    negocio: "Mi & Negocio",
    url: URLS[0],
    formato: "A5",
  });
  assert.ok(!svg.includes("<script>"));
  assert.match(svg, /Mi &amp; Negocio/);
});
