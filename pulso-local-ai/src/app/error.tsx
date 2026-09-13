"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Pantalla de error de toda la aplicación.
 *
 * Va en la raíz y no dentro de `b/[slug]/` a propósito: el fallo típico (la base
 * de datos no responde) ocurre en el layout del negocio, y un `error.tsx` no
 * captura los errores del layout de su propio segmento, solo los de lo que hay
 * por debajo. Desde la raíz sí los recoge.
 *
 * Lo que ve alguien que acaba de escanear un cartel no puede ser una pantalla de
 * error de programador: lo importante es que siga sabiendo cómo llegar a una
 * persona.
 */
export default function ErrorAplicacion({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[pulso-local-ai] error no controlado", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Esta página no carga ahora mismo</h1>
      <p className="text-[var(--texto-suave)]">
        Es un problema nuestro, no tuyo. Vuelve a intentarlo en un momento; si tienes prisa, llama directamente a la
        oficina.
      </p>
      <Button onClick={reset} size="lg">
        Reintentar
      </Button>
    </main>
  );
}
