"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export function Skeleton({ filas = 5 }: { filas?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Cargando" className="space-y-2">
      {Array.from({ length: filas }, (_, i) => <div key={i} className="skeleton h-11 w-full" />)}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="tarjeta text-center text-gris py-10">{children}</div>;
}

export function ErrorCaja({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <div role="alert" className="tarjeta border-peligro">
      <p className="font-semibold text-peligro">No se ha podido cargar</p>
      <p className="text-gris break-words">{mensaje}</p>
      {reintentar && <button type="button" className="btn mt-3" onClick={reintentar}>Reintentar</button>}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: ReactNode }) {
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`tarjeta ${tipo === "error" ? "border-peligro text-peligro" : "border-ok text-ok"}`}>
      {children}
    </div>
  );
}

export function Titulo({ children, acciones }: { children: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h1 className="text-2xl font-bold">{children}</h1>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

/** Carga asíncrona con estados. `fn` debe lanzar si falla. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [n, setN] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useCallback(fn, deps);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    f().then((d) => { if (vivo) { setDatos(d); setError(null); } })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Error"); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [f, n]);
  return { datos, error, cargando, recargar: () => setN((x) => x + 1), setDatos };
}
