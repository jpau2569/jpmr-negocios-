import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Botones grandes por defecto: el cliente llega desde un QR, con el móvil en la
 * mano y a menudo de pie en la calle. `min-h-11` es el mínimo táctil cómodo.
 */
const variantesBoton = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radio)] text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primario: "bg-[var(--marca)] text-[var(--marca-contraste)] hover:bg-[var(--marca-suave)]",
        acento: "bg-[var(--acento)] text-[var(--acento-contraste)] hover:brightness-95",
        contorno: "border border-[var(--borde)] bg-[var(--superficie)] text-[var(--texto)] hover:bg-[var(--superficie-2)]",
        suave: "bg-[var(--superficie-2)] text-[var(--texto)] hover:bg-[var(--borde)]",
        fantasma: "text-[var(--texto)] hover:bg-[var(--superficie-2)]",
        peligro: "bg-[var(--peligro)] text-white hover:brightness-110",
        enlace: "text-[var(--marca)] underline underline-offset-4 hover:no-underline",
      },
      size: {
        sm: "min-h-9 px-3 py-1.5 text-sm",
        md: "min-h-11 px-4 py-2",
        lg: "min-h-13 px-6 py-3 text-base",
        icono: "size-11 p-0",
      },
      ancho: { auto: "", completo: "w-full" },
    },
    defaultVariants: { variant: "primario", size: "md", ancho: "auto" },
  },
);

export interface PropsBoton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesBoton> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, PropsBoton>(
  ({ className, variant, size, ancho, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(variantesBoton({ variant, size, ancho, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, variantesBoton };
