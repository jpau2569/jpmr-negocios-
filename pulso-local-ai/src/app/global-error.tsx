"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Última red de seguridad.
 *
 * `error.tsx` recoge los fallos de las páginas, pero no los de un layout anidado
 * (el caso típico: la base de datos no responde mientras se carga el layout del
 * negocio). Para eso existe `global-error.tsx`, que sustituye al documento
 * entero y por eso tiene que traer su propio `<html>` y `<body>`.
 *
 * Quien ve esto acaba de escanear un cartel en la calle. El objetivo es que sepa
 * que el fallo no es suyo y que pueda reintentar.
 */
export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[pulso-local-ai] error global", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="min-h-dvh">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
          <p className="text-xs font-bold tracking-widest text-[var(--acento)] uppercase">Pulso Local AI</p>
          <h1 className="text-2xl font-bold tracking-tight">Esta página no carga ahora mismo</h1>
          <p className="text-[var(--texto-suave)]">
            Es un problema nuestro, no tuyo. Vuelve a intentarlo en un momento; si tienes prisa, llama
            directamente a la oficina.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mx-auto min-h-12 rounded-[var(--radio)] bg-[var(--marca)] px-6 font-semibold text-[var(--marca-contraste)]"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
