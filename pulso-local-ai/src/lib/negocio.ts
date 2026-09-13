import "server-only";

import { clientePublico, clienteAdmin } from "@/lib/supabase/servidor";
import { diasHasta } from "@/lib/formato";
import type {
  AjustesPublicos, CaracteristicaPublica, FaqPublica, InmueblePublico,
  MedioPublico, NegocioPublico, ServicioPublico,
} from "@/types/dominio";

/**
 * Lecturas públicas.
 *
 * Todas van contra las vistas `v_*`, nunca contra las tablas. Esas vistas ya
 * filtran por negocio publicable (activo o demo no caducada) y eligen columna a
 * columna qué es público: si la demo caduca, aquí no hay filas que devolver.
 * La caducidad no depende de que el frontend se acuerde de comprobarla.
 */

/**
 * Lectura del negocio distinguiendo los tres desenlaces posibles.
 *
 * Importa separarlos: «no existe» es un 404 honesto, «la demo caducó» es una
 * página comercial y «no he podido preguntar» es un problema nuestro que no
 * debe disfrazarse de ninguno de los dos. El layout decide qué enseñar en cada
 * caso, porque un error lanzado desde un layout anidado no lo recoge ningún
 * `error.tsx`: se lleva por delante la respuesta entera.
 */
export type LecturaNegocio =
  | { estado: "ok"; negocio: NegocioPublico }
  | { estado: "no_publicable" }
  | { estado: "error"; motivo: string };

export async function leerNegocioPublico(slug: string): Promise<LecturaNegocio> {
  try {
    const supabase = clientePublico();
    const { data, error } = await supabase
      .from("v_negocios_publicos")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) return { estado: "error", motivo: error.message };
    if (!data) return { estado: "no_publicable" };
    return { estado: "ok", negocio: data as NegocioPublico };
  } catch (err) {
    return { estado: "error", motivo: err instanceof Error ? err.message : "desconocido" };
  }
}

export async function obtenerNegocioPublico(slug: string): Promise<NegocioPublico | null> {
  const lectura = await leerNegocioPublico(slug);
  return lectura.estado === "ok" ? lectura.negocio : null;
}

/**
 * Datos mínimos de un negocio aunque su demo haya caducado: solo el nombre y el
 * estado, lo justo para pintar la página de «demostración finalizada». No se
 * expone ningún contenido del negocio.
 */
export async function obtenerNegocioParaCaducidad(
  slug: string,
): Promise<{ name: string; slug: string; status: string; reactivation_url: string | null; reactivation_phone: string | null } | null> {
  try {
    const supabase = clienteAdmin();
    const { data } = await supabase
      .from("businesses")
      .select("name, slug, status, trial_settings(reactivation_url, reactivation_phone)")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return null;
    const ajustes = (data as { trial_settings?: { reactivation_url: string | null; reactivation_phone: string | null }[] })
      .trial_settings?.[0];
    return {
      name: (data as { name: string }).name,
      slug: (data as { slug: string }).slug,
      status: (data as { status: string }).status,
      reactivation_url: ajustes?.reactivation_url ?? null,
      reactivation_phone: ajustes?.reactivation_phone ?? null,
    };
  } catch {
    return null;
  }
}

export async function obtenerAjustesPublicos(businessId: string): Promise<AjustesPublicos | null> {
  const supabase = clientePublico();
  const { data } = await supabase.from("v_ajustes_publicos").select("*").eq("business_id", businessId).maybeSingle();
  return (data as AjustesPublicos | null) ?? null;
}

export interface FiltrosInmuebles {
  operacion?: string;
  tipo?: string;
  municipio?: string;
  precioMax?: number;
  habitaciones?: number;
  soloDestacados?: boolean;
  limite?: number;
}

