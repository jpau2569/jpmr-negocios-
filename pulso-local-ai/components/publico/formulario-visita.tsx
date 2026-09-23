"use client";

// ============================================================================
//  Petición de visita a un inmueble
// ----------------------------------------------------------------------------
//  Igual que la reserva de mesa, la visita NO se confirma sola, y aquí el
//  motivo es más serio: la agencia no tiene la llave a su antojo, tiene que
//  cuadrar con la propiedad o con el inquilino. Prometer "el jueves a las
//  17:00" y luego llamar para cambiarlo quema la confianza justo al empezar.
//  Por eso se pide FRANJA, no hora.
//
//  Lo de la financiación es voluntario y se dice por qué se pregunta. Nadie
//  tiene que contar sus finanzas para ver un piso, pero saberlo antes ahorra
//  visitas que no llevan a ninguna parte — a las dos partes.
// ============================================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton, EnlaceBoton } from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto, Seleccion, Casilla, Honeypot } from "@/components/ui/campo";
import { esquemaVisita, type DatosVisita } from "@/lib/schemas/formularios";
import { enviar } from "@/lib/enviar";
import { medir } from "@/lib/analitica";
import { hoyISO, sumaDias, fechaLarga } from "@/lib/utils";
import { enlaceWhatsapp, enlaceTelefono } from "@/lib/whatsapp";

interface Props {
  slug: string;
  negocio: string;
  telefono: string | null;
  whatsapp: string | null;
  /** Referencia del inmueble. Vacío = petición general desde el listado. */
  referencia?: string;
  tituloInmueble?: string;
}

const FRANJAS = [
  { valor: "indiferente", texto: "Me da igual" },
  { valor: "manana", texto: "Por la mañana" },
  { valor: "tarde", texto: "Por la tarde" },
] as const;

const FINANCIACION = [
  { valor: "", texto: "Prefiero no decirlo" },
  { valor: "no", texto: "No, compro sin hipoteca" },
  { valor: "si", texto: "Sí, necesitaré hipoteca" },
  { valor: "no_lo_se", texto: "Todavía no lo sé" },
] as const;

export const TEXTO_RGPD_VISITA =
  "Acepto que la agencia use mi nombre y teléfono para organizar esta visita y contactarme sobre ella.";

