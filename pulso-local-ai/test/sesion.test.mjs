// ============================================================================
//  PULSO LOCAL AI — acceso al panel
// ----------------------------------------------------------------------------
//  El panel lee con service_role, que salta RLS: aquí la base ya no protege
//  nada. Si este control falla, quedan expuestos teléfonos y reservas de
//  clientes reales. Por eso se prueba, y por eso se prueba el caso más
//  peligroso: el despliegue al que se le olvidó poner la clave.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let cache = null;
async function cargar() {
  if (cache) return cache;
  const salida = mkdtempSync(join(RAIZ, ".test-build-"));
  const config = join(salida, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    extends: resolve(RAIZ, "tsconfig.json"),
    compilerOptions: {
      noEmit: false, outDir: salida, rootDir: RAIZ,
      module: "esnext", target: "es2022", incremental: false,
    },
    include: [],
    files: [resolve(RAIZ, "lib/sesion.ts")],
  }));
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", "--project", config], { cwd: RAIZ, stdio: "pipe" });
  cache = await import(pathToFileURL(join(salida, "lib", "sesion.js")).href);
  return cache;
}

const CLAVE = "una-clave-larga-de-verdad";
const SECRETO = "un-secreto-de-treinta-y-dos-caracteres-o-mas";

test("FALLO SEGURO: sin configurar, el panel se CIERRA (no se abre)", async () => {
  const { modoAcceso } = await cargar();
  // El accidente que este test evita: desplegar sin variables y dejar los
  // datos de los clientes abiertos a quien pase por la URL.
  const vacio = modoAcceso({});
  assert.equal(vacio.abierto, false);
  assert.equal(vacio.modo, "cerrado");
  assert.match(vacio.motivo, /No hay forma de acceso/);
});

test("una clave corta no vale: da falsa seguridad", async () => {
  const { modoAcceso } = await cargar();
  const corta = modoAcceso({ PANEL_CLAVE: "1234", PANEL_SECRETO: SECRETO });
  assert.equal(corta.abierto, false);
  assert.match(corta.motivo, /demasiado corta/);
});

test("un secreto de firma corto tampoco vale", async () => {
  const { modoAcceso } = await cargar();
  const flojo = modoAcceso({ PANEL_CLAVE: CLAVE, PANEL_SECRETO: "corto" });
  assert.equal(flojo.abierto, false);
  assert.match(flojo.motivo, /PANEL_SECRETO/);
});

test("con clave y secreto buenos, el panel abre", async () => {
  const { modoAcceso } = await cargar();
  const ok = modoAcceso({ PANEL_CLAVE: CLAVE, PANEL_SECRETO: SECRETO });
  assert.equal(ok.abierto, true);
  assert.equal(ok.modo, "clave");
});

test("una cookie firmada de verdad se acepta", async () => {
  const { crearCookie, cookieValida } = await cargar();
  const cookie = await crearCookie(SECRETO);
  assert.equal(await cookieValida(cookie, SECRETO), true);
});

test("una cookie fabricada a mano NO se acepta", async () => {
  const { cookieValida } = await cargar();
  const dentroDeUnAno = Math.floor(Date.now() / 1000) + 31536000;
  for (const falsa of [
    `${dentroDeUnAno}.firmainventada`,
    `${dentroDeUnAno}.`,
    "9999999999",
    "",
    "basura",
    // Lo que probaría alguien listo: reutilizar la firma cambiando la fecha.
    `${dentroDeUnAno}.${(await cookieValida("x", SECRETO)) || "abc"}`,
  ]) {
    assert.equal(await cookieValida(falsa, SECRETO), false, `ha colado: "${falsa}"`);
  }
});

test("una cookie de otro secreto NO se acepta", async () => {
  const { crearCookie, cookieValida } = await cargar();
  // Si alguien copiara la cookie de otro despliegue, no le vale.
  const ajena = await crearCookie("otro-secreto-completamente-distinto-aqui");
  assert.equal(await cookieValida(ajena, SECRETO), false);
});

test("una cookie caducada NO se acepta", async () => {
  const { crearCookie, cookieValida } = await cargar();
  const hace9h = Date.now() - 9 * 60 * 60 * 1000;
  const vieja = await crearCookie(SECRETO, hace9h);
  assert.equal(await cookieValida(vieja, SECRETO), false);
});

test("el middleware protege el panel y NO lo público", () => {
  const mw = readFileSync(resolve(RAIZ, "middleware.ts"), "utf8");
  assert.match(mw, /"\/dashboard\/:path\*"/, "debe proteger /dashboard");
  assert.ok(!/\/b\/:path/.test(mw), "lo público NO debe pasar por el middleware");
});

test("la cookie es httpOnly y no viaja entre sitios", () => {
  const ruta = readFileSync(resolve(RAIZ, "app/api/auth/entrar/route.ts"), "utf8");
  assert.match(ruta, /httpOnly:\s*true/, "el JS de la página no debe poder leerla");
  assert.match(ruta, /sameSite:\s*"lax"/, "no debe viajar en peticiones de otros sitios");
  assert.match(ruta, /limitar\(/, "debe limitar los intentos por IP");
});

test("el destino tras entrar no puede ser un sitio externo", () => {
  const form = readFileSync(resolve(RAIZ, "components/dashboard/formulario-entrar.tsx"), "utf8");
  assert.match(form, /\^\\\/dashboard/, "el destino debe validarse contra /dashboard");
});

test("las rutas de ESCRITURA del panel también están protegidas", () => {
  // Proteger las páginas y dejar /api/panel abierto sería una puerta con
  // cerradura y la ventana abierta: esas rutas escriben con service_role.
  const mw = readFileSync(resolve(RAIZ, "middleware.ts"), "utf8");
  assert.match(mw, /\/api\/panel\/:path\*/, "/api/panel debe pasar por el middleware");
});

test("a una API se le responde 401, no se la redirige", () => {
  // Un fetch() que sigue la redirección acabaría parseando HTML como JSON, y
  // el error que ve el usuario no tendría nada que ver con lo que pasa.
  const mw = readFileSync(resolve(RAIZ, "middleware.ts"), "utf8");
  assert.match(mw, /pathname\.startsWith\("\/api\/"\)[\s\S]*?status:\s*401/);
});

test("las escrituras del panel filtran por business_id a mano", () => {
  // service_role SALTA RLS: sin este filtro, un id de otro negocio se podría
  // tocar desde aquí. Es el único sitio del proyecto donde la base no protege.
  for (const ruta of ["reserva", "plato"]) {
    const codigo = readFileSync(resolve(RAIZ, `app/api/panel/${ruta}/route.ts`), "utf8");
    assert.match(codigo, /\.eq\("business_id", negocio\.id\)/,
      `app/api/panel/${ruta} no filtra por business_id`);
  }
});
