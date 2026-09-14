"use client";
// ============================================================================
//  Reserva de mesa
// ----------------------------------------------------------------------------
//  La reserva NO se confirma sola. Sale como "solicitud recibida" y el local
//  contesta. Confirmar automáticamente una mesa que no se sabe si está libre
//  es la forma más rápida de que un cliente se plante en la puerta un sábado a
//  las nueve y no vuelva nunca.
//
//  El aviso de alergias se pide como texto libre corto y voluntario, para
//  preparar el servicio. No es un historial médico y así se dice.
// ============================================================================
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton, EnlaceBoton } from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto, Seleccion, Casilla, Honeypot } from "@/components/ui/campo";
import { esquemaReserva } from "@/lib/schemas/formularios";
import { enviar } from "@/lib/enviar";
import { medir } from "@/lib/analitica";
import { hoyISO, sumaDias, fechaLarga } from "@/lib/utils";
import { enlaceWhatsapp, enlaceTelefono } from "@/lib/whatsapp";
const OCASIONES = [
    { valor: "lunch", texto: "Comida" },
    { valor: "dinner", texto: "Cena" },
    { valor: "birthday", texto: "Cumpleaños" },
    { valor: "group", texto: "Grupo" },
    { valor: "event", texto: "Evento" },
    { valor: "other", texto: "Otro" },
];
export const TEXTO_RGPD_RESERVA = "Acepto que el negocio use mi nombre y teléfono para gestionar esta reserva y contactarme sobre ella.";
export function FormularioReserva({ slug, negocio, telefono, whatsapp }) {
    const [hecho, setHecho] = useState(null);
    const [fallo, setFallo] = useState(null);
    const { register, handleSubmit, watch, formState: { errors, isSubmitting }, } = useForm({
        resolver: zodResolver(esquemaReserva),
        defaultValues: {
            slug,
            service_date: hoyISO(),
            service_time: "21:00",
            party_size: 2,
            occasion: "other",
        },
    });
    async function alEnviar(datos) {
        setFallo(null);
        const r = await enviar("/api/public/reservation", slug, datos);
        if (!r.ok) {
            setFallo(r.mensaje ?? "No se ha podido enviar.");
            return;
        }
        medir("reservation_submit");
        setHecho({ id: r.id, demo: Boolean(r.soloDemo) });
    }
    const wasap = enlaceWhatsapp(whatsapp, negocio, { tipo: "reserva" });
    const tel = enlaceTelefono(telefono);
    if (hecho) {
        return (<Tarjeta className="p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Solicitud recibida</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--negocio-tenue)]">
          {negocio} contactará contigo para confirmar la disponibilidad.
          {hecho.id ? <> Tu referencia es <strong className="text-[var(--negocio-texto)]">{hecho.id}</strong>.</> : null}
        </p>
        <Aviso className="mt-4">
          La mesa <strong>no está reservada todavía</strong>. Si es para hoy o para dentro de poco,
          lo más rápido es mandarlo por WhatsApp o llamar.
        </Aviso>
        {hecho.demo ? (<Aviso tono="error" className="mt-3">
            Esto es una demostración: la solicitud no se ha guardado en ningún sitio y nadie la
            va a leer. Para reservar de verdad, llama al local.
          </Aviso>) : null}
        <div className="mt-5 flex flex-wrap gap-2.5">
          {wasap ? (<EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal" onClick={() => medir("whatsapp_click")}>
              Mandarlo por WhatsApp
            </EnlaceBoton>) : null}
          {tel ? (<EnlaceBoton href={tel} variante="contorno" onClick={() => medir("call_click")}>
              Llamar al local
            </EnlaceBoton>) : null}
        </div>
      </Tarjeta>);
    }
    const dia = watch("service_date");
    return (<Tarjeta className="p-6">
      <form onSubmit={handleSubmit(alEnviar)} className="relative flex flex-col gap-4" noValidate onFocusCapture={() => medir("reservation_start")}>
        <Honeypot registro={register("website")}/>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tu nombre" id="rv-nombre" requerido error={errors.name?.message}>
            <Entrada id="rv-nombre" autoComplete="name" error={Boolean(errors.name)} {...register("name")}/>
          </Campo>
          <Campo etiqueta="Teléfono" id="rv-telefono" requerido error={errors.phone?.message} pista="Para confirmarte la mesa">
            <Entrada id="rv-telefono" type="tel" inputMode="tel" autoComplete="tel" error={Boolean(errors.phone)} {...register("phone")}/>
          </Campo>
        </div>

        <Campo etiqueta="Correo" id="rv-email" error={errors.email?.message} pista="Opcional">
          <Entrada id="rv-email" type="email" autoComplete="email" error={Boolean(errors.email)} {...register("email")}/>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Día" id="rv-dia" requerido error={errors.service_date?.message}>
            <Entrada id="rv-dia" type="date" min={hoyISO()} max={sumaDias(hoyISO(), 120)} error={Boolean(errors.service_date)} {...register("service_date")}/>
          </Campo>
          <Campo etiqueta="Hora" id="rv-hora" requerido error={errors.service_time?.message}>
            <Entrada id="rv-hora" type="time" step={900} error={Boolean(errors.service_time)} {...register("service_time")}/>
          </Campo>
          <Campo etiqueta="Personas" id="rv-personas" requerido error={errors.party_size?.message}>
            <Entrada id="rv-personas" type="number" inputMode="numeric" min={1} max={200} error={Boolean(errors.party_size)} {...register("party_size")}/>
          </Campo>
        </div>

        {dia ? (<p className="-mt-1 text-xs capitalize text-[var(--negocio-tenue)]">{fechaLarga(dia)}</p>) : null}

        <Campo etiqueta="¿Qué celebráis?" id="rv-ocasion">
          <Seleccion id="rv-ocasion" {...register("occasion")}>
            {OCASIONES.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
          </Seleccion>
        </Campo>

        <Campo etiqueta="Alergias o intolerancias" id="rv-alergias" pista="Opcional, para poder prepararlo. Confírmalo también al llegar con el personal." error={errors.allergies_note?.message}>
          <Entrada id="rv-alergias" placeholder="Celíaco, alergia a frutos secos…" {...register("allergies_note")}/>
        </Campo>

        <Campo etiqueta="Algo más que debamos saber" id="rv-comentarios" error={errors.comments?.message}>
          <AreaTexto id="rv-comentarios" placeholder="Trona, mesa tranquila, silla de ruedas…" {...register("comments")}/>
        </Campo>

        <Casilla id="rv-consent" error={errors.consent?.message} {...register("consent")}>
          {TEXTO_RGPD_RESERVA}
        </Casilla>

        {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

        <Boton type="submit" tamano="bloque" disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : "Pedir la mesa"}
        </Boton>

        <p className="text-center text-xs text-[var(--negocio-tenue)]">
          No queda confirmada hasta que el local responda.
        </p>
      </form>
    </Tarjeta>);
}
