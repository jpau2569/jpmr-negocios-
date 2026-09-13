"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Aviso } from "@/components/ui/aviso";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { borrarMedio, marcarPortada, registrarMedio } from "@/app/dashboard/inmuebles/medios";
import type { MedioPublico } from "@/types/dominio";

const TIPOS_ACEPTADOS = "image/jpeg,image/png,image/webp,image/avif,application/pdf";
const MAXIMO_BYTES = 10 * 1024 * 1024;

/**
 * Subida de fotos y documentos.
 *
 * Sube directamente a Storage con la sesión del usuario. La ruta empieza por el
 * business_id porque la política de Storage la usa para decidir quién puede
 * escribir: nadie puede subir a la carpeta de otro negocio ni cambiándola a mano.
 */
export function GestorMedios({
  propertyId,
  businessId,
  medios,
}: {
  propertyId: string;
  businessId: string;
  medios: MedioPublico[];
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setSubiendo(true);
    setMensaje(null);
    const supabase = clienteNavegador();

    try {
      for (const archivo of Array.from(archivos)) {
        if (archivo.size > MAXIMO_BYTES) {
          setMensaje({ tono: "peligro", texto: `"${archivo.name}" pesa más de 10 MB.` });
          continue;
        }

        const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
        const ruta = `${businessId}/${propertyId}/${nombre}`;

        const { error } = await supabase.storage.from("medios").upload(ruta, archivo, {
          cacheControl: "31536000",
          upsert: false,
        });
        if (error) {
          setMensaje({ tono: "peligro", texto: `No se ha podido subir "${archivo.name}": ${error.message}` });
          continue;
        }

        const { data: publico } = supabase.storage.from("medios").getPublicUrl(ruta);
        const resultado = await registrarMedio({
          propertyId,
          url: publico.publicUrl,
          storagePath: ruta,
          kind: extension === "pdf" ? "documento" : "foto",
          altText: archivo.name.replace(/\.[^.]+$/, ""),
        });
        if (resultado.error) setMensaje({ tono: "peligro", texto: resultado.error });
      }
      setMensaje((m) => m ?? { tono: "exito", texto: "Archivos subidos" });
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Fotos y documentos</h2>
        <div>
          <input
            ref={entrada}
            type="file"
            multiple
            accept={TIPOS_ACEPTADOS}
            onChange={(e) => void subir(e.target.files)}
            className="hidden"
            id="subir-medios"
          />
          <Button type="button" variant="contorno" disabled={subiendo} onClick={() => entrada.current?.click()}>
            {subiendo ? "Subiendo…" : "Subir archivos"}
          </Button>
        </div>
      </div>

      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}

      {medios.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {medios.map((medio) => (
            <li key={medio.id} className="space-y-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--superficie-2)]">
                {medio.kind === "foto" ? (
                  <Image src={medio.url} alt={medio.alt_text ?? ""} fill sizes="200px" className="object-cover" />
                ) : (
                  <a
                    href={medio.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full items-center justify-center text-xs underline"
                  >
                    {medio.kind}
                  </a>
                )}
                {medio.is_cover ? (
                  <span className="absolute top-1 left-1 rounded bg-[var(--marca)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--marca-contraste)]">
                    Portada
                  </span>
                ) : null}
              </div>

              <div className="flex justify-between text-xs">
                {!medio.is_cover && medio.kind === "foto" ? (
                  <button
                    type="button"
                    className="underline"
                    disabled={pendiente}
                    onClick={() => iniciar(async () => void (await marcarPortada(medio.id, propertyId)))}
                  >
                    Portada
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="text-[var(--peligro)] underline"
                  disabled={pendiente}
                  onClick={() => iniciar(async () => void (await borrarMedio(medio.id, propertyId)))}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--texto-suave)]">
          Todavía no hay fotos. La primera que subas será la portada del catálogo.
        </p>
      )}
    </section>
  );
}
