"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Campo, Input, Select, Textarea } from "@/components/ui/campos";
import { Aviso } from "@/components/ui/aviso";
import { guardarAjustes, guardarPerfil } from "@/app/dashboard/configuracion/acciones";
import { contrasteInsuficiente } from "@/lib/tema";

type Accion = typeof guardarPerfil | typeof guardarAjustes;

function useGuardado(accion: Accion) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tono: "exito" | "peligro"; texto: string } | null>(null);

  return {
    pendiente,
    mensaje,
    enviar: (datos: FormData) =>
      iniciar(async () => {
        const r = await accion(datos);
        setMensaje(r?.error ? { tono: "peligro", texto: r.error } : { tono: "exito", texto: "Guardado" });
      }),
  };
}

export function FormularioPerfil({
  valores,
}: {
  valores: {
    name: string;
    tagline: string | null;
    founded_note: string | null;
    description: string | null;
    phone: string | null;
    whatsapp_phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    website_url: string | null;
    review_url: string | null;
    opening_hours: Record<string, string>;
    theme: { marca?: string; acento?: string };
  };
}) {
  const { enviar, pendiente, mensaje } = useGuardado(guardarPerfil);
  const [colorMarca, setColorMarca] = useState(valores.theme?.marca ?? "#0E2A3F");
  const [colorAcento, setColorAcento] = useState(valores.theme?.acento ?? "#C2A06A");

  // Hay colores (un rojo puro, por ejemplo) donde ni el texto blanco ni el negro
  // llegan al mínimo legible. Mejor decirlo aquí que dejar botones que casi se
  // leen en la landing del cliente.
  const avisos = [
    { etiqueta: "color principal", ...contrasteInsuficiente(colorMarca) },
    { etiqueta: "color de acento", ...contrasteInsuficiente(colorAcento) },
  ].filter((a) => a.problematico);

  return (
    <form action={enviar} className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
      <h2 className="text-base font-semibold">Perfil del negocio</h2>

      <Campo etiqueta="Nombre" obligatorio>
        <Input name="name" defaultValue={valores.name} required maxLength={120} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Subtítulo" ayuda="Sale bajo el nombre en la landing.">
          <Input name="tagline" defaultValue={valores.tagline ?? ""} maxLength={160} />
        </Campo>
        <Campo etiqueta="Texto de confianza" ayuda="Por ejemplo: «Fundada en 1993».">
          <Input name="founded_note" defaultValue={valores.founded_note ?? ""} maxLength={80} />
        </Campo>
      </div>

      <Campo etiqueta="Descripción">
        <Textarea name="description" rows={3} defaultValue={valores.description ?? ""} maxLength={600} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Teléfono fijo">
          <Input name="phone" defaultValue={valores.phone ?? ""} maxLength={30} />
        </Campo>
        <Campo etiqueta="WhatsApp">
          <Input name="whatsapp_phone" defaultValue={valores.whatsapp_phone ?? ""} maxLength={30} />
        </Campo>
        <Campo etiqueta="Correo">
          <Input name="email" type="email" defaultValue={valores.email ?? ""} maxLength={120} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Dirección">
          <Input name="address" defaultValue={valores.address ?? ""} maxLength={160} />
        </Campo>
        <Campo etiqueta="Ciudad">
          <Input name="city" defaultValue={valores.city ?? ""} maxLength={80} />
        </Campo>
        <Campo etiqueta="Código postal">
          <Input name="postal_code" defaultValue={valores.postal_code ?? ""} maxLength={12} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Horario de lunes a viernes">
          <Input name="horario_semana" defaultValue={valores.opening_hours?.lunes_viernes ?? ""} maxLength={80} />
        </Campo>
        <Campo etiqueta="Sábado">
          <Input name="horario_sabado" defaultValue={valores.opening_hours?.sabado ?? ""} maxLength={80} />
        </Campo>
        <Campo etiqueta="Domingo">
          <Input name="horario_domingo" defaultValue={valores.opening_hours?.domingo ?? ""} maxLength={80} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Web oficial">
          <Input name="website_url" type="url" defaultValue={valores.website_url ?? ""} maxLength={400} />
        </Campo>
        <Campo etiqueta="Enlace a tu ficha de Google">
          <Input name="review_url" type="url" defaultValue={valores.review_url ?? ""} maxLength={400} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Color principal">
          <input
            type="color"
            name="color_marca"
            value={colorMarca}
            onChange={(e) => setColorMarca(e.target.value)}
            className="h-11 w-full rounded-[var(--radio)] border border-[var(--borde)]"
          />
        </Campo>
        <Campo etiqueta="Color de acento">
          <input
            type="color"
            name="color_acento"
            value={colorAcento}
            onChange={(e) => setColorAcento(e.target.value)}
            className="h-11 w-full rounded-[var(--radio)] border border-[var(--borde)]"
          />
        </Campo>
      </div>

      {avisos.length ? (
        <Aviso tono="aviso" titulo="Ese color va a costar de leer">
          {avisos.map((aviso) => (
            <p key={aviso.etiqueta}>
              Con tu {aviso.etiqueta}, el texto encima se queda en {aviso.mejorRatio}:1 y el mínimo accesible es
              4,5:1. Prueba con un tono más oscuro o más claro.
            </p>
          ))}
        </Aviso>
      ) : null}

      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar perfil"}
      </Button>
    </form>
  );
}

