/**
 * Gráficos en SVG, sin librería.
 *
 * Se valoró Recharts, pero para tres gráficos sencillos son ~90 kB extra de
 * JavaScript en un panel que se abre desde el móvil entre visita y visita. Estos
 * se renderizan en el servidor, no llevan JavaScript de cliente y salen pintados
 * en el primer HTML.
 */

export interface PuntoSerie {
  dia: string;
  vistas: number;
  leads: number;
  whatsapp: number;
}

function ruta(valores: number[], ancho: number, alto: number, maximo: number): string {
  if (valores.length < 2) return "";
  const paso = ancho / (valores.length - 1);
  return valores
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * paso).toFixed(1)},${(alto - (v / maximo) * alto).toFixed(1)}`)
    .join(" ");
}

export function GraficoEvolucion({ serie }: { serie: PuntoSerie[] }) {
  if (!serie.length) {
    return <p className="text-sm text-[var(--texto-suave)]">Todavía no hay datos suficientes.</p>;
  }

  const ancho = 720;
  const alto = 180;
  const maximo = Math.max(1, ...serie.flatMap((p) => [p.vistas, p.leads, p.whatsapp]));

  const lineas = [
    { clave: "vistas", color: "var(--marca)", etiqueta: "Visitas" },
    { clave: "whatsapp", color: "var(--acento)", etiqueta: "Clics a WhatsApp" },
    { clave: "leads", color: "var(--exito)", etiqueta: "Leads" },
  ] as const;

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${ancho} ${alto + 24}`}
        className="w-full"
        role="img"
        aria-label={`Evolución de los últimos ${serie.length} días`}
      >
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1="0"
            x2={ancho}
            y1={alto - alto * p}
            y2={alto - alto * p}
            stroke="var(--borde)"
            strokeWidth="1"
          />
        ))}
        {lineas.map((linea) => (
          <path
            key={linea.clave}
            d={ruta(serie.map((p) => p[linea.clave]), ancho, alto, maximo)}
            fill="none"
            stroke={linea.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <text x="0" y={alto + 18} fontSize="11" fill="var(--texto-suave)">
          {serie[0]?.dia}
        </text>
        <text x={ancho} y={alto + 18} fontSize="11" fill="var(--texto-suave)" textAnchor="end">
          {serie[serie.length - 1]?.dia}
        </text>
      </svg>

      <figcaption className="flex flex-wrap gap-4 text-xs text-[var(--texto-suave)]">
        {lineas.map((linea) => (
          <span key={linea.clave} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-1 w-4 rounded-full" style={{ background: linea.color }} />
            {linea.etiqueta}
          </span>
        ))}
        <span>Máximo del periodo: {maximo}</span>
      </figcaption>
    </figure>
  );
}

export function GraficoBarras({
  datos,
  etiquetaValor = "",
}: {
  datos: { etiqueta: string; valor: number; secundario?: number }[];
  etiquetaValor?: string;
}) {
  if (!datos.length) {
    return <p className="text-sm text-[var(--texto-suave)]">Todavía no hay datos.</p>;
  }
  const maximo = Math.max(1, ...datos.map((d) => d.valor));

  return (
    <ul className="space-y-3">
      {datos.map((dato) => (
        <li key={dato.etiqueta}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{dato.etiqueta}</span>
            <span className="shrink-0 font-semibold">
              {dato.valor}
              {etiquetaValor ? ` ${etiquetaValor}` : ""}
              {dato.secundario !== undefined ? (
                <span className="ml-2 font-normal text-[var(--texto-suave)]">{dato.secundario} leads</span>
              ) : null}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--superficie-2)]">
            <div
              className="h-full rounded-full bg-[var(--marca)]"
              style={{ width: `${Math.max(3, (dato.valor / maximo) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
