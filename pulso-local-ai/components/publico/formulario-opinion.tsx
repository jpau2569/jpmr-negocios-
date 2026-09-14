"use client";

// ============================================================================
//  Opinión y reseña
// ----------------------------------------------------------------------------
//  LA REGLA QUE NO SE ROMPE: el botón de Google se enseña con CUALQUIER
//  puntuación. No hay una sola rama del código donde `rating` decida si
//  aparece o no.
//
//  Por qué, más allá de la ética: filtrar reseñas por puntuación ("review
//  gating") incumple las políticas de Google, que puede retirar TODAS las
//  reseñas del negocio o penalizar su ficha. Un cliente contento y con buena
//  ficha vale más que tres reseñas amañadas.
//
//  Lo que sí cambia con la puntuación es el TEXTO, porque a alguien que lo ha
//  pasado mal no se le pide que lo cuente en internet; se le pregunta qué
//  falló. Pero el botón está ahí, por si quiere.
//
//  Tampoco se incentiva (ni un descuento por reseñar) ni se piden reseñas
//  positivas: las dos cosas están prohibidas por Google y por la normativa de
//  prácticas comerciales desleales.
// ============================================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton, EnlaceBoton } from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto, Casilla, Honeypot } from "@/components/ui/campo";
import { esquemaFeedback, type DatosFeedback } from "@/lib/schemas/formularios";
import { enviar } from "@/lib/enviar";
import { medir } from "@/lib/analitica";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  negocio: string;
  /** URL oficial de Google. null = no hay botón. Nunca se construye a mano. */
  reviewUrl: string | null;
}

const CARAS = ["😖", "🙁", "😐", "🙂", "😄"] as const;

export function FormularioOpinion({ slug, negocio, reviewUrl }: Props) {
  const [nota, setNota] = useState<number | null>(null);
  const [enviado, setEnviado] = useState<{ demo: boolean } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<DatosFeedback>({
    resolver: zodResolver(esquemaFeedback),
    defaultValues: { slug, wants_contact: false },
  });

  const quiereContacto = watch("wants_contact");

  function elegirNota(valor: number) {
    setNota(valor);
    setValue("rating", valor, { shouldValidate: true });
    medir("feedback_start");
  }

  async function alEnviar(datos: DatosFeedback) {
    setFallo(null);
    const r = await enviar("/api/public/feedback", slug, datos);
    if (!r.ok) {
      setFallo(r.mensaje ?? "No se ha podido enviar.");
      return;
    }
    medir("feedback_submit");
    setEnviado({ demo: Boolean(r.soloDemo) });
  }

  // El botón de Google. Se define UNA vez y se usa igual en los dos caminos,
  // para que no haya manera de que dependa de la nota.
  const botonGoogle = reviewUrl ? (
    <EnlaceBoton
      href={reviewUrl}
      target="_blank"
      rel="noopener"
      variante="contorno"
      tamano="bloque"
      onClick={() => medir("google_review_click")}
    >
      Si quieres, comparte tu experiencia en Google
    </EnlaceBoton>
  ) : null;

  if (enviado) {
    const baja = (nota ?? 3) <= 3;
    return (
      <Tarjeta className="p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          {baja ? "Gracias por decírnoslo." : "Nos alegra que hayas disfrutado."}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--negocio-tenue)]">
          {baja
            ? `Lo lee el dueño de ${negocio}, no una máquina. Lo tendrá en cuenta.`
            : `Gracias por contárnoslo. A ${negocio} le alegra el día leer esto.`}
        </p>
        {enviado.demo ? (
          <Aviso className="mt-4">
            Esto es una demostración: tu opinión no se ha guardado en ningún sitio.
          </Aviso>
        ) : null}
        {botonGoogle ? <div className="mt-5">{botonGoogle}</div> : null}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="p-6">
      <form onSubmit={handleSubmit(alEnviar)} className="relative flex flex-col gap-5" noValidate>
        <Honeypot registro={register("website")} />

        <fieldset>
          <legend className="font-[family-name:var(--font-display)] text-xl">
            ¿Cómo ha sido tu experiencia en {negocio}?
          </legend>
          <div className="mt-4 flex justify-between gap-2" role="radiogroup" aria-label="Puntuación del 1 al 5">
            {CARAS.map((cara, i) => {
              const valor = i + 1;
              const activa = nota === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  aria-label={`${valor} de 5`}
                  onClick={() => elegirNota(valor)}
                  className={cn(
                    "flex-1 rounded-xl border py-3 text-2xl transition-all",
                    activa
                      ? "border-[var(--negocio-acento)] bg-[var(--negocio-acento)]/15 scale-105"
                      : "border-[var(--negocio-borde)] opacity-60 hover:opacity-100",
                  )}
                >
                  {cara}
                </button>
              );
            })}
          </div>
          {errors.rating ? (
            <p role="alert" className="mt-2 text-xs text-red-300">{errors.rating.message}</p>
          ) : null}
          <input type="hidden" {...register("rating")} />
        </fieldset>

        {nota !== null ? (
          <>
            <Campo
              etiqueta={nota <= 3 ? "¿Qué podemos mejorar?" : "¿Qué es lo que más te ha gustado?"}
              id="op-comentario"
              pista="Esto lo lee solo el negocio. No se publica en ningún sitio."
              error={errors.comment?.message}
            >
              <AreaTexto
                id="op-comentario"
                rows={4}
                placeholder={nota <= 3 ? "Cuéntanoslo con confianza…" : "Lo que quieras contarnos…"}
                error={Boolean(errors.comment)}
                {...register("comment")}
              />
            </Campo>

            <Casilla id="op-contacto" {...register("wants_contact")}>
              Quiero que me contesten
            </Casilla>

            {quiereContacto ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Tu nombre" id="op-nombre" error={errors.contact_name?.message}>
                  <Entrada id="op-nombre" autoComplete="name" {...register("contact_name")} />
                </Campo>
                <Campo etiqueta="Teléfono" id="op-telefono" error={errors.contact_phone?.message}>
                  <Entrada id="op-telefono" type="tel" inputMode="tel" autoComplete="tel" {...register("contact_phone")} />
                </Campo>
              </div>
            ) : null}

            {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

            <Boton type="submit" tamano="bloque" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviar mi opinión"}
            </Boton>
          </>
        ) : null}

        {/* Visible desde el primer momento y con cualquier nota, incluso antes
            de puntuar. Es voluntario y no se incentiva de ninguna forma. */}
        {botonGoogle ? (
          <div className="border-t border-[var(--negocio-borde)] pt-5">{botonGoogle}</div>
        ) : null}
      </form>
    </Tarjeta>
  );
}
