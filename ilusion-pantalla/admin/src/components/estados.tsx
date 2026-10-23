"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

/** Carga asíncrona con estados. `fn` debe lanzar si falla. Conserva los datos anteriores mientras recarga. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [n, setN] = useState(0);
  const [res, setRes] = useState<{ key: string; datos: T | null; error: string | null } | null>(null);
  const fnRef = useRef(fn);
  const key = `${JSON.stringify(deps)}|${n}`;
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    let vivo = true;
    fnRef.current().then(
      (d) => { if (vivo) setRes({ key, datos: d, error: null }); },
      (e: unknown) => {
        if (!vivo) return;
        const m = e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Error";
        setRes((p) => ({ key, datos: p?.datos ?? null, error: m }));
      },
    );
    return () => { vivo = false; };
  }, [key]);
  return { datos: res?.datos ?? null, error: res?.key === key ? res.error : null, cargando: res?.key !== key, recargar: () => setN((x) => x + 1) };
}
