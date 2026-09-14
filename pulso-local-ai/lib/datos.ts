// ============================================================================
//  Capa de datos del espacio público
// ----------------------------------------------------------------------------
//  Cascada deliberada, igual que en el escaparate de Castresana:
//
//    1. Supabase, si está configurado  → es lo que habrá en producción
//    2. datos-demo.json                → respaldo generado del mismo seed
//
//  El respaldo existe por una razón de negocio, no técnica: Pau tiene que poder
//  enseñar la demo en el bar, desde el móvil, antes de que exista el proyecto
//  de Supabase. Y si un día la base falla, el cliente que escanea el QR ve la
//  carta igual en vez de una pantalla en blanco.
//
//  Lo que el respaldo NO hace: guardar reservas. Eso necesita backend de
//  verdad, y el formulario lo dice en vez de fingir que se ha enviado.
// ============================================================================

import "server-only";
import { cliente, haySupabase } from "./supabase/servidor";
import respaldo from "./datos-demo.json";
import { hoyISO } from "./utils";
import type {
  EspacioNegocio, Plato, CategoriaCarta, MenuDelDia, MenuEspecial,
  EventoNegocio, Promocion, Alergeno,
} from "@/types/negocio";

/** Los negocios que existen. Se usa para generateStaticParams. */
export function slugsConocidos(): string[] {
  return Object.keys(respaldo as Record<string, unknown>);
}

/* --- Respaldo local --------------------------------------------------------- */

function desdeRespaldo(slug: string): EspacioNegocio | null {
  const tabla = respaldo as unknown as Record<string, EspacioNegocio>;
  const espacio = tabla[slug];
  if (!espacio) return null;

  // El menú del día del respaldo se fecha en el día en curso: si no, mañana
  // la demo aparecería sin menú y parecería rota delante de un cliente.
  const menu = espacio.menuDeHoy
    ? { ...espacio.menuDeHoy, service_date: hoyISO() }
    : null;

  // En el respaldo, trial_ends_at: null significa "demo local, siempre viva":
  // sin esto la fecha se quedaría en el pasado y la demo saldría caducada en
  // cuanto Pau la abriera delante de un cliente. Quien manda sobre el trial de
  // verdad es Supabase; esto solo aplica cuando no hay base de datos.
  // Una fecha EXPLÍCITA sí se respeta, para poder probar la página de caducada.
  const negocio = espacio.negocio.status === "trial" && espacio.negocio.trial_ends_at === null
    ? { ...espacio.negocio, trial_ends_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() }
    : espacio.negocio;

  return { ...espacio, negocio, menuDeHoy: menu };
}

/* --- Supabase ---------------------------------------------------------------- */

interface FilaAlergeno { item_id: string; allergen: Alergeno }

