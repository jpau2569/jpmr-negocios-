import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Iconos propios en SVG en lugar de una librería de iconos. Son veinte trazos:
 * meter 300 kB de paquete en una página que se abre desde un cartel, con datos
 * móviles y a la primera, no sale a cuenta.
 */
const TRAZOS = {
  telefono: "M4 4h4l2 5-2.5 1.5a12 12 0 006 6L15 14l5 2v4a16 16 0 01-16-16z",
  whatsapp:
    "M20.5 11.6a8.5 8.5 0 01-12.6 7.5L3.5 20.5l1.5-4.3A8.5 8.5 0 1120.5 11.6zM8.8 8.4c-.3 0-.6.1-.9.4-.3.4-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 5 4.2 2.4.9 2.9.7 3.4.7.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4l-2-1c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1a7.7 7.7 0 01-3.6-3.1c-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6 0-.2 0-.4-.1-.6l-.9-2c-.2-.5-.4-.4-.6-.5z",
  mapa: "M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z M12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  reloj: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3.5 2",
  casa: "M4 11l8-6 8 6v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z",
  llave: "M15 7a4 4 0 110 8 4 4 0 010-8z M11.5 12.5L3 21l2 2 1.5-1.5L8 23l2-2-1.5-1.5L11 17",
  euro: "M16 7a5.5 5.5 0 100 10 M5 10.5h7 M5 13.5h7",
  lupa: "M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.3-4.3",
  estrella: "M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z",
  grafico: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  usuarios: "M9 11a4 4 0 100-8 4 4 0 000 8z M1 21v-1a6 6 0 016-6h4a6 6 0 016 6v1 M17 11a3 3 0 100-6 M19 21v-1a5 5 0 00-2-4",
  calendario: "M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4",
  chat: "M4 5h16v11H9l-5 4z",
  ajustes: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 13a7.6 7.6 0 000-2l2-1.5-2-3.4-2.4 1a7.6 7.6 0 00-1.7-1L15 3H9l-.3 2.6a7.6 7.6 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 000 2l-2 1.5 2 3.4 2.4-1c.5.4 1.1.8 1.7 1L9 21h6l.3-2.6c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4z",
  flecha: "M5 12h14 M13 6l6 6-6 6",
  descargar: "M12 4v11 M8 11l4 4 4-4 M4 20h16",
  aviso: "M12 4l9 16H3z M12 10v4 M12 17h.01",
  ok: "M5 13l4 4L19 7",
  cerrar: "M6 6l12 12 M18 6L6 18",
  edificio: "M5 21V5a1 1 0 011-1h8a1 1 0 011 1v16 M15 9h4a1 1 0 011 1v11 M8 8h4 M8 12h4 M8 16h4",
  balanza: "M12 3v18 M5 21h14 M4 8h16 M4 8l-3 6h6z M20 8l3 6h-6z",
  camara: "M4 8h3l2-2h6l2 2h3v12H4z M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  documento: "M6 3h8l4 4v14H6z M14 3v4h4 M9 13h6 M9 17h6",
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({
  nombre,
  className,
  ...props
}: { nombre: NombreIcono } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-5", className)}
      {...props}
    >
      {TRAZOS[nombre].split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}
