import * as React from "react";
import { cn } from "@/lib/utils";
import { Icono, type NombreIcono } from "./icono";

const TONOS = {
  info: { caja: "border-[var(--borde)] bg-[var(--superficie-2)] text-[var(--texto)]", icono: "aviso" },
  exito: { caja: "border-[var(--exito)] bg-[color-mix(in_srgb,var(--exito)_10%,transparent)] text-[var(--texto)]", icono: "ok" },
  aviso: { caja: "border-[var(--aviso)] bg-[color-mix(in_srgb,var(--aviso)_10%,transparent)] text-[var(--texto)]", icono: "aviso" },
  peligro: { caja: "border-[var(--peligro)] bg-[color-mix(in_srgb,var(--peligro)_8%,transparent)] text-[var(--texto)]", icono: "aviso" },
} satisfies Record<string, { caja: string; icono: NombreIcono }>;

export function Aviso({
  tono = "info",
  titulo,
  children,
  className,
}: {
  tono?: keyof typeof TONOS;
  titulo?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = TONOS[tono];
  return (
    <div className={cn("flex gap-3 rounded-[var(--radio)] border p-4 text-sm", t.caja, className)}>
      <Icono nombre={t.icono} className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children ? <div className="text-[var(--texto-suave)]">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * Distintivo de datos de demostración. Aparece siempre que el contenido venga
 * del seed: el visitante tiene derecho a saber que ese piso no está a la venta.
 */
export function DistintivoDemo({ className, texto }: { className?: string; texto?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--aviso)] bg-[color-mix(in_srgb,var(--aviso)_12%,transparent)] px-2.5 py-1 text-xs font-semibold text-[var(--aviso)]",
        className,
      )}
    >
      <Icono nombre="aviso" className="size-3.5" />
      {texto ?? "Datos de demostración. Consultar disponibilidad."}
    </span>
  );
}
