import Link from "next/link";
import { leerEspacio, slugsConocidos } from "@/lib/datos";
import { Tarjeta } from "@/components/ui/basicos";
import { qrSvg, urlDeQr } from "@/lib/qr";
// ============================================================================
//  QR y carteles — /dashboard/qr
// ----------------------------------------------------------------------------
//  Cada punto del local tiene su QR con su propio token, y por eso el panel
//  puede decir después "el de la barra convierte el triple que el del
//  escaparate". Un único QR para todo sería más simple y no serviría de nada.
//
//  Los carteles salen en SVG con medidas en milímetros: al imprimir, un A5 es
//  un A5 de verdad y no "ajustado a la página".
// ============================================================================
export const dynamic = "force-dynamic";
const PUNTOS = [
    { token: "mesa", destino: "landing", etiqueta: "Mesas", nota: "El de más volumen: va en el pie de cada mesa." },
    { token: "barra", destino: "daily_menu", etiqueta: "Barra", nota: "Lleva directo al menú del día." },
    { token: "ticket", destino: "review", etiqueta: "Ticket", nota: "Al pagar, cuando la experiencia está fresca." },
    { token: "escap", destino: "menu", etiqueta: "Escaparate", nota: "Para el que pasa por delante y mira la carta." },
    { token: "grupos", destino: "group", etiqueta: "Cartel de grupos", nota: "Para celebraciones y comidas de empresa." },
    { token: "redes", destino: "landing", etiqueta: "Redes sociales", nota: "El enlace de la bio de Instagram." },
];
export default async function PaginaQr({ searchParams, }) {
    const { negocio } = await searchParams;
    const slugs = slugsConocidos();
    const slug = negocio && slugs.includes(negocio) ? negocio : (slugs[0] ?? "");
    const espacio = slug ? await leerEspacio(slug) : null;
    if (!espacio) {
        return <p className="text-sm text-white/60">No hay ningún negocio cargado.</p>;
    }
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const prefijo = slug.slice(0, 3);
    return (<>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">QR y carteles</h1>
          <p className="text-xs text-white/50">{espacio.negocio.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (<Link key={s} href={`/dashboard/qr?negocio=${s}`} className={`rounded-full border px-3 py-1.5 text-xs ${s === slug ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/60"}`}>
              {s}
            </Link>))}
        </div>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-white/60">
        Cada punto lleva su propio código. No es capricho: así el panel puede decirte después si
        convierte más el de la mesa o el del escaparate, y dónde merece la pena insistir.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {PUNTOS.map((punto) => {
            const token = `${prefijo}-${punto.token}`;
            const enlace = urlDeQr(base, slug, token, punto.destino);
            const api = `/api/qr/${token}?negocio=${slug}&destino=${punto.destino}&etiqueta=${encodeURIComponent(punto.etiqueta)}`;
            return (<Tarjeta key={punto.token} className="p-4">
              <div className="flex gap-4">
                <div className="h-24 w-24 shrink-0 rounded-lg bg-white p-1.5" 
            // El QR se pinta en servidor: no hace falta ni una librería
            // en el navegador ni esperar a que cargue nada.
            dangerouslySetInnerHTML={{ __html: qrSvg(enlace, { margen: 1 }) }}/>
                <div className="min-w-0">
                  <h2 className="font-semibold">{punto.etiqueta}</h2>
                  <p className="mt-0.5 text-xs leading-snug text-white/55">{punto.nota}</p>
                  <p className="mt-1.5 break-all font-mono text-[0.65rem] text-white/40">{enlace}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <a href={`${api}&formato=png&escala=12`} download className="rounded-full bg-[#d4a03c] px-3 py-1.5 font-semibold text-[#17181b]">
                  PNG
                </a>
                <a href={`${api}&formato=svg`} download className="rounded-full border border-white/15 px-3 py-1.5">
                  SVG
                </a>
                <a href={`${api}&formato=a5`} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5">
                  Cartel A5
                </a>
                <a href={`${api}&formato=mesa`} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5">
                  Pegatina de mesa
                </a>
              </div>
            </Tarjeta>);
        })}
      </div>

      <Tarjeta className="mt-6 p-4">
        <h2 className="text-sm font-semibold">Cómo imprimirlos</h2>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-white/60">
          <li>· El <strong className="text-white">cartel A5</strong> se abre en el navegador: imprime sin escalar («tamaño real»), en papel normal o cartulina.</li>
          <li>· La <strong className="text-white">pegatina de mesa</strong> mide 70 × 90 mm y cabe en un pie de metacrilato de los de toda la vida.</li>
          <li>· El <strong className="text-white">SVG</strong> es el que debe ir a imprenta: no pierde calidad por grande que se haga.</li>
          <li>· Antes de imprimir cien, <strong className="text-white">escanea uno con tu móvil</strong> y comprueba que abre donde debe.</li>
        </ul>
      </Tarjeta>
    </>);
}
