import Link from "next/link";
import { Icono } from "@/components/ui/icono";
import { Button } from "@/components/ui/button";

export function MensajeExito({
  titulo,
  mensaje,
  slug,
  whatsapp,
}: {
  titulo: string;
  mensaje: string;
  slug: string;
  whatsapp?: string | null;
}) {
  return (
    <div className="animar-entrada space-y-4 rounded-[var(--radio)] border border-[var(--exito)] bg-[color-mix(in_srgb,var(--exito)_8%,transparent)] p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--exito)] text-white">
        <Icono nombre="ok" className="size-6" />
      </span>
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="text-sm text-[var(--texto-suave)]">{mensaje}</p>
      <div className="flex flex-col gap-2 pt-2">
        {whatsapp ? (
          <Button asChild variant="acento" ancho="completo">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              Escribir por WhatsApp
            </a>
          </Button>
        ) : null}
        <Button asChild variant="contorno" ancho="completo">
          <Link href={`/b/${slug}`}>Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
