// ============================================================================
//  Campos de formulario
// ----------------------------------------------------------------------------
//  Pensados para rellenarse con el pulgar, sentado, con poca luz:
//   · 16px de fuente mínima en los inputs, porque por debajo iOS hace zoom solo
//     al enfocar y descoloca la página.
//   · El error va enlazado con aria-describedby y el input marcado aria-invalid,
//     para que un lector de pantalla lo anuncie.
//   · El honeypot no es display:none (algunos robots lo detectan): se saca de
//     la pantalla y se le quita el foco y el autocompletado.
// ============================================================================
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
const BASE = "w-full rounded-xl border border-[var(--negocio-borde)] bg-black/25 px-3.5 py-3 " +
    "text-base text-[var(--negocio-texto)] placeholder:text-[var(--negocio-tenue)] " +
    "outline-none transition-colors focus:border-[var(--negocio-acento)]";
export function Campo({ etiqueta, id, error, pista, requerido, children }) {
    return (<div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
        {requerido ? <span className="text-[var(--negocio-acento)]"> *</span> : null}
      </label>
      {children}
      {pista && !error ? (<p id={`${id}-pista`} className="text-xs text-[var(--negocio-tenue)]">{pista}</p>) : null}
      {error ? (<p id={`${id}-error`} role="alert" className="text-xs text-red-300">{error}</p>) : null}
    </div>);
}
export const Entrada = forwardRef(function Entrada({ className, error, ...props }, ref) {
    return (<input ref={ref} aria-invalid={error || undefined} className={cn(BASE, error && "border-red-400/60", className)} {...props}/>);
});
export const AreaTexto = forwardRef(function AreaTexto({ className, error, ...props }, ref) {
    return (<textarea ref={ref} rows={3} aria-invalid={error || undefined} className={cn(BASE, "resize-y", error && "border-red-400/60", className)} {...props}/>);
});
export const Seleccion = forwardRef(function Seleccion({ className, error, children, ...props }, ref) {
    return (<select ref={ref} aria-invalid={error || undefined} className={cn(BASE, "appearance-none", error && "border-red-400/60", className)} {...props}>
        {children}
      </select>);
});
/** Casilla de consentimiento: grande y con el texto pulsable entero. */
export const Casilla = forwardRef(function Casilla({ children, error, id, className, ...props }, ref) {
    return (<div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
        <input ref={ref} id={id} type="checkbox" aria-invalid={Boolean(error) || undefined} className={cn("mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-[var(--negocio-borde)]", "accent-[var(--negocio-acento)]", className)} {...props}/>
        <span className="text-[var(--negocio-tenue)]">{children}</span>
      </label>
      {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
    </div>);
});
/**
 * Campo trampa. Invisible para una persona, tentador para un robot.
 * Fuera de pantalla en vez de display:none, y sin foco ni autocompletado.
 */
export function Honeypot({ registro }) {
    return (<div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor="website">No rellenes este campo</label>
      <input id="website" type="text" tabIndex={-1} autoComplete="off" {...(registro ?? {})}/>
    </div>);
}
