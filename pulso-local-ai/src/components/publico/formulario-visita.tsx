"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { Consentimiento } from "./consentimiento";
import { MensajeExito } from "./mensaje-exito";
import { useEnvio } from "@/lib/cliente/envio";
import { esquemaVisita, type DatosVisita, type EntradaVisita } from "@/lib/validaciones/formularios";

/**
 * Solicitud de visita ligada a un inmueble.
 *
 * Pide fecha y franja preferidas, no una hora cerrada: el equipo confirma
 * después. Prometer una hora que nadie ha confirmado es la forma más rápida de
 * empezar mal con un cliente.
 */
export function FormularioVisita({
  slug,
  propertyId,
  tituloInmueble,
  whatsapp,
}: {
  slug: string;
  propertyId?: string;
  tituloInmueble?: string;
  whatsapp?: string | null;
}) {
  const { enviar, enviando, resultado } = useEnvio("/api/publico/visita");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntradaVisita, unknown, DatosVisita>({
    resolver: zodResolver(esquemaVisita),
    defaultValues: { businessSlug: slug, propertyId, modo: "presencial", consent: false as unknown as true },
  });

  if (resultado?.ok) {
    return (
      <MensajeExito
        titulo="Solicitud de visita recibida"
        mensaje={resultado.mensaje ?? "Te confirmamos la cita en cuanto la revisemos."}
        slug={slug}
        whatsapp={whatsapp}
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit(async (datos) => {
        await enviar({ ...datos, businessSlug: slug, propertyId });
      })}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" {...register("businessSlug")} value={slug} />
      {propertyId ? <input type="hidden" {...register("propertyId")} value={propertyId} /> : null}

      {tituloInmueble ? (
        <p className="rounded-[var(--radio)] bg-[var(--superficie-2)] p-3 text-sm">
          Visita para: <strong>{tituloInmueble}</strong>
        </p>
      ) : null}

      <Campo etiqueta="¿Cómo prefieres verlo?" error={errors.modo?.message}>
        <Select {...register("modo")}>
          <option value="presencial">Visita presencial</option>
          <option value="videollamada">Videollamada</option>
          <option value="llamada">Que me llamen primero</option>
        </Select>
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha preferida" error={errors.fechaPreferida?.message}>
          <Input {...register("fechaPreferida")} type="date" min={new Date().toISOString().slice(0, 10)} />
        </Campo>
        <Campo etiqueta="Franja horaria" error={errors.franja?.message}>
          <Input {...register("franja")} placeholder="Mañanas, tardes, sábado…" />
        </Campo>
      </div>

      <Campo etiqueta="Nombre" obligatorio error={errors.nombre?.message}>
        <Input {...register("nombre")} autoComplete="name" />
      </Campo>

      <Campo etiqueta="Teléfono" obligatorio error={errors.telefono?.message}>
        <Input {...register("telefono")} type="tel" inputMode="tel" autoComplete="tel" placeholder="600 000 000" />
      </Campo>

      <Campo etiqueta="Correo (opcional)" error={errors.email?.message}>
        <Input {...register("email")} type="email" autoComplete="email" />
      </Campo>

      <Campo etiqueta="Comentarios (opcional)" error={errors.mensaje?.message}>
        <Textarea {...register("mensaje")} rows={3} />
      </Campo>

      <Consentimiento
        registroConsentimiento={register("consent")}
        registroHoneypot={register("companyWebsite")}
        error={errors.consent?.message}
      />

      {resultado?.error ? <Aviso tono="peligro">{resultado.error}</Aviso> : null}

      <Button type="submit" size="lg" ancho="completo" disabled={enviando}>
        {enviando ? "Enviando…" : "Solicitar visita"}
      </Button>
    </form>
  );
}
