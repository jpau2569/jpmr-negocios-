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
// Cabeceras que pone un proxy o un túnel (Cloudflare añade cf-connecting-ip y
// cf-ray; ngrok y otros, x-forwarded-for). Node las da en minúsculas.
const CABECERAS_PROXY = ["cf-connecting-ip", "cf-ray", "x-forwarded-for", "forwarded", "x-real-ip", "cdn-loop"];
// Nombres con los que el propio PC se llama a sí mismo (con o sin puerto).
// `iniciar.mjs` abre siempre http://localhost:<puerto>/.
const HOST_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

export class Seguridad {
  /**
   * `pin` y `token` fijos son opcionales. Sin ellos se generan nuevos en cada
   * arranque (lo más seguro); con ellos, el PIN y el enlace del móvil no
   * cambian nunca, que es lo cómodo si el ordenador es de la oficina y el
   * móvil ya tiene la página guardada.
   */
  constructor({ pedirPin = true, pin = "", token = "" } = {}) {
    this.pedirPin = pedirPin;
    this.pinFijo = /^\d{4,8}$/.test(String(pin || ""));
    this.pin = this.pinFijo ? String(pin) : String(crypto.randomInt(0, 10000)).padStart(4, "0");
    this.tokenFijo = typeof token === "string" && token.length >= 24;
    this.token = this.tokenFijo ? token : crypto.randomBytes(24).toString("base64url");
    this.tokensLectura = new Map();     // token de álbum → { hasta, album }
    this.intentos = new Map();          // ip → { veces, desde, bloqueadoHasta }
  }

  /**
   * Cambia el PIN y el enlace sin reiniciar el programa. Devuelve el token que
   * hay que guardar en la configuración cuando se pide enlace fijo.
   */
  aplicaAjustes({ pin = null, enlaceFijo = null, token = "" } = {}) {
    if (pin !== null) {
      this.pinFijo = /^\d{4,8}$/.test(String(pin));
      if (this.pinFijo) this.pin = String(pin);
      else if (!this.pinFijo) this.pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    }
    if (enlaceFijo !== null) {
      this.tokenFijo = !!enlaceFijo;
      if (this.tokenFijo) this.token = token && token.length >= 24 ? token : this.token;
      else this.token = crypto.randomBytes(24).toString("base64url");
    }
    return this.tokenFijo ? this.token : "";
  }

  /** Comparación en tiempo constante: no filtra el PIN por el tiempo de respuesta. */
  static iguales(a, b) {
    const x = Buffer.from(String(a || ""));
    const y = Buffer.from(String(b || ""));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  }

  esLocal(req) {
    // Un túnel (cloudflared, ngrok…) se conecta desde el propio ordenador, así
    // que su tráfico llega desde 127.0.0.1 aunque venga de internet. Si la
    // petición trae cabeceras de proxy, NO es del propio PC: tiene que entrar
    // con token o PIN como cualquier otro. Esto solo quita privilegios.
    //
    // Además, la dirección escrita en el navegador (cabecera Host) tiene que
    // ser localhost, 127.0.0.1 o [::1]. Eso para el «DNS rebinding»: una web
    // maliciosa abierta en este PC puede hacer que su dominio apunte a
    // 127.0.0.1 y hablar con el programa como si fuera la pantalla propia; en
    // ese caso el Host es el de esa web y aquí se le trata como a un extraño.
    // Abrir el programa con la IP de la red (http://192.168.x.x:puerto) desde
    // el propio PC ya pedía PIN antes (la conexión no llega por 127.0.0.1).
    const h = req.headers || {};
    if (CABECERAS_PROXY.some((c) => h[c] !== undefined)) return false;
    if (!HOST_LOCAL.test(String(h.host || "").trim().toLowerCase())) return false;
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

/** Token nuevo para guardar en la configuración cuando se pide enlace fijo. */
export const nuevoToken = () => crypto.randomBytes(24).toString("base64url");