export function FormularioAjustes({
  valores,
}: {
  valores: {
    google_review_url: string | null;
    review_request_high: string | null;
    review_request_low: string | null;
    hero_title: string | null;
    hero_subtitle: string | null;
    valuation_mode: string;
    valuation_manual_note: string | null;
    ai_assistant_enabled: boolean;
    ai_assistant_name: string;
    privacy_policy_url: string | null;
  };
}) {
  const { enviar, pendiente, mensaje } = useGuardado(guardarAjustes);

  return (
    <form action={enviar} className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
      <h2 className="text-base font-semibold">Contenido y funcionamiento</h2>

      <Campo etiqueta="Titular de la landing">
        <Input name="hero_title" defaultValue={valores.hero_title ?? ""} maxLength={160} />
      </Campo>
      <Campo etiqueta="Subtítulo de la landing">
        <Textarea name="hero_subtitle" rows={2} defaultValue={valores.hero_subtitle ?? ""} maxLength={300} />
      </Campo>

      <Campo
        etiqueta="Enlace oficial de reseñas de Google"
        ayuda="Cópialo de tu ficha de empresa en Google. Si está vacío, el formulario de opinión no ofrece el paso a la reseña pública."
      >
        <Input name="google_review_url" type="url" defaultValue={valores.google_review_url ?? ""} maxLength={400} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Texto para valoraciones altas">
          <Textarea name="review_request_high" rows={2} defaultValue={valores.review_request_high ?? ""} maxLength={300} />
        </Campo>
        <Campo etiqueta="Texto para valoraciones bajas">
          <Textarea name="review_request_low" rows={2} defaultValue={valores.review_request_low ?? ""} maxLength={300} />
        </Campo>
      </div>

      <Campo etiqueta="Cómo respondes a una valoración">
        <Select name="valuation_mode" defaultValue={valores.valuation_mode}>
          <option value="personalizada">Valoración personalizada (la revisa una persona)</option>
          <option value="orientativa_manual">Mostrar además una nota orientativa escrita por ti</option>
        </Select>
      </Campo>

      <Campo etiqueta="Nota orientativa" ayuda="Se enseña al final del formulario de valoración. No es un precio automático.">
        <Textarea name="valuation_manual_note" rows={3} defaultValue={valores.valuation_manual_note ?? ""} maxLength={400} />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre del asistente">
          <Input name="ai_assistant_name" defaultValue={valores.ai_assistant_name} maxLength={60} />
        </Campo>
        <label className="flex items-center gap-3 self-end pb-2 text-sm">
          <input
            type="checkbox"
            name="ai_assistant_enabled"
            defaultChecked={valores.ai_assistant_enabled}
            className="size-5 accent-[var(--marca)]"
          />
          Mostrar el asistente en la landing
        </label>
      </div>

      <Campo etiqueta="Política de privacidad (URL)">
        <Input name="privacy_policy_url" type="url" defaultValue={valores.privacy_policy_url ?? ""} maxLength={400} />
      </Campo>

      {mensaje ? <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso> : null}
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar ajustes"}
      </Button>
    </form>
  );
}
