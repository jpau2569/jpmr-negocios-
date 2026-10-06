"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Rol } from "@/lib/tipos";
import { configurado, mensajeError, supabase } from "@/lib/supabase";

type Estado = "cargando" | "anonimo" | "sin-permiso" | "ok" | "sin-config";
interface Ctx { estado: Estado; rol: Rol | null; email: string | null; error: string | null; salir: () => Promise<void> }
const AuthCtx = createContext<Ctx>({ estado: "cargando", rol: null, email: null, error: null, salir: async () => {} });
export const useAuth = () => useContext(AuthCtx);

/** Puerta de UX: la seguridad real es la RLS. Si no es admin/editor → «Sin permiso» y se cierra sesión. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [rol, setRol] = useState<Rol | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bloqueado = useRef(false);

  useEffect(() => {
    if (!configurado()) { setEstado("sin-config"); return; }
    const sb = supabase();
    let vivo = true;
    async function evaluar(uid: string | null, correo: string | null) {
      if (!uid) { if (!bloqueado.current) setEstado("anonimo"); setRol(null); setEmail(null); return; }
      const { data, error: err } = await sb.from("perfiles").select("rol").eq("id", uid).maybeSingle();
      if (!vivo) return;
      const r = (data?.rol ?? null) as Rol | null;
      if (err || (r !== "admin" && r !== "editor")) {
        bloqueado.current = true;
        setError(err ? mensajeError(err) : null);
        setEstado("sin-permiso"); setRol(null); setEmail(null);
        await sb.auth.signOut();
        return;
      }
      bloqueado.current = false;
      setRol(r); setEmail(correo); setEstado("ok");
    }
    sb.auth.getSession().then(({ data }) => evaluar(data.session?.user.id ?? null, data.session?.user.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_ev, s) => {
      // Se difiere para no hacer llamadas a Supabase dentro del callback (recomendación de la librería).
      setTimeout(() => evaluar(s?.user.id ?? null, s?.user.email ?? null), 0);
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  async function salir() {
    bloqueado.current = false;
    if (configurado()) await supabase().auth.signOut();
    setEstado("anonimo");
  }
  return <AuthCtx.Provider value={{ estado, rol, email, error, salir }}>{children}</AuthCtx.Provider>;
}
