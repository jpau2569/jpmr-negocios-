"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { Consentimiento } from "./consentimiento";
import { MensajeExito } from "./mensaje-exito";
import { useEnvio } from "@/lib/cliente/envio";
import { esquemaContacto, type DatosContacto, type EntradaContacto } from "@/lib/validaciones/formularios";
import { ETIQUETA_TIPO_LEAD } from "@/lib/etiquetas";
import type { TipoLead } from "@/types/dominio";

const TIPOS_DISPONIBLES: TipoLead[] = [
  "seller", "buyer", "tenant", "landlord", "investor",
  "community_administration", "tax_labor_legal_consultation", "general_consultation",
];

const TITULOS: Partial<Record<TipoLead, { titulo: string; entradilla: string }>> = {
  seller: { titulo: "Quiero vender mi vivienda", entradilla: "Déjanos tus datos y te llamamos para verlo contigo." },
  buyer: { titulo: "Busco vivienda", entradilla: "Cuéntanos qué necesitas y te avisamos cuando encaje algo." },
  tenant: { titulo: "Busco alquiler", entradilla: "Dinos qué buscas y te avisamos de lo que entre." },
  landlord: { titulo: "Quiero alquilar mi vivienda", entradilla: "Te ayudamos a encontrar inquilino y a dejar el contrato en regla." },
  investor: { titulo: "Busco inversión", entradilla: "Cuéntanos tu perfil y te pasamos lo que encaje." },
  community_administration: { titulo: "Administración de fincas", entradilla: "Cuéntanos cómo es la comunidad y te preparamos una propuesta." },
  tax_labor_legal_consultation: { titulo: "Asesoría fiscal, laboral o jurídica", entradilla: "Dinos qué necesitas y te damos cita con la persona del área." },
  general_consultation: { titulo: "Solicitar una cita", entradilla: "Cuéntanos qué necesitas y cuándo te viene bien." },
};

/**
 * Formulario de contacto contextual.
 *
 * Es el mismo componente para ocho intenciones distintas: cambia el título, la
 * entradilla y el `lead_type` que se guarda. Un formulario por intención sería
 * ocho formularios que mantener y ocho sitios donde olvidarse del
 * consentimiento.
 */
export function FormularioContacto({
  slug,
  nombreNegocio,
  tipoInicial = "general_consultation",
  propertyId,
  serviceId,
  whatsapp,
  permitirCambioTipo = true,
}: {
  slug: string;
  nombreNegocio: string;
  tipoInicial?: TipoLead;
  propertyId?: string;
  serviceId?: string;
  whatsapp?: string | null;
  permitirCambioTipo?: boolean;
}) {
  const { enviar, enviando, resultado } = useEnvio("/api/publico/contacto");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EntradaContacto, unknown, DatosContacto>({
    resolver: zodResolver(esquemaContacto),
    defaultValues: {
      businessSlug: slug,
      tipo: (TIPOS_DISPONIBLES.includes(tipoInicial) ? tipoInicial : "general_consultation") as DatosContacto["tipo"],
      propertyId,
      serviceId,
      consent: false as unknown as true,
    },
  });

  const tipoActual = watch("tipo");
  const copia = TITULOS[tipoActual as TipoLead] ?? TITULOS.general_consultation!;

  if (resultado?.ok) {
    return (
      <MensajeExito
        titulo="Solicitud recibida"
        mensaje={resultado.mensaje ?? `Un profesional de ${nombreNegocio} revisará los datos y contactará contigo.`}
        slug={slug}
        whatsapp={whatsapp}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (datos) => {
        await enviar({ ...datos, businessSlug: slug });
      })}
      className="space-y-4"
      noValidate
    >
      <header className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">{copia.titulo}</h2>
        <p className="text-sm text-[var(--texto-suave)]">{copia.entradilla}</p>
      </header>

      <input type="hidden" {...register("businessSlug")} value={slug} />
      {propertyId ? <input type="hidden" {...register("propertyId")} value={propertyId} /> : null}
      {serviceId ? <input type="hidden" {...register("serviceId")} value={serviceId} /> : null}

      {permitirCambioTipo ? (
        <Campo etiqueta="¿En qué te ayudamos?" error={errors.tipo?.message}>
          <Select {...register("tipo")}>
            {TIPOS_DISPONIBLES.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETA_TIPO_LEAD[tipo]}
              </option>
            ))}
          </Select>
        </Campo>
      ) : (
        <input type="hidden" {...register("tipo")} />
      )}

      <Campo etiqueta="Nombre" obligatorio error={errors.nombre?.message}>
        <Input {...register("nombre")} autoComplete="name" placeholder="Nombre y apellidos" />
      </Campo>

      <Campo etiqueta="Teléfono" obligatorio error={errors.telefono?.message} ayuda="Es la forma más rápida de darte respuesta.">
        <Input {...register("telefono")} type="tel" inputMode="tel" autoComplete="tel" placeholder="600 000 000" />
      </Campo>

      <Campo etiqueta="Correo (opcional)" error={errors.email?.message}>
        <Input {...register("email")} type="email" autoComplete="email" placeholder="tu@correo.com" />
      </Campo>

      <Campo etiqueta="Mejor horario para llamarte (opcional)" error={errors.horarioPreferido?.message}>
        <Input {...register("horarioPreferido")} placeholder="Mañanas, tardes, indiferente…" />
      </Campo>

      <Campo etiqueta="Cuéntanos lo que necesitas (opcional)" error={errors.mensaje?.message}>
        <Textarea {...register("mensaje")} rows={4} placeholder="Cuanto más nos cuentes, mejor preparamos la llamada." />
      </Campo>

      <Consentimiento
        registroConsentimiento={register("consent")}
        registroHoneypot={register("companyWebsite")}
        error={errors.consent?.message}
      />

      {resultado?.error ? <Aviso tono="peligro">{resultado.error}</Aviso> : null}

      <Button type="submit" size="lg" ancho="completo" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
