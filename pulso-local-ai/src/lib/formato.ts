import type { InmueblePublico } from "@/types/dominio";

const EUROS = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const NUMERO = new Intl.NumberFormat("es-ES");

export function euros(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "Consultar";
  return EUROS.format(valor);
}

/** El alquiler se lee «780 €/mes»; la venta, «189.000 €». */
export function precioInmueble(inmueble: Pick<InmueblePublico, "price" | "price_on_request" | "operation_type">): string {
  if (inmueble.price_on_request || inmueble.price === null) return "Precio a consultar";
  const base = euros(inmueble.price);
  return inmueble.operation_type === "venta" ? base : `${base}/mes`;
}

export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return NUMERO.format(valor);
}

export function metros(valor: number | null | undefined): string {
  return valor ? `${NUMERO.format(valor)} m²` : "—";
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Días completos que faltan hasta una fecha. Negativo si ya pasó. */
export function diasHasta(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Teléfono en formato internacional para `tel:` y `wa.me` (España por defecto). */
export function telefonoInternacional(telefono: string | null | undefined, prefijo = "34"): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("00")) return digitos.slice(2);
  if (digitos.length === 9) return `${prefijo}${digitos}`;
  return digitos;
}

export function enlaceWhatsapp(telefono: string | null | undefined, mensaje?: string): string | null {
  const numeroWa = telefonoInternacional(telefono);
  if (!numeroWa) return null;
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${numeroWa}${texto}`;
}

export function enlaceLlamada(telefono: string | null | undefined): string | null {
  const numeroTel = telefonoInternacional(telefono);
  return numeroTel ? `tel:+${numeroTel}` : null;
}

export function enlaceMapa(direccion: string | null | undefined, ciudad?: string | null): string | null {
  const texto = [direccion, ciudad].filter(Boolean).join(", ");
  if (!texto) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}

/** Slug estable para URLs. Quita tildes y deja solo letras, números y guiones. */
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function recortar(texto: string | null | undefined, limite = 160): string {
  if (!texto) return "";
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1).trimEnd()}…`;
}
