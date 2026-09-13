"use client";

import { useId } from "react";

/**
 * Casilla de consentimiento y honeypot.
 *
 * El consentimiento no viene marcado y no se puede enviar sin marcarlo: el
 * servidor lo exige otra vez. Junto al lead se guarda la versión del texto legal
 * y la fecha, que es lo que convierte «dijo que sí» en algo demostrable.
 *
 * El campo `companyWebsite` es la trampa para bots: está fuera de la vista y con
 * `aria-hidden`, así que ninguna persona ni lector de pantalla lo encuentra.
 */
export function Consentimiento({
  registroConsentimiento,
  registroHoneypot,
  error,
  texto,
}: {
  registroConsentimiento: React.InputHTMLAttributes<HTMLInputElement>;
  registroHoneypot: React.InputHTMLAttributes<HTMLInputElement>;
  error?: string;
  texto?: string;
}) {
  const id = useId();

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 rounded-[var(--radio)] bg-[var(--superficie-2)] p-3">
        <input
          id={id}
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[var(--marca)]"
          aria-invalid={Boolean(error)}
          {...registroConsentimiento}
        />
        <label htmlFor={id} className="text-xs leading-relaxed text-[var(--texto-suave)]">
          {texto ??
            "Autorizo el tratamiento de mis datos con la única finalidad de atender esta solicitud y ponerse en contacto conmigo. Puedo revocarlo cuando quiera."}
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--peligro)]">
          {error}
        </p>
      ) : null}

      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor={`${id}-web`}>No rellenar</label>
        <input id={`${id}-web`} type="text" tabIndex={-1} autoComplete="off" {...registroHoneypot} />
      </div>
    </div>
  );
}
