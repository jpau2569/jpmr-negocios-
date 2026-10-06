"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth";
import { configurado, supabase } from "@/lib/supabase";

export default function Login() {
  const { estado, error: errPerfil } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (estado === "ok") router.replace("/wallpapers"); }, [estado, router]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setError(null); setEnviando(true);
    try {
      const { error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password: clave });
      if (err) setError("Correo o contraseña incorrectos.");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Error");
    } finally { setEnviando(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm space-y-4" aria-labelledby="t-login">
        <h1 id="t-login" className="text-2xl font-bold">Ilusión Pantalla</h1>
        <p className="text-gris">Panel de administración. Solo personal autorizado.</p>
        {estado === "sin-permiso" && (
          <p role="alert" className="text-peligro font-semibold">
            Sin permiso. Tu cuenta no es de administración o edición; se ha cerrado la sesión.{errPerfil ? ` (${errPerfil})` : ""}
          </p>
        )}
        {!configurado() && <p role="alert" className="text-peligro">Faltan las variables NEXT_PUBLIC_SUPABASE_*.</p>}
        <div>
          <label className="etiqueta" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" required className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="clave">Contraseña</label>
          <input id="clave" type="password" autoComplete="current-password" required className="campo" value={clave} onChange={(e) => setClave(e.target.value)} />
        </div>
        {error && <p role="alert" className="error-campo">{error}</p>}
        <button type="submit" className="btn btn-primario w-full" disabled={enviando || !configurado()}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
