// ============================================================================
//  Fotos Fáciles — seguridad de la sesión
// ----------------------------------------------------------------------------
//  El servidor solo vive en la red local, pero una WiFi de oficina la comparte
//  mucha gente. Por eso:
//   · Cada arranque genera un PIN de 4 cifras y un token de sesión nuevos.
//   · El QR lleva el token en el fragmento (#t=…), así que quien escanea entra
//     directo y quien solo teclea la dirección tiene que poner el PIN.
//   · Los intentos de PIN están limitados por IP para que nadie lo adivine.
//   · Los álbumes compartidos usan tokens propios de solo lectura.
// ============================================================================
import crypto from "node:crypto";

const MAX_INTENTOS = 6;
const VENTANA_MS = 60_000;
const CASTIGO_MS = 120_000;

export class Seguridad {
  constructor({ pedirPin = true } = {}) {
    this.pedirPin = pedirPin;
    this.pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    this.token = crypto.randomBytes(24).toString("base64url");
    this.tokensLectura = new Map();     // token de álbum → { hasta, album }
    this.intentos = new Map();          // ip → { veces, desde, bloqueadoHasta }
  }

  /** Comparación en tiempo constante: no filtra el PIN por el tiempo de respuesta. */
  static iguales(a, b) {
    const x = Buffer.from(String(a || ""));
    const y = Buffer.from(String(b || ""));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  }

  esLocal(req) {
    const ip = String(req.socket?.remoteAddress || "");
    return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  }

  tokenDe(req, url) {
    const cabecera = req.headers["x-fotos-token"];
    if (cabecera) return String(cabecera);
    const cookie = /(?:^|;\s*)fotos_token=([^;]+)/.exec(req.headers.cookie || "");
    if (cookie) return decodeURIComponent(cookie[1]);
    return url?.searchParams.get("t") || "";
  }

  /**
   * ¿Esta petición puede tocar las fotos?
   * Desde el propio ordenador siempre sí: es la pantalla del programa y
   * cualquier cosa que corra ahí ya tiene acceso a esas carpetas. Desde la red
   * (el móvil) hace falta el token del QR o haber acertado el PIN.
   */
  autorizada(req, url) {
    if (this.esLocal(req)) return true;
    return Seguridad.iguales(this.tokenDe(req, url), this.token);
  }

  /** Intento de entrar con el PIN. Devuelve { ok, token } o { ok:false, espera }. */
  entrarConPin(ip, pin) {
    const ahora = Date.now();
    const registro = this.intentos.get(ip) || { veces: 0, desde: ahora, bloqueadoHasta: 0 };
    if (registro.bloqueadoHasta > ahora) {
      return { ok: false, espera: Math.ceil((registro.bloqueadoHasta - ahora) / 1000) };
    }
    if (ahora - registro.desde > VENTANA_MS) { registro.veces = 0; registro.desde = ahora; }

    if (Seguridad.iguales(pin, this.pin)) {
      this.intentos.delete(ip);
      return { ok: true, token: this.token };
    }
    registro.veces++;
    if (registro.veces >= MAX_INTENTOS) {
      registro.bloqueadoHasta = ahora + CASTIGO_MS;
      registro.veces = 0;
      registro.desde = ahora;
    }
    this.intentos.set(ip, registro);
    return { ok: false, restantes: Math.max(0, MAX_INTENTOS - registro.veces) };
  }

  // --- Enlaces de álbum (solo lectura, caducan) ------------------------------
  nuevoTokenAlbum(albumId, dias = 7) {
    const token = crypto.randomBytes(18).toString("base64url");
    const hasta = Date.now() + Math.max(1, Math.min(365, dias)) * 86_400_000;
    this.tokensLectura.set(token, { album: albumId, hasta });
    return { token, hasta };
  }

  albumDeToken(token) {
    const ficha = this.tokensLectura.get(String(token || ""));
    if (!ficha) return null;
    if (ficha.hasta < Date.now()) { this.tokensLectura.delete(token); return null; }
    return ficha.album;
  }

  recuperaTokenAlbum(token, albumId, hasta) {
    if (hasta > Date.now()) this.tokensLectura.set(token, { album: albumId, hasta });
  }
}

export const ipDe = (req) => String(req.socket?.remoteAddress || "desconocida");
