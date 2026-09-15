"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";

const esquema = z.object({
  email: z.string().email("Escribe un correo válido"),
  password: z.string().min(6, "La contraseña tiene al menos 6 caracteres"),
});

export interface EstadoLogin {
  error?: string;
}

export async function entrar(_estado: EstadoLogin, formulario: FormData): Promise<EstadoLogin> {
  const datos = esquema.safeParse({
    email: formulario.get("email"),
    password: formulario.get("password"),
  });
  if (!datos.success) {
    return { error: datos.error.issues[0]?.message ?? "Revisa los datos" };
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithPassword(datos.data);

  // Mensaje genérico a propósito: distinguir «no existe» de «contraseña mal»
  // permite averiguar qué correos están dados de alta.
  if (error) return { error: "No hemos podido entrar con esos datos." };

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function salir() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
