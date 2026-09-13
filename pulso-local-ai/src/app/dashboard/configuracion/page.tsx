import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/aviso";
import { Badge } from "@/components/ui/badge";
import { FormularioAjustes, FormularioPerfil } from "@/components/panel/formularios-configuracion";
import { ETIQUETA_ESTADO_NEGOCIO, ETIQUETA_ROL } from "@/lib/etiquetas";
import { fechaHora } from "@/lib/formato";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

export default async function PanelConfiguracion() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const [{ data: negocio }, { data: ajustes }, { data: miembros }, { data: legales }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", sesion.negocio.id).single(),
    supabase.from("business_settings").select("*").eq("business_id", sesion.negocio.id).maybeSingle(),
    supabase
      .from("business_members")
      .select("id, role, display_name, is_active")
      .eq("business_id", sesion.negocio.id),
    supabase
      .from("legal_text_versions")
      .select("kind, version, is_current")
      .eq("business_id", sesion.negocio.id)
      .eq("is_current", true),
  ]);

  const b = negocio as Parameters<typeof FormularioPerfil>[0]["valores"] & {
    status: string;
    trial_ends_at: string | null;
    slug: string;
  };

  const a = (ajustes as Parameters<typeof FormularioAjustes>[0]["valores"] | null) ?? {
    google_review_url: null,
    review_request_high: null,
    review_request_low: null,
    hero_title: null,
    hero_subtitle: null,
    valuation_mode: "personalizada",
    valuation_manual_note: null,
    ai_assistant_enabled: true,
    ai_assistant_name: "Asistente 24/7",
    privacy_policy_url: null,
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          Estado: <Badge tono={b.status === "active" ? "exito" : "aviso"}>{ETIQUETA_ESTADO_NEGOCIO[b.status as "trial"]}</Badge>
          {b.trial_ends_at ? ` · la demo termina el ${fechaHora(b.trial_ends_at)}` : ""}
        </p>
      </header>

      <FormularioPerfil valores={b} />
      <FormularioAjustes valores={a} />

      <section className="space-y-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Equipo</h2>
        <ul className="space-y-2 text-sm">
          {((miembros as { id: string; role: keyof typeof ETIQUETA_ROL; display_name: string | null; is_active: boolean }[] | null) ?? []).map(
            (miembro) => (
              <li key={miembro.id} className="flex items-center justify-between gap-3">
                <span>{miembro.display_name ?? "Sin nombre"}</span>
                <Badge tono={miembro.is_active ? "neutro" : "contorno"}>{ETIQUETA_ROL[miembro.role]}</Badge>
              </li>
            ),
          )}
        </ul>
        <p className="text-xs text-[var(--texto-suave)]">
          Para añadir a alguien, créale una cuenta en Supabase Auth y añádelo a este negocio desde el panel de
          administración del SaaS.
        </p>
      </section>

      <section className="space-y-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Textos legales</h2>
        <ul className="space-y-1 text-sm">
          {((legales as { kind: string; version: string }[] | null) ?? []).map((texto) => (
            <li key={texto.kind}>
              {texto.kind} · versión {texto.version}
            </li>
          ))}
        </ul>
        <Aviso tono="aviso" titulo="Antes de publicar">
          Los textos legales incluidos son una plantilla técnica y deben ser revisados por un profesional legal
          antes de publicarse.
        </Aviso>
      </section>

      <section className="space-y-3 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-5">
        <h2 className="text-base font-semibold">Integraciones</h2>
        <p className="text-sm text-[var(--texto-suave)]">
          Google Calendar, WhatsApp Cloud API y sincronización con portales están preparados en el modelo de datos
          pero desactivados. Ninguna integración que envíe mensajes o escriba en tu calendario se activará sin que
          la autorices expresamente.
        </p>
      </section>
    </div>
  );
}
