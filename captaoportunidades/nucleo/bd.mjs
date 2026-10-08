// ============================================================================
//  Capa de base de datos. ES EL ÚNICO ARCHIVO que conoce el motor (SQLite
//  integrado en Node, `node:sqlite`): si algún día hay que cambiarlo por otro,
//  se toca solo esto.
//
//  Garantías: claves foráneas activadas, journal WAL con synchronous=FULL
//  (una caída de luz no corrompe la base), migraciones versionadas con copia
//  previa, y transacciones anidadas (SAVEPOINT).
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { normaliza, ErrorApp } from "./util.mjs";
import { MIGRACIONES } from "./migraciones.mjs";
import { CAMPOS_LISTA } from "./campos.mjs";

// `node:sqlite` aún imprime un aviso de "experimental" en Node 22: es ruido
// para quien usa el programa, así que se filtra solo ese aviso.
const emitirOriginal = process.emitWarning;
process.emitWarning = function (aviso, ...resto) {
  const texto = typeof aviso === "string" ? aviso : aviso?.message || "";
  if (/SQLite is an experimental feature/i.test(texto)) return;
  return emitirOriginal.call(process, aviso, ...resto);
};
let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  throw new ErrorApp(500, "node_antiguo", "Este programa necesita Node.js 22.13 o superior (trae SQLite integrado). Descárgalo en https://nodejs.org");
}

export function comoParam(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (Array.isArray(v) || (typeof v === "object" && !(v instanceof Uint8Array))) return JSON.stringify(v);
  return v;
}
const plano = (fila) => (fila ? { ...fila } : undefined);

export class Bd {
  constructor(db, ruta) {
    this.db = db;
    this.ruta = ruta;
    this.profundidad = 0;
    this.cerrada = false;
  }
  ejecutar(sql, params = []) {
    const r = this.db.prepare(sql).run(...params.map(comoParam));
    return { cambios: Number(r.changes), id: Number(r.lastInsertRowid) };
  }
  uno(sql, params = []) { return plano(this.db.prepare(sql).get(...params.map(comoParam))); }
  todos(sql, params = []) { return this.db.prepare(sql).all(...params.map(comoParam)).map(plano); }
  valor(sql, params = []) { const f = this.uno(sql, params); return f ? Object.values(f)[0] : undefined; }

  /** Transacción atómica; las llamadas anidadas usan SAVEPOINT. Si fn lanza, se deshace todo. */
  transaccion(fn) {
    const nivel = this.profundidad++;
    const sp = `sp_${nivel}`;
    this.db.exec(nivel === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
    try {
      const r = fn();
      this.db.exec(nivel === 0 ? "COMMIT" : `RELEASE ${sp}`);
      return r;
    } catch (e) {
      try { this.db.exec(nivel === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`); } catch { /* ya deshecho */ }
      throw e;
    } finally {
      this.profundidad--;
    }
  }

  version() { return Number(this.valor("PRAGMA user_version")); }

  /** Copia coherente de la base viva a un fichero (no copia el WAL a mano). */
  copiarA(destino) {
    if (fs.existsSync(destino)) fs.unlinkSync(destino);
    this.db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  }
  cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    try { this.db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* sin WAL */ }
    this.db.close();
  }
}

export function abrirBd(ruta, { migraciones = MIGRACIONES } = {}) {
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  const existia = fs.existsSync(ruta);
  const db = new DatabaseSync(ruta);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = FULL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA secure_delete = ON"); // lo borrado (p. ej. al anonimizar) se sobrescribe en el fichero
  db.exec("PRAGMA busy_timeout = 5000");
  // norm(): comparar y buscar sin tildes ni mayúsculas, siempre al día (no hay columnas derivadas que se desincronicen).
  db.function("norm", { deterministic: true }, (s) => normaliza(s));
  const bd = new Bd(db, ruta);

  const actual = bd.version();
  const ultima = migraciones.length ? migraciones[migraciones.length - 1].version : 0;
  if (actual > ultima) {
    bd.cerrar();
    throw new ErrorApp(500, "bd_mas_nueva",
      `Esta base de datos es de una versión más nueva del programa (esquema ${actual}, este programa llega al ${ultima}). Actualiza el programa antes de abrirla.`);
  }
  const pendientes = migraciones.filter((m) => m.version > actual);
  if (pendientes.length) {
    // Antes de tocar datos reales, una copia al lado.
    if (existia && actual > 0) {
      try { bd.copiarA(`${ruta}.antes-de-v${pendientes[0].version}.bak`); } catch { /* copia de cortesía */ }
    }
    for (const m of pendientes) {
      bd.transaccion(() => {
        db.exec(m.sql);
        db.exec(`PRAGMA user_version = ${m.version}`);
      });
    }
  }
  return bd;
}

// ------------------------------------------------------------ helpers CRUD ----
export function hidratar(tabla, fila) {
  if (!fila) return fila;
  for (const campo of CAMPOS_LISTA[tabla] || []) {
    try { fila[campo] = fila[campo] ? JSON.parse(fila[campo]) : []; } catch { fila[campo] = []; }
  }
  return fila;
}

export function insertar(bd, tabla, fila) {
  const cols = Object.keys(fila);
  const sql = `INSERT INTO ${tabla} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  return bd.ejecutar(sql, cols.map((c) => fila[c])).id;
}

export function actualizar(bd, tabla, id, cambios, columnaId = "id") {
  const cols = Object.keys(cambios);
  if (!cols.length) return;
  bd.ejecutar(`UPDATE ${tabla} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE ${columnaId} = ?`, [...cols.map((c) => cambios[c]), id]);
}

/** Valor tal como queda en la base, para comparar antes/después sin falsos cambios. */
export function comoGuardado(v) {
  const p = comoParam(v);
  return p === undefined ? null : p;
}

/** Siguiente número de una serie que nunca se reutiliza, aunque se borren registros. */
export function siguienteContador(bd, clave) {
  return Number(bd.valor(
    "INSERT INTO contadores (clave, valor) VALUES (?, 1) ON CONFLICT(clave) DO UPDATE SET valor = valor + 1 RETURNING valor",
    [clave],
  ));
}