async function desdeSupabase(slug: string): Promise<EspacioNegocio | null> {
  const db = cliente();

  // RLS ya filtra: si el negocio no está vigente, esto devuelve null sin más.
  const { data: negocio } = await db
    .from("businesses")
    .select("id, slug, name, sector, status, trial_ends_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!negocio) return null;

  const [ajustesRes, categoriasRes, platosRes, menuRes, especialesRes, eventosRes, promosRes] =
    await Promise.all([
      db.from("business_settings").select("*").eq("business_id", negocio.id).maybeSingle(),
      db.from("menu_categories").select("id, name, description, position, is_demo")
        .eq("business_id", negocio.id).order("position"),
      db.from("menu_items")
        .select("id, category_id, name, description, price_cents, price_from, image_url, tags, position, status, is_demo")
        .eq("business_id", negocio.id).order("position"),
      db.from("daily_menus")
        .select("id, service_date, price_cents, includes_drink, notes, status, is_demo, daily_menu_items(id, course, name, description, position)")
        .eq("business_id", negocio.id).eq("service_date", hoyISO()).maybeSingle(),
      db.from("special_menus")
        .select("id, kind, name, description, image_url, price_cents, conditions, starts_on, ends_on, courses, is_demo")
        .eq("business_id", negocio.id),
      db.from("events").select("id, name, description, image_url, starts_at, is_demo")
        .eq("business_id", negocio.id).order("starts_at"),
      db.from("promotions").select("id, name, description, conditions, is_demo")
        .eq("business_id", negocio.id),
    ]);

  const platos = (platosRes.data ?? []) as Omit<Plato, "alergenos">[];

  // Los alérgenos van en tabla aparte: se piden en un solo viaje y se reparten.
  let porPlato = new Map<string, Alergeno[]>();
  if (platos.length > 0) {
    const { data: alergenos } = await db
      .from("menu_item_allergens")
      .select("item_id, allergen")
      .in("item_id", platos.map((p) => p.id));
    porPlato = ((alergenos ?? []) as FilaAlergeno[]).reduce((mapa, fila) => {
      const lista = mapa.get(fila.item_id) ?? [];
      lista.push(fila.allergen);
      mapa.set(fila.item_id, lista);
      return mapa;
    }, new Map<string, Alergeno[]>());
  }

  const menuFila = menuRes.data as (Omit<MenuDelDia, "platos"> & {
    daily_menu_items?: MenuDelDia["platos"];
  }) | null;

  return {
    negocio,
    ajustes: ajustesRes.data as EspacioNegocio["ajustes"],
    categorias: (categoriasRes.data ?? []) as CategoriaCarta[],
    platos: platos.map((p) => ({ ...p, alergenos: porPlato.get(p.id) ?? [] })),
    menuDeHoy: menuFila
      ? {
          ...menuFila,
          platos: [...(menuFila.daily_menu_items ?? [])].sort((a, b) => a.position - b.position),
        }
      : null,
    menusEspeciales: (especialesRes.data ?? []) as MenuEspecial[],
    eventos: (eventosRes.data ?? []) as EventoNegocio[],
    promociones: (promosRes.data ?? []) as Promocion[],
  };
}

/* --- Entrada única ----------------------------------------------------------- */

export async function leerEspacio(slug: string): Promise<EspacioNegocio | null> {
  if (haySupabase()) {
    try {
      const remoto = await desdeSupabase(slug);
      if (remoto) return remoto;
    } catch (e) {
      // Nunca una pantalla en blanco delante de un cliente: se cae al respaldo
      // y se deja constancia en el log del servidor.
      console.error(`[pulso-local-ai] Supabase falló para «${slug}», voy al respaldo:`, e);
    }
  }
  return desdeRespaldo(slug);
}

/** ¿Se pueden guardar formularios de verdad, o solo enseñar la demo? */
export function hayBackend(): boolean {
  return haySupabase() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/* --- Derivados que usan varias páginas --------------------------------------- */

export function platosDeCategoria(espacio: EspacioNegocio, categoriaId: string): Plato[] {
  return espacio.platos.filter((p) => p.category_id === categoriaId);
}

export function platosConEtiqueta(espacio: EspacioNegocio, etiqueta: string): Plato[] {
  return espacio.platos.filter((p) => p.tags.includes(etiqueta));
}

export function destacados(espacio: EspacioNegocio, maximo = 8): Plato[] {
  const marcados = espacio.platos.filter(
    (p) => p.tags.includes("recomendado") || p.tags.includes("mas_pedido"),
  );
  return marcados.slice(0, maximo);
}

/** Menús especiales vigentes hoy. Uno caducado no se enseña. */
export function especialesVigentes(espacio: EspacioNegocio, hoy = hoyISO()): MenuEspecial[] {
  return espacio.menusEspeciales.filter(
    (m) => (!m.starts_on || m.starts_on <= hoy) && (!m.ends_on || m.ends_on >= hoy),
  );
}

/** ¿Queda algo sin confirmar por el negocio? La página tiene que decirlo. */
export function haySinConfirmar(espacio: EspacioNegocio): boolean {
  return (
    espacio.platos.some((p) => p.is_demo) ||
    Boolean(espacio.menuDeHoy?.is_demo) ||
    espacio.menusEspeciales.some((m) => m.is_demo)
  );
}
