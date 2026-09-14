"use client";
// ============================================================================
//  Grupos y celebraciones
// ----------------------------------------------------------------------------
//  Es el formulario que más dinero mueve de toda la web: una comunión de 40 o
//  una comida de empresa valen lo que veinte menús del día. Por eso pide menos
//  que el de reserva (nadie rellena quince campos por WhatsApp) y deja al
//  negocio llamar para cerrar los detalles.
//
//  El presupuesto se pregunta como orientación y en texto libre, no con un
//  desplegable de tramos: obligar a elegir "de 20 a 30 €" espanta a quien no
//  lo tiene pensado todavía.
// ============================================================================
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton, EnlaceBoton } from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto, Casilla, Honeypot } from "@/components/ui/campo";
import { esquemaGrupo } from "@/lib/schemas/formularios";
import { enviar } from "@/lib/enviar";
import { medir } from "@/lib/analitica";
import { hoyISO, sumaDias } from "@/lib/utils";
import { enlaceWhatsapp } from "@/lib/whatsapp";
export const TEXTO_RGPD_GRUPO = "Acepto que el negocio use mis datos para preparar una propuesta y contactarme sobre esta celebración.";
export function FormularioGrupo({ slug, negocio, whatsapp }) {
    const [hecho, setHecho] = useState(null);
    const [fallo, setFallo] = useState(null);
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm({
        resolver: zodResolver(esquemaGrupo),
        defaultValues: { slug, needs_menu: false },
    });
    async function alEnviar(datos) {
        setFallo(null);
        const r = await enviar("/api/public/group-request", slug, datos);
        if (!r.ok) {
            setFallo(r.mensaje ?? "No se ha podido enviar.");
            return;
        }
        medir("group_request_submit");
        setHecho({ id: r.id, demo: Boolean(r.soloDemo) });
    }
    const wasap = enlaceWhatsapp(whatsapp, negocio, { tipo: "grupo" });
    if (hecho) {
        return (<Tarjeta className="p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Nos ponemos con ello</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--negocio-tenue)]">
          {negocio} te contactará para concretar el plan y prepararte una propuesta.
          {hecho.id ? <> Referencia: <strong className="text-[var(--negocio-texto)]">{hecho.id}</strong>.</> : null}
        </p>
        {hecho.demo ? (<Aviso tono="error" className="mt-4">
            Esto es una demostración: no se ha guardado nada. Para organizar algo de verdad,
            habla con el local.
          </Aviso>) : null}
        {wasap ? (<EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal" tamano="bloque" className="mt-5" onClick={() => medir("whatsapp_click")}>
            Contarlo también por WhatsApp
          </EnlaceBoton>) : null}
      </Tarjeta>);
    }
    return (<Tarjeta className="p-6">
      <form onSubmit={handleSubmit(alEnviar)} className="relative flex flex-col gap-4" noValidate onFocusCapture={() => medir("group_request_start")}>
        <Honeypot registro={register("website")}/>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tu nombre" id="gr-nombre" requerido error={errors.name?.message}>
            <Entrada id="gr-nombre" autoComplete="name" error={Boolean(errors.name)} {...register("name")}/>
          </Campo>
          <Campo etiqueta="Teléfono" id="gr-telefono" requerido error={errors.phone?.message}>
            <Entrada id="gr-telefono" type="tel" inputMode="tel" autoComplete="tel" error={Boolean(errors.phone)} {...register("phone")}/>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="¿Qué día?" id="gr-dia" pista="Si aún no lo sabes, déjalo vacío" error={errors.service_date?.message}>
            <Entrada id="gr-dia" type="date" min={hoyISO()} max={sumaDias(hoyISO(), 400)} {...register("service_date")}/>
          </Campo>
          <Campo etiqueta="¿Cuántos sois?" id="gr-personas" error={errors.party_size?.message}>
            <Entrada id="gr-personas" type="number" inputMode="numeric" min={1} max={500} placeholder="Aproximado" {...register("party_size")}/>
          </Campo>
        </div>

        <Campo etiqueta="¿Qué celebráis?" id="gr-celebracion" error={errors.celebration?.message}>
          <Entrada id="gr-celebracion" placeholder="Comunión, cumpleaños, comida de empresa…" {...register("celebration")}/>
        </Campo>

        <Campo etiqueta="Presupuesto por persona" id="gr-presupuesto" pista="Orientativo y opcional. Nos ayuda a proponerte algo que encaje." error={errors.budget_hint?.message}>
          <Entrada id="gr-presupuesto" placeholder="Sobre 30 €, o lo que nos recomendéis" {...register("budget_hint")}/>
        </Campo>

        <Casilla id="gr-menu" {...register("needs_menu")}>
          Nos interesa un menú cerrado para el grupo
        </Casilla>

        <Campo etiqueta="Cuéntanos tu plan" id="gr-comentarios" error={errors.comments?.message}>
          <AreaTexto id="gr-comentarios" rows={4} placeholder="Somos unos 25, hay dos celíacos y tres niños, nos gustaría zona reservada…" {...register("comments")}/>
        </Campo>

        <Casilla id="gr-consent" error={errors.consent?.message} {...register("consent")}>
          {TEXTO_RGPD_GRUPO}
        </Casilla>

        {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

        <Boton type="submit" tamano="bloque" disabled={isSubmitting}>
          {isSubmitting ? "Enviando…" : "Contar mi plan"}
        </Boton>
      </form>
    </Tarjeta>);
}
