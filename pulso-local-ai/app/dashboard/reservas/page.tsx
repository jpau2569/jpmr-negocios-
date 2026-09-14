import Link from "next/link";
import { admin } from "@/lib/supabase/servidor";
import { leerEspacio, slugsConocidos, hayBackend } from "@/lib/datos";
import { BandejaReservas, type FilaReserva } from "@/components/dashboard/bandeja-reservas";
import { hoyISO, sumaDias } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Sin base de datos se enseña un ejemplo, marcado como tal en la propia
// bandeja: sirve para explicarle al cliente cómo le llegarán las reservas.
const MUESTRA: FilaReserva[] = [
  {
    id: "00000000-0000-4000-8000-000000000001", tipo: "reserva",
    name: "Ejemplo: Marta", phone: "600000001", email: null,
    service_date: hoyISO(), service_time: "21:30", party_size: 4,
    occasion: "dinner", comments: "Si puede ser, mesa tranquila.",
    allergies_note: "Una celíaca", status: "pending", created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002", tipo: "grupo",
    name: "Ejemplo: Javier", phone: "600000002", email: null,
    service_date: sumaDias(hoyISO(), 21), service_time: null, party_size: 28,
    celebration: "Comida de empresa", comments: "Venimos de la oficina de al lado.",
    budget_hint: "Sobre 30 € por persona", needs_menu: true,
    status: "pending", created_at: new Date().toISOString(),
  },
];

async function leerFilas(slug: string): Promise<FilaReserva[]> {
  const db = admin();
  const { data: negocio } = await db.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (!negocio) return [];

  const [reservas, grupos] = await Promise.all([
    db.from("reservations")
      .select("id, name, phone, email, service_date, service_time, party_size, occasion, comments, allergies_note, status, created_at")
      .eq("business_id", negocio.id).order("service_date", { ascending: true }).limit(100),
    db.from("group_requests")
      .select("id, name, phone, email, service_date, party_size, celebration, budget_hint, needs_menu, comments, status, created_at")
      .eq("business_id", negocio.id).order("created_at", { ascending: false }).limit(100),
  ]);

  return [
    ...(reservas.data ?? []).map((r) => ({ ...r, tipo: "reserva" as const, service_time: r.service_time as string | null })),
    ...(grupos.data ?? []).map((g) => ({ ...g, tipo: "grupo" as const, service_time: null })),
  ] as FilaReserva[];
}

export default async function PaginaReservas({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const { negocio } = await searchParams;
  const slugs = slugsConocidos();
  const slug = negocio && slugs.includes(negocio) ? negocio : (slugs[0] ?? "");
  const espacio = slug ? await leerEspacio(slug) : null;
  if (!espacio) return <p className="text-sm text-white/60">No hay ningún negocio cargado.</p>;

  const filas = hayBackend() ? await leerFilas(slug) : MUESTRA;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Reservas y grupos</h1>
          <p className="text-xs text-white/50">{espacio.negocio.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (
            <Link
              key={s}
              href={`/dashboard/reservas?negocio=${s}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                s === slug ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/60"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <BandejaReservas
        slug={slug}
        filas={filas}
        negocio={espacio.negocio.name}
        hayBackend={hayBackend()}
      />
    </>
  );
}
