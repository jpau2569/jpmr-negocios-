import "server-only";

import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import type { EstadoNegocio, RolMiembro, Tema, Modulos } from "@/types/dominio";

/**
 * Autorización del panel y del área de administración.
 *
 * Esto es la primera barrera, no la única: aunque alguien se saltara estas
 * comprobaciones, RLS seguiría devolviendo cero filas para un negocio del que no
 * es miembro. Las dos capas dicen lo mismo a propósito.
 */

export interface NegocioDelPanel {
  id: string;
  name: string;
  slug: string;
  status: EstadoNegocio;
  trial_ends_at: string | null;
  logo_url: string | null;
  theme: Tema;
  modules: Modulos;
  is_demo_data: boolean;
}

export interface SesionPanel {
  userId: string;
  email: string | null;
  esSuperadmin: boolean;
  rol: RolMiembro;
  negocio: NegocioDelPanel;
  negociosDisponibles: { id: string; name: string; slug: string; role: RolMiembro }[];
}

export async function usuarioActual() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function esSuperadmin(): Promise<boolean> {
  const supabase = await clienteServidor();
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return false;
  const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", sesion.user.id).maybeSingle();
  return Boolean((data as { is_superadmin?: boolean } | null)?.is_superadmin);
}

/**
 * Devuelve la sesión del panel o redirige. `slugPreferido` permite que un
 * superadministrador o una persona con varios negocios elija cuál mira.
 */
export async function requerirSesionPanel(slugPreferido?: string): Promise<SesionPanel> {
  const supabase = await clienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", auth.user.id)
    .maybeSingle();
  const superadmin = Boolean((perfil as { is_superadmin?: boolean } | null)?.is_superadmin);

  const { data: membresias } = await supabase
    .from("business_members")
    .select("role, businesses(id, name, slug, status, trial_ends_at, logo_url, theme, modules, is_demo_data)")
    .eq("user_id", auth.user.id)
    .eq("is_active", true);

  type Fila = { role: RolMiembro; businesses: NegocioDelPanel | null };
  let filas = ((membresias as Fila[] | null) ?? []).filter((f) => f.businesses);

  // Un superadministrador sin membresías puede entrar igualmente a cualquier
  // negocio: RLS se lo permite y necesita poder dar soporte.
  if (!filas.length && superadmin) {
    const { data: negocios } = await supabase
      .from("businesses")
      .select("id, name, slug, status, trial_ends_at, logo_url, theme, modules, is_demo_data")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(50);
    filas = ((negocios as NegocioDelPanel[] | null) ?? []).map((b) => ({ role: "owner" as RolMiembro, businesses: b }));
  }

  if (!filas.length) redirect("/sin-acceso");

  const elegida = (slugPreferido && filas.find((f) => f.businesses?.slug === slugPreferido)) || filas[0]!;

  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    esSuperadmin: superadmin,
    rol: elegida.role,
    negocio: elegida.businesses!,
    negociosDisponibles: filas.map((f) => ({
      id: f.businesses!.id,
      name: f.businesses!.name,
      slug: f.businesses!.slug,
      role: f.role,
    })),
  };
}

export async function requerirSuperadmin() {
  const supabase = await clienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase.from("profiles").select("is_superadmin").eq("id", auth.user.id).maybeSingle();
  if (!(data as { is_superadmin?: boolean } | null)?.is_superadmin) redirect("/sin-acceso");
  return { userId: auth.user.id, email: auth.user.email ?? null };
}

export function puedeEscribir(rol: RolMiembro): boolean {
  return rol === "owner" || rol === "admin" || rol === "agent";
}

export function puedeAdministrar(rol: RolMiembro): boolean {
  return rol === "owner" || rol === "admin";
}
