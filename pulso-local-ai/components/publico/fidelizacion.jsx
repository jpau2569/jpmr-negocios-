"use client";
// ============================================================================
//  Fidelización — "recibe el menú, novedades y próximos eventos"
// ----------------------------------------------------------------------------
//  Aquí está el verdadero producto: convertir a alguien que ha escaneado un QR
//  en un contacto al que el negocio puede avisar. Tres reglas:
//
//   · El consentimiento es obligatorio y la casilla NO viene marcada. Una
//     casilla premarcada invalida el consentimiento (art. 7 RGPD).
//   · Se guarda la VERSIÓN del texto legal aceptado, no solo un "sí".
//   · En el MVP no se manda ni un mensaje automático. Se captan segmentos y ya:
//     automatizar envíos sin tener el circuito legal cerrado es meter al
//     negocio en un problema, no hacerle un favor.
// ============================================================================
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Seccion, Tarjeta, Aviso } from "@/components/ui/basicos";
import { Boton } from "@/components/ui/boton";
import { Campo, Entrada, Seleccion, Casilla, Honeypot } from "@/components/ui/campo";
import { esquemaLead } from "@/lib/schemas/formularios";
import { enviar } from "@/lib/enviar";
import { medir } from "@/lib/analitica";
const INTERESES = [
    { valor: "daily_menu", texto: "El menú del día" },
    { valor: "special_menus", texto: "Menús especiales" },
    { valor: "events", texto: "Eventos" },
    { valor: "promotions", texto: "Promociones" },
];
export const TEXTO_CONSENTIMIENTO = "Acepto recibir el menú del día, novedades y eventos del negocio por el canal que he indicado. " +
    "Puedo darme de baja en cualquier momento escribiendo al propio negocio. Mis datos no se ceden a terceros.";
export function BloqueFidelizacion({ espacio }) {
    const { negocio } = espacio;
    const [hecho, setHecho] = useState(null);
    const [fallo, setFallo] = useState(null);
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm({
        resolver: zodResolver(esquemaLead),
        defaultValues: { slug: negocio.slug, channel: "whatsapp", interests: [] },
    });
    async function alEnviar(datos) {
        setFallo(null);
        const r = await enviar("/api/public/lead", negocio.slug, datos);
        if (!r.ok) {
            setFallo(r.mensaje ?? "No se ha podido enviar.");
            return;
        }
        medir("lead_submit");
        setHecho({ demo: Boolean(r.soloDemo) });
    }
    if (hecho) {
        return (<Seccion id="novedades" titulo="Hecho">
        <Aviso tono="ok">
          <p className="font-semibold">Ya estás apuntado.</p>
          <p className="mt-1">
            {hecho.demo
                ? "Esto es una demostración, así que no se ha guardado nada en ningún sitio."
                : `${negocio.name} te avisará cuando haya algo que merezca la pena. Ni spam ni mensajes cada día.`}
          </p>
        </Aviso>
      </Seccion>);
    }
    return (<Seccion id="novedades" titulo="Recibe el menú, novedades y próximos eventos" descripcion="Sin spam. Solo cuando hay algo que contar.">
      <Tarjeta className="p-5">
        <form onSubmit={handleSubmit(alEnviar)} className="relative flex flex-col gap-4" noValidate>
          <Honeypot registro={register("website")}/>

          <Campo etiqueta="Tu nombre" id="lead-nombre" error={errors.name?.message}>
            <Entrada id="lead-nombre" autoComplete="name" error={Boolean(errors.name)} {...register("name")}/>
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Teléfono" id="lead-telefono" error={errors.phone?.message} pista="O déjanos el correo">
              <Entrada id="lead-telefono" type="tel" inputMode="tel" autoComplete="tel" error={Boolean(errors.phone)} {...register("phone")}/>
            </Campo>
            <Campo etiqueta="Correo" id="lead-email" error={errors.email?.message}>
              <Entrada id="lead-email" type="email" autoComplete="email" error={Boolean(errors.email)} {...register("email")}/>
            </Campo>
          </div>

          <Campo etiqueta="¿Por dónde prefieres que te avisemos?" id="lead-canal">
            <Seleccion id="lead-canal" {...register("channel")}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Correo</option>
              <option value="sms">SMS</option>
            </Seleccion>
          </Campo>

          <fieldset>
            <legend className="text-sm font-medium">¿Qué te interesa?</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {INTERESES.map((i) => (<label key={i.valor} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" value={i.valor} className="h-4.5 w-4.5 accent-[var(--negocio-acento)]" {...register("interests")}/>
                  <span className="text-[var(--negocio-tenue)]">{i.texto}</span>
                </label>))}
            </div>
          </fieldset>

          <Casilla id="lead-consent" error={errors.consent?.message} {...register("consent")}>
            {TEXTO_CONSENTIMIENTO}
          </Casilla>

          {fallo ? <Aviso tono="error">{fallo}</Aviso> : null}

          <Boton type="submit" tamano="bloque" disabled={isSubmitting}>
            {isSubmitting ? "Enviando…" : "Apuntarme"}
          </Boton>
        </form>
      </Tarjeta>
    </Seccion>);
}
