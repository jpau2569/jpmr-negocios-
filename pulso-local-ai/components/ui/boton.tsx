// ============================================================================
//  Botón
// ----------------------------------------------------------------------------
//  Patrón de shadcn/ui (cva + cn + asChild implícito vía <a>), pero escrito
//  aquí en vez de instalado por su CLI: así el proyecto no depende de que la
//  CLI funcione ni de Radix para algo que son cuatro variantes.
//
//  Altura mínima 44px en las variantes normales: es el objetivo táctil mínimo
//  recomendado, y esto se usa con el pulgar en una mesa de bar.
// ============================================================================

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const estilosBoton = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
    "transition-[transform,background-color,opacity] duration-150 " +
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 " +
    "whitespace-nowrap select-none",
  {
    variants: {
      variante: {
        principal:
          "bg-[var(--negocio-acento)] text-[var(--negocio-sobre-acento)] hover:brightness-110",
        acento:
          "bg-[var(--negocio-acento2)] text-[var(--negocio-sobre-acento2)] hover:brightness-110",
        contorno:
          "border border-[var(--negocio-borde)] bg-transparent text-[var(--negocio-texto)] hover:bg-white/5",
        plano:
          "bg-white/5 text-[var(--negocio-texto)] hover:bg-white/10",
        fantasma:
          "bg-transparent text-[var(--negocio-tenue)] hover:text-[var(--negocio-texto)]",
      },
      tamano: {
        sm: "h-9 px-3.5 text-sm",
        md: "min-h-11 px-5 text-[0.95rem]",
        lg: "min-h-13 px-6 text-base",
        bloque: "min-h-12 w-full px-5 text-base",
      },
    },
    defaultVariants: { variante: "principal", tamano: "md" },
  },
);

export type PropsBoton = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof estilosBoton>;

export function Boton({ className, variante, tamano, ...props }: PropsBoton) {
  return <button className={cn(estilosBoton({ variante, tamano }), className)} {...props} />;
}

export type PropsEnlaceBoton = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof estilosBoton>;

export function EnlaceBoton({ className, variante, tamano, ...props }: PropsEnlaceBoton) {
  return <a className={cn(estilosBoton({ variante, tamano }), className)} {...props} />;
}
