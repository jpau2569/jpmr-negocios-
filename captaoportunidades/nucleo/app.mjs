// ============================================================================
//  Aplicación: reúne las dos bases de datos y las rutas de datos.
//    <datos>/captao.sqlite            → DATOS REALES
//    <datos>/archivos/                → adjuntos y fotos reales (Fase 2)
//    <datos>/copias/                  → copias de seguridad
//    <datos>/demo/captao-demo.sqlite  → DEMOSTRACIÓN (ficticia, separada)
//  Los datos de demostración viven en OTRO fichero: no hay forma de que se
//  mezclen con los reales ni de que una copia de los reales los incluya.
// ============================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { abrirBd } from "./bd.mjs";
import { crearCtx, sembrarCatalogos } from "./config.mjs";
import { relojSistema } from "./util.mjs";
import { sembrarDemo } from "./demo.mjs";

export const VERSION = "1.0.0-fase1";

export function carpetaDatosPorDefecto() {
  return process.env.CAPTAO_DATOS || path.join(os.homedir(), ".captaoportunidades");
}

export function crearApp({ datos = carpetaDatosPorDefecto(), reloj = relojSistema } = {}) {
  const dirs = {
    datos,
    copias: path.join(datos, "copias"),
    archivos: path.join(datos, "archivos"),
    demo: path.join(datos, "demo"),
    bdReal: path.join(datos, "captao.sqlite"),
    bdDemo: path.join(datos, "demo", "captao-demo.sqlite"),
  };
  for (const d of [dirs.datos, dirs.copias, dirs.archivos, dirs.demo]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });

  const app = { dirs, reloj, version: VERSION, mantenimiento: null, _bd: {} };

  function abrir(modo) {
    const ruta = modo === "demo" ? dirs.bdDemo : dirs.bdReal;
    const nueva = !fs.existsSync(ruta);
    const bd = abrirBd(ruta);
    sembrarCatalogos(bd);
    if (modo === "demo" && nueva) {
      const ctx = crearCtx(bd, reloj, "demo");
      sembrarDemo(ctx);
    }
    return bd;
  }

  app.bd = (modo = "real") => {
    if (modo !== "real" && modo !== "demo") modo = "real";
    return (app._bd[modo] ??= abrir(modo));
  };
  app.ctx = (modo = "real") => crearCtx(app.bd(modo), reloj, modo === "demo" ? "demo" : "real");
  app.cerrarReal = () => { app._bd.real?.cerrar(); delete app._bd.real; };
  app.reabrirReal = () => app.bd("real");

  /** Borra la demostración y la vuelve a crear desde cero. Nunca toca los datos reales. */
  app.restablecerDemo = () => {
    app._bd.demo?.cerrar();
    delete app._bd.demo;
    for (const ext of ["", "-wal", "-shm"]) fs.rmSync(dirs.bdDemo + ext, { force: true });
    return app.bd("demo");
  };

  app.cerrar = () => {
    for (const modo of Object.keys(app._bd)) { try { app._bd[modo].cerrar(); } catch { /* ya cerrada */ } }
    app._bd = {};
  };
  return app;
}
