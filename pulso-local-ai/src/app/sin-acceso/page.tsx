import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sin acceso" };

export default function SinAcceso() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">Tu cuenta no tiene acceso a ningún negocio</h1>
      <p className="text-[var(--texto-suave)]">
        Si acabas de registrarte, pide a quien administra el espacio que te añada al equipo. Si crees que es un
        error, vuelve a entrar con otra cuenta.
      </p>
      <div className="flex flex-col gap-2">
        <Button asChild ancho="completo">
          <Link href="/login">Entrar con otra cuenta</Link>
        </Button>
        <Button asChild variant="contorno" ancho="completo">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </main>
  );
}