export function FormularioVisita({
  slug, negocio, telefono, whatsapp, referencia, tituloInmueble,
}: Props) {
  const [hecho, setHecho] = useState<{ id?: string; demo: boolean } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const {
    register, handleSubmit, watch, formState: { errors, isSubmitting },
  } = useForm<DatosVisita>({
    resolver: zodResolver(esquemaVisita),
    defaultValues: {
      slug,
      property_ref: referencia ?? "",
      preferred_slot: "indiferente",
    },
  });

  async function alEnviar(datos: DatosVisita) {
    setFallo(null);
    const r = await enviar("/api/public/visit-request", slug, datos);
    if (!r.ok) {
      setFallo(r.mensaje ?? "No se ha podido enviar.");
      return;
    }
    medir("visit_request_submit");
    setHecho({ id: r.id, demo: Boolean(r.soloDemo) });
  }

  const asunto = tituloInmueble
    ? `${tituloInmueble}${referencia ? ` (ref. ${referencia})` : ""}`
    : null;

  const wasap = enlaceWhatsapp(whatsapp, negocio, {
    tipo: "visita",
    ...(asunto ? { detalle: asunto } : {}),
  });
  const tel = enlaceTelefono(telefono);

  if (hecho) {
    return (
      <Tarjeta className="p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Petición recibida</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--negocio-tenue)]">
          {negocio} te llama para cuadrar el día y la hora.
          {hecho.id ? <> Tu referencia es <strong className="text-[var(--negocio-texto)]">{hecho.id}</strong>.</> : null}
        </p>
        <Aviso className="mt-4">
          La visita <strong>no está cerrada todavía</strong>. Hay que cuadrarla con la
          propiedad, así que la hora final te la confirmamos al llamarte.
        </Aviso>
        {hecho.demo ? (
          <Aviso tono="error" className="mt-3">
            Esto es una demostración: la petición no se ha guardado en ningún sitio y nadie
            la va a leer. Para pedir una visita de verdad, llama a la agencia.
          </Aviso>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {wasap ? (
            <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal"
              onClick={() => medir("whatsapp_click")}>
              Mandarlo por WhatsApp
            </EnlaceBoton>
          ) : null}
          {tel ? (
            <EnlaceBoton href={tel} variante="contorno" onClick={() => medir("call_click")}>
              Llamar a la agencia
            </EnlaceBoton>
          ) : null}
        </div>
      </Tarjeta>
    );
  }

  const dia = watch("preferred_date");

  return (
    <Tarjeta className="p-6">
      <form onSubmit={handleSubmit(alEnviar)} className="relative flex flex-col gap-4" noValidate
        onFocusCapture={() => medir("visit_request_start")}>
        <Honeypot registro={register("website")} />
        <input type="hidden" {...register("property_ref")} />

        {asunto ? (
          <p className="text-sm text-[var(--negocio-tenue)]">
            Visita para <strong className="text-[var(--negocio-texto)]">{asunto}</strong>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tu nombre" id="vi-nombre" requerido error={errors.name?.message}>
            <Entrada id="vi-nombre" autoComplete="name" error={Boolean(errors.name)} {...register("name")} />
          </Campo>
          <Campo etiqueta="Teléfono" id="vi-telefono" requerido error={errors.phone?.message}
            pista="Para llamarte y cuadrar la visita">
            <Entrada id="vi-telefono" type="tel" inputMode="tel" autoComplete="tel"
              error={Boolean(errors.phone)} {...register("phone")} />
          </Campo>
        </div>

        <Campo etiqueta="Correo" id="vi-email" error={errors.email?.message} pista="Opcional">
          <Entrada id="vi-email" type="email" autoComplete="email" error={Boolean(errors.email)} {...register("email")} />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="¿Qué día te vendría bien?" id="vi-dia" pista="Opcional"
            error={errors.preferred_date?.message}>
            <Entrada id="vi-dia" type="date" min={hoyISO()} max={sumaDias(hoyISO(), 90)}
              error={Boolean(errors.preferred_date)} {...register("preferred_date")} />
          </Campo>
          <Campo etiqueta="Franja" id="vi-franja">
            <Seleccion id="vi-franja" {...register("preferred_slot")}>
              {FRANJAS.map((f) => <option key={f.valor} value={f.valor}>{f.texto}</option>)}
            </Seleccion>
          </Campo>
        </div>

        {dia ? (
          <p className="-mt-1 text-xs capitalize text-[var(--negocio-tenue)]">{fechaLarga(dia)}</p>
        ) : null}

        <Campo
          etiqueta="¿Vas a necesitar hipoteca?"
          id="vi-financiacion"
          pista="Opcional. Si lo sabemos, te ahorramos ver pisos que luego no salen."
        >
          <Seleccion id="vi-financiacion" {...register("needs_financing")}>
            {FINANCIACION.map((f) => <option key={f.valor} value={f.valor}>{f.texto}</option>)}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Algo que quieras contarnos" id="vi-comentarios" error={errors.comments?.message}>
          <AreaTexto id="vi-comentarios"
            placeholder="Busco tres habitaciones, con ascensor, en esta zona…" {...register("comments")} />
        </Campo>

        <Casilla id="vi-consent" error={errors.consent?.message} {...register("consent")}>
          {TEXTO_RGPD_VISITA}
        </Casilla>

        {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

        <Boton type="submit" tamano="bloque" disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : "Pedir visita"}
        </Boton>

        <p className="text-center text-xs text-[var(--negocio-tenue)]">
          No queda cerrada hasta que la agencia te llame.
        </p>
      </form>
    </Tarjeta>
  );
}
