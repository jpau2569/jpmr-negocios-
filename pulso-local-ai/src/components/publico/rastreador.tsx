"use client";

import { useEffect } from "react";
import { codigoQr, registrar } from "@/lib/cliente/eventos";

/**
 * Registra la vista de la página. Se monta una vez por ruta; si la persona llegó
 * con `?qr=`, el evento se guarda como entrada por QR y no como visita web.
 */
export function Rastreador({
  slug,
  tipo,
  propertyId,
}: {
  slug: string;
  tipo: string;
  propertyId?: string;
}) {
  useEffect(() => {
    const tipoFinal = tipo === "public_landing_view" && codigoQr() ? "qr_landing_view" : tipo;
    void registrar(slug, tipoFinal, propertyId ? { propertyId } : {});
  }, [slug, tipo, propertyId]);

  return null;
}

/** Botón que registra un clic antes de dejar que el navegador siga al enlace. */
export function EnlaceMedido({
  slug,
  tipo,
  href,
  propertyId,
  children,
  className,
  externo,
  ...props
}: {
  slug: string;
  tipo: string;
  href: string;
  propertyId?: string;
  children: React.ReactNode;
  className?: string;
  externo?: boolean;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a
      href={href}
      className={className}
      target={externo ? "_blank" : undefined}
      rel={externo ? "noopener noreferrer" : undefined}
      onClick={() => void registrar(slug, tipo, propertyId ? { propertyId } : {})}
      {...props}
    >
      {children}
    </a>
  );
}
