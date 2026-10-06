"use client";
import { ErrorCaja, Skeleton, Titulo, Vacio, useCarga } from "@/components/estados";
import { escalar, eventosPorDia, porcentaje, type FilaDiaria } from "@/lib/metricas";
import { supabase } from "@/lib/supabase";

async function vista<T>(nombre: string): Promise<T[]> {
  const { data, error } = await supabase().from(nombre).select("*").limit(1000);
  if (error) throw error;
  return (data ?? []) as T[];
}

function Bloque({ titulo, carga, vacio, hijos }: { titulo: string; carga: ReturnType<typeof useCarga<unknown[]>>; vacio: string; hijos: (d: never[]) => React.ReactNode }) {
  const id = `m-${titulo.replace(/\W+/g, "-")}`;
  return (
    <section className="tarjeta" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-bold mb-3">{titulo}</h2>
      {carga.cargando && !carga.datos ? <Skeleton filas={3} /> : carga.error ? <ErrorCaja mensaje={carga.error} reintentar={carga.recargar} /> :
        !carga.datos?.length ? <Vacio>{vacio}</Vacio> : hijos(carga.datos as never[])}
    </section>
  );
}

function Barras({ items, ancho = 300 }: { items: { etiqueta: string; valor: number }[]; ancho?: number }) {
  const largos = escalar(items.map((i) => i.valor), ancho);
  const alto = items.length * 34;
  return (
    <svg role="img" aria-label={`Gráfico de barras: ${items.map((i) => `${i.etiqueta} ${i.valor}`).join(", ")}`} viewBox={`0 0 ${ancho + 190} ${alto}`} className="w-full max-w-2xl">
      {items.map((it, i) => (
        <g key={it.etiqueta} transform={`translate(0 ${i * 34})`}>
          <text x="0" y="20" fill="#A7B0C0" fontSize="13">{it.etiqueta}</text>
          <rect x="130" y="4" width={largos[i]} height="22" rx="4" fill="#4D7CFE" />
          <text x={130 + (largos[i] ?? 0) + 8} y="20" fill="#F8FAFC" fontSize="13">{it.valor}</text>
        </g>
      ))}
    </svg>
  );
}

function Columnas({ items }: { items: { dia: string; total: number }[] }) {
  const alto = 120;
  const h = escalar(items.map((i) => i.total), alto);
  const w = 22;
  return (
    <svg role="img" aria-label={`Eventos por día: ${items.map((i) => `${i.dia} ${i.total}`).join(", ")}`} viewBox={`0 0 ${items.length * w + 8} ${alto + 30}`} className="w-full max-w-2xl">
      {items.map((it, i) => (
        <g key={it.dia}>
          <rect x={4 + i * w} y={alto - (h[i] ?? 0)} width={w - 4} height={h[i]} rx="3" fill="#22D3EE"><title>{`${it.dia}: ${it.total}`}</title></rect>
          {(i === 0 || i === items.length - 1) && <text x={4 + i * w} y={alto + 16} fill="#A7B0C0" fontSize="10">{it.dia.slice(5)}</text>}
        </g>
      ))}
    </svg>
  );
}

const num = (n: unknown) => (n === null || n === undefined ? "—" : String(n));

