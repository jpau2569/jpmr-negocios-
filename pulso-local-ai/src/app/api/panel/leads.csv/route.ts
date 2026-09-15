import { NextResponse } from "next/server";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETA_ESTADO_LEAD, ETIQUETA_FUENTE, ETIQUETA_TIPO_LEAD } from "@/lib/etiquetas";
import type { Lead } from "@/types/dominio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Escapa un campo de CSV: comillas dobladas y todo entre comillas. */
function campo(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * Exportación de contactos.
 *
 * Descarga datos personales, así que exige sesión con acceso al negocio y la
 * consulta va con la identidad del usuario: RLS decide qué filas salen. El
 * fichero lleva BOM para que Excel en Windows no destroce los acentos.
 */
export async function GET() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("leads")
    .select("*, properties(title)")
    .eq("business_id", sesion.negocio.id)
    .order("created_at", { ascending: false })
    .limit(5000);

  const leads = (data as (Lead & { properties: { title: string } | null })[] | null) ?? [];

  const cabecera = [
    "Fecha", "Nombre", "Teléfono", "Email", "Tipo", "Fuente", "Estado",
    "Inmueble", "Mensaje", "Horario preferido", "Consentimiento", "Versión legal", "Datos demo",
  ];

  const filas = leads.map((lead) =>
    [
      new Date(lead.created_at).toLocaleString("es-ES"),
      lead.name,
      lead.phone ?? "",
      lead.email ?? "",
      ETIQUETA_TIPO_LEAD[lead.lead_type],
      ETIQUETA_FUENTE[lead.source],
      ETIQUETA_ESTADO_LEAD[lead.status],
      lead.properties?.title ?? "",
      lead.message ?? "",
      lead.preferred_contact_time ?? "",
      new Date(lead.consented_at).toLocaleString("es-ES"),
      lead.legal_text_version,
      lead.is_demo_data ? "sí" : "no",
    ].map(campo).join(";"),
  );

  const csv = `﻿${[cabecera.map(campo).join(";"), ...filas].join("\r\n")}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contactos-${sesion.negocio.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