export async function listarInmuebles(businessId: string, filtros: FiltrosInmuebles = {}): Promise<InmueblePublico[]> {
  const supabase = clientePublico();
  let consulta = supabase
    .from("v_inmuebles_publicos")
    .select("*")
    .eq("business_id", businessId)
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false });

  if (filtros.operacion) consulta = consulta.eq("operation_type", filtros.operacion);
  if (filtros.tipo) consulta = consulta.eq("property_type", filtros.tipo);
  if (filtros.municipio) consulta = consulta.eq("municipality", filtros.municipio);
  if (filtros.precioMax) consulta = consulta.lte("price", filtros.precioMax);
  if (filtros.habitaciones) consulta = consulta.gte("bedrooms", filtros.habitaciones);
  if (filtros.soloDestacados) consulta = consulta.eq("featured", true);
  if (filtros.limite) consulta = consulta.limit(filtros.limite);

  const { data } = await consulta;
  return (data as InmueblePublico[] | null) ?? [];
}

export async function obtenerInmueble(businessId: string, slug: string): Promise<InmueblePublico | null> {
  const supabase = clientePublico();
  const { data } = await supabase
    .from("v_inmuebles_publicos")
    .select("*")
    .eq("business_id", businessId)
    .eq("slug", slug)
    .maybeSingle();
  return (data as InmueblePublico | null) ?? null;
}

export async function listarMedios(propertyIds: string[]): Promise<MedioPublico[]> {
  if (!propertyIds.length) return [];
  const supabase = clientePublico();
  const { data } = await supabase
    .from("v_media_publica")
    .select("*")
    .in("property_id", propertyIds)
    .order("position", { ascending: true });
  return (data as MedioPublico[] | null) ?? [];
}

export async function listarCaracteristicas(propertyId: string): Promise<CaracteristicaPublica[]> {
  const supabase = clientePublico();
  const { data } = await supabase
    .from("v_caracteristicas_publicas")
    .select("*")
    .eq("property_id", propertyId)
    .order("position", { ascending: true });
  return (data as CaracteristicaPublica[] | null) ?? [];
}

export async function listarServicios(businessId: string): Promise<ServicioPublico[]> {
  const supabase = clientePublico();
  const { data } = await supabase
    .from("v_servicios_publicos")
    .select("*")
    .eq("business_id", businessId)
    .order("position", { ascending: true });
  return (data as ServicioPublico[] | null) ?? [];
}

export async function listarFaqs(businessId: string): Promise<FaqPublica[]> {
  const supabase = clientePublico();
  const { data } = await supabase
    .from("v_faqs_publicas")
    .select("*")
    .eq("business_id", businessId)
    .order("position", { ascending: true });
  return (data as FaqPublica[] | null) ?? [];
}

/**
 * Inmuebles parecidos: misma operación, mismo municipio y precio en una horquilla
 * del ±30 %. Sin recomendadores raros: lo que de verdad enseña un agente cuando
 * un piso no encaja.
 */
export async function inmueblesSimilares(inmueble: InmueblePublico, limite = 3): Promise<InmueblePublico[]> {
  const supabase = clientePublico();
  let consulta = supabase
    .from("v_inmuebles_publicos")
    .select("*")
    .eq("business_id", inmueble.business_id)
    .eq("operation_type", inmueble.operation_type)
    .neq("id", inmueble.id)
    .limit(limite);

  if (inmueble.municipality) consulta = consulta.eq("municipality", inmueble.municipality);
  if (inmueble.price) {
    consulta = consulta.gte("price", Math.round(inmueble.price * 0.7)).lte("price", Math.round(inmueble.price * 1.3));
  }

  const { data } = await consulta;
  const similares = (data as InmueblePublico[] | null) ?? [];
  if (similares.length) return similares;

  // Si no hay nada parecido, al menos no dejamos la sección vacía.
  const alternativos = await listarInmuebles(inmueble.business_id, { limite: limite + 1 });
  return alternativos.filter((p) => p.id !== inmueble.id).slice(0, limite);
}

export interface EstadoDemo {
  enDemo: boolean;
  caducada: boolean;
  diasRestantes: number | null;
}

export function estadoDemo(negocio: Pick<NegocioPublico, "status" | "trial_ends_at">): EstadoDemo {
  if (negocio.status !== "trial") {
    return { enDemo: false, caducada: negocio.status === "expired", diasRestantes: null };
  }
  const dias = diasHasta(negocio.trial_ends_at);
  return { enDemo: true, caducada: dias !== null && dias <= 0, diasRestantes: dias };
}