export default function Metricas() {
  const embudo = useCarga(() => vista<{ abren_app: number; descargan: number; activan: number; pct_activacion: number | null }>("embudo_activacion"), []);
  const diarias = useCarga(async () => {
    const desde = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase().from("metricas_diarias").select("*").gte("dia", desde).order("dia").limit(5000);
    if (error) throw error;
    return (data ?? []) as FilaDiaria[];
  }, []);
  const ret = useCarga(async () => {
    const { data, error } = await supabase().from("retencion_cohortes").select("*").order("cohorte", { ascending: false }).limit(30);
    if (error) throw error;
    return (data ?? []) as { cohorte: string; instalaciones: number; vuelven_d1: number; vuelven_d7: number }[];
  }, []);
  const top = useCarga(async () => {
    const { data, error } = await supabase().from("wallpapers_top").select("*").order("vistas", { ascending: false }).limit(20);
    if (error) throw error;
    return (data ?? []) as { wallpaper_slug: string; vistas: number; descargas: number; aplicados: number; activados: number; favoritos_altas: number }[];
  }, []);
  const android = useCarga(async () => {
    const { data, error } = await supabase().from("uso_por_android").select("*").order("android_sdk", { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []) as { android_sdk: number | null; instalaciones: number }[];
  }, []);

  return (
    <>
      <Titulo>Métricas</Titulo>
      <p className="text-gris mb-4">Solo datos con consentimiento y sin identificar a nadie.</p>
      <div className="space-y-4">
        <Bloque titulo="Embudo de activación" carga={embudo as never} vacio="Aún no hay eventos." hijos={(d) => {
          const e = (d as { abren_app: number; descargan: number; activan: number; pct_activacion: number | null }[])[0];
          if (!e) return null;
          return (<>
            <Barras items={[{ etiqueta: "Abren la app", valor: Number(e.abren_app) }, { etiqueta: "Descargan", valor: Number(e.descargan) }, { etiqueta: "Activan", valor: Number(e.activan) }]} />
            <p className="mt-2">Activación: <strong>{e.pct_activacion === null ? "—" : `${String(e.pct_activacion).replace(".", ",")} %`}</strong></p>
          </>);
        }} />
        <Bloque titulo="Eventos por día (últimos 30 días)" carga={diarias as never} vacio="Sin eventos en los últimos 30 días." hijos={(d) => {
          const dias = eventosPorDia(d as FilaDiaria[]);
          return dias.length ? <Columnas items={dias} /> : <Vacio>Sin datos válidos.</Vacio>;
        }} />
        <Bloque titulo="Retención por cohorte" carga={ret as never} vacio="Aún no hay cohortes." hijos={(d) => (
          <div className="overflow-x-auto"><table className="tabla">
            <caption className="sr-only">Retención por cohorte</caption>
            <thead><tr><th scope="col">Cohorte</th><th scope="col">Instalaciones</th><th scope="col">Vuelven D1</th><th scope="col">Vuelven D7</th></tr></thead>
            <tbody>{(d as { cohorte: string; instalaciones: number; vuelven_d1: number; vuelven_d7: number }[]).map((r) => (
              <tr key={r.cohorte}><td>{r.cohorte}</td><td>{r.instalaciones}</td><td>{r.vuelven_d1} ({porcentaje(r.vuelven_d1, r.instalaciones)})</td><td>{r.vuelven_d7} ({porcentaje(r.vuelven_d7, r.instalaciones)})</td></tr>
            ))}</tbody></table></div>
        )} />
        <Bloque titulo="Wallpapers más vistos" carga={top as never} vacio="Aún no hay actividad por wallpaper." hijos={(d) => (
          <div className="overflow-x-auto"><table className="tabla">
            <caption className="sr-only">Wallpapers más vistos</caption>
            <thead><tr><th scope="col">Wallpaper</th><th scope="col">Vistas</th><th scope="col">Descargas</th><th scope="col">Aplicados</th><th scope="col">Activados</th><th scope="col">Favoritos</th></tr></thead>
            <tbody>{(d as { wallpaper_slug: string; vistas: number; descargas: number; aplicados: number; activados: number; favoritos_altas: number }[]).map((r) => (
              <tr key={r.wallpaper_slug}><td className="break-all">{r.wallpaper_slug}</td><td>{r.vistas}</td><td>{r.descargas}</td><td>{r.aplicados}</td><td>{r.activados}</td><td>{r.favoritos_altas}</td></tr>
            ))}</tbody></table></div>
        )} />
        <Bloque titulo="Uso por versión de Android (SDK)" carga={android as never} vacio="Sin datos de dispositivos." hijos={(d) => (
          <div className="overflow-x-auto"><table className="tabla">
            <caption className="sr-only">Uso por versión de Android</caption>
            <thead><tr><th scope="col">SDK</th><th scope="col">Instalaciones</th></tr></thead>
            <tbody>{(d as { android_sdk: number | null; instalaciones: number }[]).map((r) => <tr key={num(r.android_sdk)}><td>{num(r.android_sdk)}</td><td>{r.instalaciones}</td></tr>)}</tbody></table></div>
        )} />
      </div>
    </>
  );
}
