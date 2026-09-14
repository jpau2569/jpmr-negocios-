// ============================================================================
//  Piezas de interfaz compartidas
// ============================================================================
import { cn } from "@/lib/utils";
import { ETIQUETAS_ES } from "@/types/negocio";
/* --- Tarjeta ---------------------------------------------------------------- */
export function Tarjeta({ className, ...props }) {
    return (<div className={cn("rounded-[var(--radius-tarjeta)] border border-[var(--negocio-borde)]", "bg-[var(--negocio-superficie)] overflow-hidden", className)} {...props}/>);
}
/* --- Sección ----------------------------------------------------------------
   Cada sección de la landing lleva su ancla, porque los QR y los botones del
   hero saltan directamente a ellas. */
export function Seccion({ id, titulo, descripcion, children, className, }) {
    return (<section id={id} className={cn("scroll-mt-20 px-4 py-10 sm:px-6", className)}>
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl">{titulo}</h2>
        {descripcion ? (<p className="mt-1.5 text-sm text-[var(--negocio-tenue)]">{descripcion}</p>) : null}
        <div className="mt-5">{children}</div>
      </div>
    </section>);
}
/* --- Etiquetas de plato ------------------------------------------------------ */
const COLOR_ETIQUETA = {
    recomendado: "bg-[var(--negocio-acento)]/15 text-[var(--negocio-acento)]",
    mas_pedido: "bg-[var(--negocio-acento)]/15 text-[var(--negocio-acento)]",
    nuevo: "bg-emerald-500/15 text-emerald-300",
    oferta: "bg-[var(--negocio-acento2)]/20 text-[var(--negocio-acento2)]",
    picante: "bg-red-500/15 text-red-300",
    vegetariano: "bg-emerald-500/15 text-emerald-300",
    vegano: "bg-emerald-500/15 text-emerald-300",
    sin_gluten: "bg-sky-500/15 text-sky-300",
    para_compartir: "bg-white/10 text-[var(--negocio-texto)]",
    especial_de_hoy: "bg-[var(--negocio-acento)]/20 text-[var(--negocio-acento)]",
};
export function Etiqueta({ nombre }) {
    const conocida = nombre in ETIQUETAS_ES ? nombre : null;
    return (<span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", conocida ? COLOR_ETIQUETA[conocida] : "bg-white/10 text-[var(--negocio-texto)]")}>
      {conocida ? ETIQUETAS_ES[conocida] : nombre}
    </span>);
}
/* --- Aviso de dato sin confirmar ---------------------------------------------
   La pieza más importante del producto en términos de confianza: mientras el
   negocio no haya confirmado algo, se DICE. No se publica como real lo que no
   está verificado. */
export function SinConfirmar({ texto, className }) {
    return (<p className={cn("inline-flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1.5", "text-[0.72rem] leading-snug text-amber-200/90", className)}>
      <span aria-hidden="true">⚠</span>
      <span>{texto ?? "Dato de muestra: el negocio lo confirma antes de publicar."}</span>
    </p>);
}
/* --- Aviso general ----------------------------------------------------------- */
export function Aviso({ tono = "neutro", children, className, }) {
    const tonos = {
        neutro: "bg-white/5 text-[var(--negocio-tenue)] border-[var(--negocio-borde)]",
        ok: "bg-emerald-500/10 text-emerald-200 border-emerald-500/25",
        error: "bg-red-500/10 text-red-200 border-red-500/25",
    };
    return (<div className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", tonos[tono], className)}>
      {children}
    </div>);
}
/* --- Estado vacío ------------------------------------------------------------ */
export function Vacio({ children }) {
    return (<p className="rounded-xl border border-dashed border-[var(--negocio-borde)] px-4 py-8 text-center text-sm text-[var(--negocio-tenue)]">
      {children}
    </p>);
}
