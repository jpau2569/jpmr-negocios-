import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variantesBadge = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tono: {
        neutro: "bg-[var(--superficie-2)] text-[var(--texto-suave)]",
        marca: "bg-[var(--marca)] text-[var(--marca-contraste)]",
        acento: "bg-[var(--acento)] text-[var(--acento-contraste)]",
        exito: "bg-[color-mix(in_srgb,var(--exito)_15%,transparent)] text-[var(--exito)]",
        aviso: "bg-[color-mix(in_srgb,var(--aviso)_15%,transparent)] text-[var(--aviso)]",
        peligro: "bg-[color-mix(in_srgb,var(--peligro)_12%,transparent)] text-[var(--peligro)]",
        contorno: "border border-[var(--borde)] text-[var(--texto-suave)]",
      },
    },
    defaultVariants: { tono: "neutro" },
  },
);

export function Badge({
  className,
  tono,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof variantesBadge>) {
  return <span className={cn(variantesBadge({ tono }), className)} {...props} />;
}
