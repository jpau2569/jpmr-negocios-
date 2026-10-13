// ============================================================================
//  D1 de mentira sobre SQLite (node:sqlite) — para pruebas y para probar en
//  local sin cuenta de Cloudflare. Copia de la de castresana-web; aquí ASSETS
//  sirve también subcarpetas de /static/ y /sw.js. Imita solo lo que usa el Worker:
//    db.prepare(sql).bind(...).first() / .all() / .run()   y   db.batch([...])
//  con la misma forma de respuesta que D1 ({ results }, { meta: { changes,
//  last_row_id } }). D1 es SQLite, así que el SQL y los errores
//  («UNIQUE constraint failed») son los mismos.
//
//  Cada operación cede el turno antes de ejecutarse (como una llamada de red
//  de verdad): así dos peticiones a la vez se intercalan y se puede probar que
//  la misma hoja subida dos veces a la vez se guarda una sola.
// ============================================================================
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const cedeTurno = () => new Promise((r) => setImmediate(r));
const limpiaFila = (f) => (f ? { ...f } : null);

class Sentencia {
  constructor(base, sql, params = []) { this.base = base; this.sql = sql; this.params = params; }
  bind(...params) {
    for (const p of params) {
      if (p === undefined || typeof p === "boolean" || (typeof p === "object" && p !== null)) {
        // D1 tampoco acepta undefined: mejor enterarse en las pruebas.
        throw new TypeError(`Parámetro no admitido por D1: ${String(p)} (${typeof p})`);
      }
    }
    return new Sentencia(this.base, this.sql, params);
  }
  _ejecuta(modo) {
    const st = this.base.prepare(this.sql);
    if (modo === "first") return limpiaFila(st.get(...this.params));
    if (modo === "all") return { success: true, results: st.all(...this.params).map(limpiaFila), meta: {} };
    const r = st.run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async first(columna) {
    await cedeTurno();
    const f = this._ejecuta("first");
    return columna ? (f ? f[columna] : null) : f;
  }
  async all() { await cedeTurno(); return this._ejecuta("all"); }
  async run() { await cedeTurno(); return this._ejecuta("run"); }
}

export function creaD1(ruta = ":memory:", { esquema = new URL("../schema.sql", import.meta.url) } = {}) {
  const base = new DatabaseSync(ruta);
  if (esquema) base.exec(readFileSync(esquema, "utf8"));
  return {
    _base: base,
    prepare: (sql) => new Sentencia(base, sql),
    async batch(sentencias) {
      await cedeTurno();
      base.exec("BEGIN");
      try {
        const salida = sentencias.map((s) => s._ejecuta("run"));
        base.exec("COMMIT");
        return salida;
      } catch (e) {
        base.exec("ROLLBACK");
        throw e;
      }
    },
    async exec(sql) { await cedeTurno(); base.exec(sql); return { count: 0, duration: 0 }; },
  };
}

/** ASSETS de mentira: sirve la carpeta public/ (solo GET de archivos que existan). */
export function creaAssets(carpeta = new URL("../public/", import.meta.url)) {
  const tipos = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
  return {
    async fetch(peticion) {
      const ruta = decodeURIComponent(new URL(peticion.url).pathname);
      if (ruta.includes("..") || !/^\/(static\/[\w./-]+|sw\.js)$/.test(ruta)) return new Response("No encontrado", { status: 404 });
      try {
        const datos = readFileSync(new URL("." + ruta, carpeta));
        const ext = ruta.slice(ruta.lastIndexOf("."));
        return new Response(datos, { status: 200, headers: { "content-type": tipos[ext] || "application/octet-stream" } });
      } catch {
        return new Response("No encontrado", { status: 404 });
      }
    },
  };
}
