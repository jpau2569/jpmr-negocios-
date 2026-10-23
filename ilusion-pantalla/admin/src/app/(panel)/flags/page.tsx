"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth";
import { Aviso, ErrorCaja, Skeleton, Titulo, Vacio, useCarga } from "@/components/estados";
import { mensajeError, supabase } from "@/lib/supabase";

interface Flag { clave: string; activo: boolean; porcentaje: number; descripcion: string | null }

export default function Flags() {
  const { rol } = useAuth();
  const admin = rol === "admin";
  const { datos, error, cargando, recargar } = useCarga(async () => {
    const { data, error: e } = await supabase().from("feature_flags").select("*").order("clave");
    if (e) throw e;
    return (data ?? []) as Flag[];
  }, []);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; t: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pct, setPct] = useState<Record<string, string>>({});

  async function cambiar(f: Flag, cambios: Partial<Pick<Flag, "activo" | "porcentaje">>) {
    if (!admin) return;
    setOcupado(f.clave); setAviso(null);
    const { error: err } = await supabase().from("feature_flags").update({ ...cambios, updated_at: new Date().toISOString() }).eq("clave", f.clave);
    setOcupado(null);
    if (err) setAviso({ tipo: "error", t: mensajeError(err) }); else { setAviso({ tipo: "ok", t: `«${f.clave}» actualizado.` }); recargar(); }
  }
  function guardarPct(f: Flag) {
    const t = (pct[f.clave] ?? String(f.porcentaje)).trim();
    const n = /^\d+$/.test(t) ? Number(t) : NaN;
    if (!(n >= 0 && n <= 100)) { setAviso({ tipo: "error", t: "El porcentaje debe ser un entero entre 0 y 100." }); return; }
    void cambiar(f, { porcentaje: n });
  }

  return (
    <>
      <Titulo>Feature flags</Titulo>
      {!admin && <p className="text-aviso mb-4" role="note">Solo los administradores pueden cambiar los flags. Los ves en solo lectura.</p>}
      {aviso && <div className="mb-4"><Aviso tipo={aviso.tipo}>{aviso.t}</Aviso></div>}
      {cargando && !datos ? <Skeleton /> : error ? <ErrorCaja mensaje={error} reintentar={recargar} /> :
        !datos?.length ? <Vacio>No hay flags.</Vacio> : (
          <div className="tarjeta p-0 overflow-x-auto">
            <table className="tabla">
              <caption className="sr-only">Feature flags</caption>
              <thead><tr><th scope="col">Clave</th><th scope="col">Activo</th><th scope="col">Porcentaje</th></tr></thead>
              <tbody>
                {datos.map((f) => (
                  <tr key={f.clave}>
                    <td><div className="font-semibold break-all">{f.clave}</div><div className="text-gris text-sm">{f.descripcion}</div></td>
                    <td>
                      <input type="checkbox" className="w-6 h-6 accent-azul" checked={f.activo} disabled={!admin || ocupado === f.clave}
                        aria-label={`Activar ${f.clave}`} onChange={(e) => void cambiar(f, { activo: e.target.checked })} />
                    </td>
                    <td>
                      {admin ? (
                        <div className="flex items-center gap-2">
                          <label className="sr-only" htmlFor={`p-${f.clave}`}>Porcentaje de {f.clave}</label>
                          <input id={`p-${f.clave}`} className="campo w-24" inputMode="numeric" value={pct[f.clave] ?? String(f.porcentaje)} onChange={(e) => setPct((p) => ({ ...p, [f.clave]: e.target.value }))} />
                          <button type="button" className="btn" disabled={ocupado === f.clave} onClick={() => guardarPct(f)}>Guardar</button>
                        </div>
                      ) : `${f.porcentaje} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
}
