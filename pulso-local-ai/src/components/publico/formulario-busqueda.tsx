"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { Consentimiento } from "./consentimiento";
import { MensajeExito } from "./mensaje-exito";
import { useEnvio } from "@/lib/cliente/envio";
import { esquemaBusqueda, TIPOS_INMUEBLE, type DatosBusqueda, type EntradaBusqueda } from "@/lib/validaciones/formularios";
import { ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";

const IMPRESCINDIBLES = ["Ascensor", "Terraza", "Garaje", "Exterior", "Reformado", "Planta baja", "Trastero", "Jardín"];

/** Demanda de comprador o inquilino: lo que hay que saber para avisarle bien. */
export function FormularioBusqueda({
  slug,
  nombreNegocio,
  whatsapp,
}: {
  slug: string;
  nombreNegocio: string;
  whatsapp?: string | null;
}) {
  const { enviar, enviando, resultado } = useEnvio("/api/publico/busqueda");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntradaBusqueda, unknown, DatosBusqueda>({
    resolver: zodResolver(esquemaBusqueda),
    defaultValues: {
      businessSlug: slug,
      operacion: "venta",
      tiposInmueble: ["piso"],
      imprescindibles: [],
      consent: false as unknown as true,
    },
  });

  if (resultado?.ok) {
    return (
      <MensajeExito
        titulo="Búsqueda registrada"
        mensaje={resultado.mensaje ?? `${nombreNegocio} te avisará cuando entre algo que encaje.`}
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
      <input type="hidden" {...register("businessSlug")} value={slug} />

      <Campo etiqueta="¿Compra o alquiler?" obligatorio error={errors.operacion?.message}>
        <Select {...register("operacion")}>
          <option value="venta">Compra</option>
          <option value="alquiler">Alquiler</option>
        </Select>
      </Campo>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tipo de inmueble</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIPOS_INMUEBLE.slice(0, 9).map((tipo) => (
            <label
              key={tipo}
              className="flex min-h-11 items-center gap-2 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
            >
              <input type="checkbox" value={tipo} className="size-4 accent-[var(--marca)]" {...register("tiposInmueble")} />
              {ETIQUETA_TIPO_INMUEBLE[tipo]}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo etiqueta="Zonas de interés" ayuda="Sepáralas por comas: Oviedo centro, La Corredoria…" error={errors.zonas?.message}>
        <Input {...register("zonas")} placeholder="Oviedo centro, Vallobín" />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Presupuesto máximo (€)" error={errors.presupuestoMax?.message}>
          <Input {...register("presupuestoMax")} type="number" inputMode="numeric" min={0} placeholder="200000" />
        </Campo>
        <Campo etiqueta="Habitaciones mínimas" error={errors.habitacionesMin?.message}>
          <Input {...register("habitacionesMin")} type="number" inputMode="numeric" min={0} placeholder="2" />
        </Campo>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Imprescindibles</legend>
        <div className="grid grid-cols-2 gap-2">
          {IMPRESCINDIBLES.map((caracteristica) => (
            <label
              key={caracteristica}
              className="flex min-h-11 items-center gap-2 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
            >
              <input
                type="checkbox"
                value={caracteristica}
                className="size-4 accent-[var(--marca)]"
                {...register("imprescindibles")}
              />
              {caracteristica}
            </label>
          ))}
        </div>
      </fieldset>

      <Campo etiqueta="¿Para cuándo?" error={errors.plazo?.message}>
        <Input {...register("plazo")} placeholder="En 3 meses, sin prisa…" />
      </Campo>

      <Campo etiqueta="Nombre" obligatorio error={errors.nombre?.message}>
        <Input {...register("nombre")} autoComplete="name" />
      </Campo>

      <Campo etiqueta="Teléfono" obligatorio error={errors.telefono?.message}>
        <Input {...register("telefono")} type="tel" inputMode="tel" autoComplete="tel" placeholder="600 000 000" />
      </Campo>

      <Campo etiqueta="Correo (opcional)" error={errors.email?.message}>
        <Input {...register("email")} type="email" autoComplete="email" />
      </Campo>

      <Campo etiqueta="Algo más (opcional)" error={errors.mensaje?.message}>
        <Textarea {...register("mensaje")} rows={3} />
      </Campo>

      <Consentimiento
        registroConsentimiento={register("consent")}
        registroHoneypot={register("companyWebsite")}
        error={errors.consent?.message}
      />

      {resultado?.error ? <Aviso tono="peligro">{resultado.error}</Aviso> : null}

      <Button type="submit" size="lg" ancho="completo" disabled={enviando}>
        {enviando ? "Enviando…" : "Quiero que me avisen"}
      </Button>
    </form>
  );
}
