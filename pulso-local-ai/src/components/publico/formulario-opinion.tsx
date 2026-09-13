"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Campo, Input, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { Icono } from "@/components/ui/icono";
import { Consentimiento } from "./consentimiento";
import { useEnvio } from "@/lib/cliente/envio";
import { registrar } from "@/lib/cliente/eventos";
import { esquemaOpinion, type DatosOpinion, type EntradaOpinion } from "@/lib/validaciones/formularios";

/**
 * Opinión privada y acceso a reseñas.
 *
 * Cómo está hecho y por qué:
 *
 *   · El enlace a Google se ofrece SIEMPRE, con un 1 y con un 5. Lo único que
 *     cambia es el texto que lo acompaña, porque no se le habla igual a quien
 *     se ha ido contento que a quien no.
 *   · No se ofrece nada a cambio de una reseña, ni descuentos ni sorteos.
 *   · Dejar una opinión no exige dar datos personales. Solo si la persona pide
 *     que la llamen se piden contacto y consentimiento.
 *
 * Filtrar quién ve el enlace según la nota es ilegal en varios sitios y desleal
 * en todos. Por eso no se puede configurar: no es una opción del panel.
 */
export function FormularioOpinion({
  slug,
  nombreNegocio,
  urlResenas,
  textoAlto,
  textoBajo,
}: {
  slug: string;
  nombreNegocio: string;
  urlResenas?: string | null;
  textoAlto?: string | null;
  textoBajo?: string | null;
}) {
  const [puntuacion, setPuntuacion] = useState(0);
  const { enviar, enviando, resultado } = useEnvio("/api/publico/opinion");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EntradaOpinion, unknown, DatosOpinion>({
    resolver: zodResolver(esquemaOpinion),
    defaultValues: { businessSlug: slug, quiereContacto: false, puntuacion: 0 },
  });

  const quiereContacto = watch("quiereContacto");

  function elegirPuntuacion(valor: number) {
    setPuntuacion(valor);
    setValue("puntuacion", valor, { shouldValidate: true });
    if (valor === 1) void registrar(slug, "feedback_start");
  }

  const enviado = resultado?.ok === true;
  const textoResena = puntuacion >= 4 ? textoAlto : textoBajo;

  return (
    <div className="space-y-6">
      {!enviado ? (
        <form
          onSubmit={handleSubmit(async (datos) => {
            await enviar({ ...datos, businessSlug: slug, puntuacion });
          })}
          className="space-y-4"
          noValidate
        >
          <input type="hidden" {...register("businessSlug")} value={slug} />
          <input type="hidden" {...register("puntuacion")} value={puntuacion} />

          <fieldset>
            <legend className="text-lg font-bold tracking-tight">
              ¿Cómo ha sido tu experiencia con {nombreNegocio}?
            </legend>
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Puntuación de 1 a 5 estrellas">
              {[1, 2, 3, 4, 5].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={puntuacion === valor}
                  aria-label={`${valor} ${valor === 1 ? "estrella" : "estrellas"}`}
                  onClick={() => elegirPuntuacion(valor)}
                  className={`flex size-14 items-center justify-center rounded-[var(--radio)] border transition-colors ${
                    valor <= puntuacion
                      ? "border-[var(--acento)] bg-[var(--acento)] text-[var(--acento-contraste)]"
                      : "border-[var(--borde)] bg-[var(--superficie)] text-[var(--texto-suave)]"
                  }`}
                >
                  <Icono nombre="estrella" className="size-7" />
                </button>
              ))}
            </div>
            {errors.puntuacion ? (
              <p role="alert" className="mt-2 text-sm font-medium text-[var(--peligro)]">
                Elige de 1 a 5 estrellas
              </p>
            ) : null}
          </fieldset>

          {puntuacion > 0 ? (
            <div className="animar-entrada space-y-4">
              <Campo etiqueta="Cuéntanos lo que quieras (privado)" error={errors.comentario?.message}>
                <Textarea
                  {...register("comentario")}
                  rows={4}
                  placeholder={
                    puntuacion >= 4
                      ? "¿Qué es lo que mejor te ha funcionado?"
                      : "¿Qué podríamos haber hecho mejor?"
                  }
                />
              </Campo>

              <label className="flex min-h-12 items-center gap-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm">
                <input type="checkbox" className="size-5 accent-[var(--marca)]" {...register("quiereContacto")} />
                Quiero que el equipo se ponga en contacto conmigo
              </label>

              {quiereContacto ? (
                <div className="animar-entrada space-y-4">
                  <Campo etiqueta="Nombre" error={errors.nombre?.message}>
                    <Input {...register("nombre")} autoComplete="name" />
                  </Campo>
                  <Campo etiqueta="Teléfono" error={errors.telefono?.message}>
                    <Input {...register("telefono")} type="tel" inputMode="tel" autoComplete="tel" />
                  </Campo>
                  <Campo etiqueta="Correo (opcional)" error={errors.email?.message}>
                    <Input {...register("email")} type="email" autoComplete="email" />
                  </Campo>
                  <Consentimiento
                    registroConsentimiento={register("consent")}
                    registroHoneypot={register("companyWebsite")}
                    error={errors.consent?.message}
                    texto="Autorizo que el equipo use estos datos para ponerse en contacto conmigo sobre esta opinión."
                  />
                </div>
              ) : null}

              {resultado?.error ? <Aviso tono="peligro">{resultado.error}</Aviso> : null}

              <Button type="submit" size="lg" ancho="completo" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar opinión"}
              </Button>
            </div>
          ) : null}
        </form>
      ) : (
        <Aviso tono="exito" titulo="Gracias por contárnoslo">
          {resultado?.mensaje ?? "Nos ayuda a mejorar."}
        </Aviso>
      )}

      {urlResenas ? (
        <div className="space-y-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
          <p className="text-sm text-[var(--texto-suave)]">
            {textoResena ??
              (puntuacion >= 4
                ? "Si quieres, puedes compartir tu experiencia públicamente en Google."
                : "Gracias por indicarnos cómo podemos mejorar. Nuestro equipo puede revisarlo contigo.")}
          </p>
          <Button asChild variant="contorno" ancho="completo">
            <a
              href={urlResenas}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void registrar(slug, "google_review_click")}
            >
              Escribir una reseña en Google
            </a>
          </Button>
          <p className="text-xs text-[var(--texto-suave)]">
            Es totalmente voluntario y no condiciona nada. Escribe lo que de verdad pienses.
          </p>
        </div>
      ) : null}
    </div>
  );
}
