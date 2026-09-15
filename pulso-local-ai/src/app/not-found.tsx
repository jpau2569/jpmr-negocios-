import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Página no encontrada" };

export default function NoEncontrada() {
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <p className="text-xs font-bold tracking-widest text-[var(--acento)] uppercase">Pulso Local AI</p>
      <h1 className="text-2xl font-bold tracking-tight">Aquí no hay nada</h1>
      <p className="text-[var(--texto-suave)]">
        Puede que el enlace esté mal escrito o que ese espacio ya no exista.
      </p>
      <Button asChild size="lg">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </main>
  );
}
