// ============================================================================
//  Fotos Fáciles — configuración persistente (~/.fotos-faciles/config.json)
// ============================================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CARPETA_APP = process.env.FOTOS_FACILES_HOME
  ? path.resolve(process.env.FOTOS_FACILES_HOME)
  : path.join(os.homedir(), ".fotos-faciles");
const FICHERO = path.join(CARPETA_APP, "config.json");

export const POR_DEFECTO = {
  carpetaDestino: path.join(os.homedir(), "Fotos Faciles"),
  puerto: 4321,
  organizarPor: "fecha",        // "fecha" | "inmueble" | "ninguna"
  inmueble: "",                 // nombre del inmueble activo (modo "inmueble")
  renombrar: true,              // 2026-09-07_Piso-Oviedo_001.jpg
  pedirPin: true,               // pedir PIN si se entra sin escanear el QR
  pin: "",                      // PIN fijo (vacío = uno nuevo en cada arranque)
  enlaceFijo: false,            // que el enlace/QR del móvil no cambie al reiniciar
  token: "",                    // se rellena solo cuando `enlaceFijo` está activo
  abrirNavegador: true,
  urlPublica: "",               // dominio de un túnel propio (Cloudflare, ngrok…)
  carpetasFavoritas: [],
};

let cache = null;

export function leerConfig() {
  if (cache) return cache;
  let guardada = {};
  try { guardada = JSON.parse(fs.readFileSync(FICHERO, "utf8")); } catch { /* primera vez */ }
  cache = { ...POR_DEFECTO, ...guardada };
  cache.carpetaDestino = path.resolve(cache.carpetaDestino || POR_DEFECTO.carpetaDestino);
  return cache;
}

export function guardarConfig(cambios) {
  const nueva = { ...leerConfig(), ...cambios };
  nueva.puerto = Math.min(65535, Math.max(1024, Number(nueva.puerto) || POR_DEFECTO.puerto));
  nueva.carpetaDestino = path.resolve(nueva.carpetaDestino || POR_DEFECTO.carpetaDestino);
  if (!["fecha", "inmueble", "ninguna"].includes(nueva.organizarPor)) nueva.organizarPor = "fecha";
  // Un PIN fijo son solo dígitos, entre 4 y 8. Cualquier otra cosa se descarta
  // y se vuelve al PIN aleatorio de cada arranque.
  nueva.pin = /^\d{4,8}$/.test(String(nueva.pin || "")) ? String(nueva.pin) : "";
  if (!nueva.enlaceFijo) nueva.token = "";
  fs.mkdirSync(CARPETA_APP, { recursive: true });
  fs.writeFileSync(FICHERO, JSON.stringify(nueva, null, 2), "utf8");
  cache = nueva;
  return nueva;
}

/** Solo para los tests: olvida la configuración cargada en memoria. */
export function olvidarConfig() { cache = null; }
