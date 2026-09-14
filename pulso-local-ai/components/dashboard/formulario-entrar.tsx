"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Formulario de acceso al panel.
 * El destino (`desde`) se valida antes de redirigir: si no fuera así, alguien
 * podría mandar a alguien a /entrar?desde=https://sitio-malo y usar el panel
 * como trampolín para un engaño.
 */
export function FormularioEntrar({ desde }: { desde: string }) {
  const router = useRouter();
  const [clave, setClave] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const destinoSeguro = /^\/dashboard(\/|\?|$)/.test(desde) ? desde : "/dashboard";

  async function entrar(ev: React.FormEvent) {
    ev.preventDefault();
    setFallo(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      const json = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !json.ok) {
        setFallo(json.error ?? "No se ha podido entrar.");
        return;
      }
      router.push(destinoSeguro);
      router.refresh();
    } catch {
      setFallo("No hay conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="mt-6 flex flex-col gap-3">
      <label htmlFor="clave" className="text-sm font-medium">Clave del panel</label>
      <input
        id="clave"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={clave}
        onChange={(e) => setClave(e.target.value)}
        className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-3 text-base outline-none focus:border-[#d4a03c]"
      />

      {fallo ? (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">{fallo}</p>
      ) : null}

      <button
        type="submit"
        disabled={enviando || clave.length === 0}
        className="min-h-12 rounded-full bg-[#d4a03c] font-semibold text-[#17181b] disabled:opacity-50"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
