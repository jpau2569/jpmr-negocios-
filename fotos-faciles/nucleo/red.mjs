// ============================================================================
//  Fotos Fáciles — direcciones de la red local
// ----------------------------------------------------------------------------
//  El móvil tiene que llegar al PC, así que hay que enseñarle la IP correcta.
//  Se ordenan poniendo primero las típicas de WiFi doméstica o de oficina y
//  dejando al final las de adaptadores virtuales (VirtualBox, Docker, WSL…),
//  que es el error clásico por el que "el QR no funciona".
// ============================================================================
import os from "node:os";

const PREFERIDAS = [
  /^192\.168\./,                      // routers domésticos y de oficina
  /^10\./,                            // redes de empresa
  /^172\.(1[6-9]|2\d|3[01])\./,       // rango privado intermedio
];

const VIRTUALES = /(vmware|virtualbox|vbox|docker|hyper-v|vethernet|wsl|tailscale|zerotier|utun|bridge)/i;

/** Todas las IPv4 locales útiles, la mejor primero. */
export function direccionesLocales() {
  const salida = [];
  for (const [interfaz, lista] of Object.entries(os.networkInterfaces())) {
    for (const dir of lista || []) {
      if (dir.family !== "IPv4" || dir.internal) continue;
      if (/^169\.254\./.test(dir.address)) continue;      // sin DHCP, no sirve
      const puesto = PREFERIDAS.findIndex((re) => re.test(dir.address));
      salida.push({
        ip: dir.address,
        interfaz,
        puesto: puesto === -1 ? 9 : puesto,
        virtual: VIRTUALES.test(interfaz),
      });
    }
  }
  salida.sort((a, b) => (a.virtual - b.virtual) || (a.puesto - b.puesto) || a.ip.localeCompare(b.ip));
  return salida;
}

export function mejorDireccion() {
  return direccionesLocales()[0]?.ip || "127.0.0.1";
}

export function hayRedLocal() {
  return direccionesLocales().length > 0;
}
