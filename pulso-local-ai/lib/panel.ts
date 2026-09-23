import "server-only";
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { admin } from "./supabase/servidor";
import { hayBackend } from "./datos";

// ============================================================================
//  Piezas comunes de las rutas de escritura del panel
// ----------------------------------------------------------------------------
//  Todas pasan ya por el middleware, así que aquí se da por hecho que hay
//  sesión. Lo que queda es lo de siempre: validar, resolver el negocio y
//  escribir con service_role filtrando por business_id A MANO, porque aquí
//  RLS ya no protege.
// ============================================================================

export const sinBackend = () =>
  NextResponse.json(
    { ok: false, error: "No hay base de datos conectada: esto es una demostración." },
    { status: 503 },
  );

export async function negocioPorSlug(slug: string): Promise<{ id: string; name: string } | null> {
  const { data } = await admin()
    .from("businesses")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
}

interface Ctx<T> { datos: T; negocio: { id: string; name: string } }

export async function escribir<T extends { slug: string }>(
  peticion: Request,
  esquema: ZodSchema<T>,
  nombre: string,
  accion: (ctx: Ctx<T>) => Promise<Response>,
): Promise<Response> {
  if (!hayBackend()) return sinBackend();

  let bruto: unknown;
  try {
    bruto = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const validado = esquema.safeParse(bruto);
  if (!validado.success) {
    return NextResponse.json(
      { ok: false, error: validado.error.issues[0]?.message ?? "Datos no válidos." },
      { status: 400 },
    );
  }

  const negocio = await negocioPorSlug(validado.data.slug);
  if (!negocio) {
    return NextResponse.json({ ok: false, error: "Ese negocio no existe." }, { status: 404 });
  }

  try {
    return await accion({ datos: validado.data, negocio });
  } catch (e) {
    console.error(`[pulso-local-ai] fallo en panel/${nombre}:`, e);
    return NextResponse.json({ ok: false, error: "No se ha podido guardar." }, { status: 500 });
  }
}
