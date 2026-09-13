"use client";

import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Campo, Input, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { Icono } from "@/components/ui/icono";
import { Consentimiento } from "./consentimiento";
import { MensajeExito } from "./mensaje-exito";
import { useEnvio } from "@/lib/cliente/envio";
import { registrar } from "@/lib/cliente/eventos";
import { esquemaValoracion, TIPOS_INMUEBLE, type DatosValoracion, type EntradaValoracion } from "@/lib/validaciones/formularios";
import { ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";

/**
 * Embudo de valoración en seis pasos.
 *
 * Se parte en pasos por una razón concreta: en móvil, un formulario largo de
 * catorce campos se abandona; seis pantallas de dos o tres campos, no. Los datos
 * de contacto van al final, cuando la persona ya ha invertido un minuto.
 *
 * Aquí NO se calcula ninguna valoración. Se recoge la solicitud y la revisa una
 * persona: dar un número automático a quien está decidiendo sobre su casa sería
 * fingir una precisión que no tenemos.
 */

const PASOS: { titulo: string; campos: FieldPath<EntradaValoracion>[] }[] = [
  { titulo: "¿Qué tipo de inmueble es?", campos: ["tipoInmueble"] },
  { titulo: "¿Qué quieres hacer con él?", campos: ["objetivo"] },
  { titulo: "¿Dónde está?", campos: ["municipio", "zona"] },
  { titulo: "¿Cómo es?", campos: ["metros", "habitaciones", "banos"] },
  { titulo: "¿En qué estado está?", campos: ["estado"] },
  { titulo: "¿Cómo te contactamos?", campos: ["nombre", "telefono", "email", "horarioPreferido", "mensaje", "consent"] },
];

const OBJETIVOS = [
  { valor: "venta", etiqueta: "Venderlo" },
  { valor: "alquiler", etiqueta: "Alquilarlo" },
  { valor: "herencia", etiqueta: "Es una herencia" },
  { valor: "orientacion", etiqueta: "Solo quiero orientarme" },
  { valor: "otra", etiqueta: "Otra cosa" },
] as const;

const ESTADOS = [
  { valor: "a_reformar", etiqueta: "A reformar" },
  { valor: "buen_estado", etiqueta: "En buen estado" },
  { valor: "reformado", etiqueta: "Reformado" },
  { valor: "obra_nueva", etiqueta: "Obra nueva" },
  { valor: "no_lo_se", etiqueta: "No lo sé" },
] as const;

export function FormularioValoracion({
  slug,
  nombreNegocio,
  notaValoracion,
  whatsapp,
}: {
  slug: string;
  nombreNegocio: string;
  notaValoracion?: string | null;
  whatsapp?: string | null;
}) {
  const [paso, setPaso] = useState(0);
  const { enviar, enviando, resultado } = useEnvio("/api/publico/valoracion");

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EntradaValoracion, unknown, DatosValoracion>({
    resolver: zodResolver(esquemaValoracion),
    mode: "onTouched",
    defaultValues: {
      businessSlug: slug,
      tipoInmueble: "piso",
      objetivo: "venta",
      consent: false as unknown as true,
    },
  });

  if (resultado?.ok) {
    return (
      <MensajeExito
        titulo="Hemos recibido tu solicitud"
        mensaje={resultado.mensaje ?? `Un profesional de ${nombreNegocio} revisará los datos y contactará contigo.`}
        slug={slug}
        whatsapp={whatsapp}
      />
    );
  }

  const actual = PASOS[paso]!;
  const ultimo = paso === PASOS.length - 1;

  async function siguiente() {
    const valido = await trigger(actual.campos);
    if (!valido) return;
    if (paso === 0) void registrar(slug, "valuation_start");
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }

  const objetivoActual = watch("objetivo");
  const tipoActual = watch("tipoInmueble");
  const estadoActual = watch("estado");

  return (
    <form
      onSubmit={handleSubmit(async (datos) => {
        await enviar({ ...datos, businessSlug: slug });
      })}
      className="space-y-5"
      noValidate
    >
      <div>
        <div className="flex items-center justify-between text-xs text-[var(--texto-suave)]">
          <span>
            Paso {paso + 1} de {PASOS.length}
          </span>
          <span>{Math.round(((paso + 1) / PASOS.length) * 100)} %</span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--superficie-2)]"
          role="progressbar"
          aria-valuenow={paso + 1}
          aria-valuemin={1}
          aria-valuemax={PASOS.length}
          aria-label="Progreso del formulario"
        >
          <div
            className="h-full rounded-full bg-[var(--acento)] transition-all"
            style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }}
          />
        </div>
      </div>

      <h2 className="text-xl font-bold tracking-tight">{actual.titulo}</h2>

      {paso === 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIPOS_INMUEBLE.map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setValue("tipoInmueble", tipo, { shouldValidate: true })}
              aria-pressed={tipoActual === tipo}
              className={`min-h-12 rounded-[var(--radio)] border px-3 py-2 text-sm font-medium ${
                tipoActual === tipo
                  ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                  : "border-[var(--borde)] bg-[var(--superficie)]"
              }`}
            >
              {ETIQUETA_TIPO_INMUEBLE[tipo]}
            </button>
          ))}
        </div>
      ) : null}

      {paso === 1 ? (
        <div className="space-y-2">
          {OBJETIVOS.map((objetivo) => (
            <button
              key={objetivo.valor}
              type="button"
              onClick={() => setValue("objetivo", objetivo.valor, { shouldValidate: true })}
              aria-pressed={objetivoActual === objetivo.valor}
              className={`flex min-h-12 w-full items-center justify-between rounded-[var(--radio)] border px-4 py-3 text-left text-sm font-medium ${
                objetivoActual === objetivo.valor
                  ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                  : "border-[var(--borde)] bg-[var(--superficie)]"
              }`}
            >
              {objetivo.etiqueta}
              {objetivoActual === objetivo.valor ? <Icono nombre="ok" className="size-5" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {paso === 2 ? (
        <div className="space-y-4">
          <Campo etiqueta="Municipio" obligatorio error={errors.municipio?.message}>
            <Input {...register("municipio")} placeholder="Oviedo, Gijón, Llanera…" autoComplete="address-level2" />
          </Campo>
          <Campo etiqueta="Zona o barrio (opcional)" error={errors.zona?.message}>
            <Input {...register("zona")} placeholder="Centro, La Corredoria…" />
          </Campo>
        </div>
      ) : null}

      {paso === 3 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Metros construidos" error={errors.metros?.message}>
            <Input {...register("metros")} type="number" inputMode="numeric" min={10} placeholder="95" />
          </Campo>
          <Campo etiqueta="Habitaciones" error={errors.habitaciones?.message}>
            <Input {...register("habitaciones")} type="number" inputMode="numeric" min={0} placeholder="3" />
          </Campo>
          <Campo etiqueta="Baños" error={errors.banos?.message}>
            <Input {...register("banos")} type="number" inputMode="numeric" min={0} placeholder="1" />
          </Campo>
        </div>
      ) : null}

      {paso === 4 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            {ESTADOS.map((estado) => (
              <button
                key={estado.valor}
                type="button"
                onClick={() => setValue("estado", estado.valor, { shouldValidate: true })}
                aria-pressed={estadoActual === estado.valor}
                className={`flex min-h-12 w-full items-center justify-between rounded-[var(--radio)] border px-4 py-3 text-left text-sm font-medium ${
                  estadoActual === estado.valor
                    ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                    : "border-[var(--borde)] bg-[var(--superficie)]"
                }`}
              >
                {estado.etiqueta}
                {estadoActual === estado.valor ? <Icono nombre="ok" className="size-5" /> : null}
              </button>
            ))}
          </div>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-2 text-sm font-medium">¿Tiene alguna de estas cosas?</legend>
            {[
              { campo: "ascensor", etiqueta: "Ascensor" },
              { campo: "terraza", etiqueta: "Terraza" },
              { campo: "garaje", etiqueta: "Garaje" },
              { campo: "reforma", etiqueta: "Reforma reciente" },
            ].map((extra) => (
              <label
                key={extra.campo}
                className="flex min-h-12 items-center gap-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--marca)]"
                  {...register(extra.campo as "ascensor" | "terraza" | "garaje" | "reforma")}
                />
                {extra.etiqueta}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}

      {paso === 5 ? (
        <div className="space-y-4">
          <Campo etiqueta="Nombre" obligatorio error={errors.nombre?.message}>
            <Input {...register("nombre")} autoComplete="name" />
          </Campo>
          <Campo etiqueta="Teléfono" obligatorio error={errors.telefono?.message}>
            <Input {...register("telefono")} type="tel" inputMode="tel" autoComplete="tel" placeholder="600 000 000" />
          </Campo>
          <Campo etiqueta="Correo (opcional)" error={errors.email?.message}>
            <Input {...register("email")} type="email" autoComplete="email" />
          </Campo>
          <Campo etiqueta="Mejor horario de contacto (opcional)" error={errors.horarioPreferido?.message}>
            <Input {...register("horarioPreferido")} placeholder="Mañanas, tardes, indiferente…" />
          </Campo>
          <Campo etiqueta="Algo más que debamos saber (opcional)" error={errors.mensaje?.message}>
            <Textarea {...register("mensaje")} rows={3} />
          </Campo>

          {notaValoracion ? <Aviso tono="info">{notaValoracion}</Aviso> : null}

          <Consentimiento
            registroConsentimiento={register("consent")}
            registroHoneypot={register("companyWebsite")}
            error={errors.consent?.message}
          />
        </div>
      ) : null}

      {resultado?.error ? <Aviso tono="peligro">{resultado.error}</Aviso> : null}

      <div className="flex gap-2">
        {paso > 0 ? (
          <Button type="button" variant="contorno" size="lg" onClick={() => setPaso((p) => p - 1)}>
            Atrás
          </Button>
        ) : null}
        {ultimo ? (
          <Button type="submit" size="lg" ancho="completo" disabled={enviando}>
            {enviando ? "Enviando…" : "Pedir valoración"}
          </Button>
        ) : (
          <Button type="button" size="lg" ancho="completo" onClick={siguiente}>
            Continuar
            <Icono nombre="flecha" />
          </Button>
        )}
      </div>

      <input type="hidden" {...register("businessSlug")} value={slug} />
    </form>
  );
}
