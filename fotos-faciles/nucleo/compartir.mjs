// ============================================================================
//  Fotos Fáciles — enlaces para enseñar fotos a un cliente
// ----------------------------------------------------------------------------
//  Un álbum es una LISTA DE RUTAS, no una copia: generar un enlace nunca mueve,
//  renombra ni toca los originales. El enlace lleva su propio token de solo
//  lectura y caduca (7 días por defecto).
//
//  Dos alcances:
//   · "local"  → http://IP-del-PC:4321/a/<token>  (misma WiFi, PC encendido)
//   · "publico"→ el mismo camino sobre el dominio de un túnel propio
//                (Cloudflare Tunnel, ngrok, Tailscale Funnel) configurado en
//                Ajustes. No se sube ninguna foto a la nube: sigue sirviéndola
//                el PC. Si no hay túnel configurado, la app lo dice y no
//                promete un enlace que no funcionaría.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { esVideo, esFoto } from "./util.mjs";

const MAX_ALBUMES = 200;

export class Albumes {
  constructor(carpetaDestino) {
    this.fichero = path.join(path.resolve(carpetaDestino), ".fotos-faciles", "albumes.json");
    this.lista = [];
  }

  async preparar(seguridad) {
    await fsp.mkdir(path.dirname(this.fichero), { recursive: true });
    try { this.lista = JSON.parse(await fsp.readFile(this.fichero, "utf8")) || []; } catch { this.lista = []; }
    this.purga();
    // Los tokens viven en memoria: al arrancar se recuperan los que siguen vivos.
    if (seguridad) for (const a of this.lista) seguridad.recuperaTokenAlbum(a.token, a.id, a.caduca);
    return this;
  }

  purga() {
    const ahora = Date.now();
    this.lista = this.lista.filter((a) => a.caduca > ahora).slice(-MAX_ALBUMES);
  }

  async guarda() {
    try { await fsp.writeFile(this.fichero, JSON.stringify(this.lista, null, 2), "utf8"); }
    catch (e) { console.error("No se pudieron guardar los álbumes:", e.message); }
  }

  async crear({ nombre, archivos, dias = 7, seguridad }) {
    const rutas = [...new Set((archivos || []).map((r) => path.resolve(String(r))))]
      .filter((r) => fs.existsSync(r) && fs.statSync(r).isFile());
    if (!rutas.length) throw new Error("No hay archivos para compartir");

    const id = crypto.randomBytes(6).toString("hex");
    const { token, hasta } = seguridad.nuevoTokenAlbum(id, dias);
    const album = {
      id, token, nombre: String(nombre || "Fotos").slice(0, 80),
      creado: Date.now(), caduca: hasta, archivos: rutas, visitas: 0,
    };
    this.lista.push(album);
    this.purga();
    await this.guarda();
    return album;
  }

  porId(id) { return this.lista.find((a) => a.id === id) || null; }

  /** Contenido servible de un álbum: solo lo que aún existe en disco. */
  contenido(id) {
    const album = this.porId(id);
    if (!album || album.caduca < Date.now()) return null;
    const archivos = album.archivos
      .filter((r) => fs.existsSync(r))
      .map((r, i) => ({
        indice: i, nombre: path.basename(r), ruta: r,
        tipo: esVideo(r) ? "video" : esFoto(r) ? "foto" : "otro",
        tamano: fs.statSync(r).size,
      }));
    return { ...album, archivos };
  }

  async apuntaVisita(id) {
    const album = this.porId(id);
    if (album) { album.visitas++; await this.guarda(); }
  }

  async borrar(id) {
    this.lista = this.lista.filter((a) => a.id !== id);
    await this.guarda();
  }

  /** Los álbumes vivos, para el panel del ordenador. */
  vivos() {
    this.purga();
    return this.lista.map((a) => ({
      id: a.id, token: a.token, nombre: a.nombre, creado: a.creado,
      caduca: a.caduca, cuantos: a.archivos.length, visitas: a.visitas,
    })).sort((x, y) => y.creado - x.creado);
  }
}

/** Construye las URL que se enseñan al usuario para un álbum. */
export function enlacesDe(album, { ip, puerto, urlPublica }) {
  const local = `http://${ip}:${puerto}/a/${album.token}`;
  const publico = urlPublica
    ? `${String(urlPublica).replace(/\/+$/, "")}/a/${album.token}`
    : null;
  return { local, publico };
}
