"use client";

import { useState } from "react";
import { contextoActual } from "./eventos";

export interface RespuestaEnvio {
  ok: boolean;
  mensaje?: string;
  error?: string;
  campos?: Record<string, string>;
}

/**
 * Envío de formularios públicos.
 *
 * Añade siempre el contexto (sesión anónima, QR de origen, UTM y ruta) para que
 * el lead sepa de qué cartel vino. Y traduce los errores del servidor a algo que
 * una persona entienda, sin filtrar detalles internos.
 */
export function useEnvio(endpoint: string) {
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<RespuestaEnvio | null>(null);

  async function enviar(datos: Record<string, unknown>): Promise<RespuestaEnvio> {
    setEnviando(true);
    setResultado(null);
    try {
      const respuesta = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, contexto: contextoActual() }),
      });
      const cuerpo = (await respuesta.json()) as RespuestaEnvio;
      const final: RespuestaEnvio = respuesta.ok
        ? cuerpo
        : { ok: false, error: cuerpo.error ?? "No se ha podido enviar", campos: cuerpo.campos };
      setResultado(final);
      return final;
    } catch {
      const fallo = { ok: false, error: "No hay conexión. Inténtalo otra vez en un momento." };
      setResultado(fallo);
      return fallo;
    } finally {
      setEnviando(false);
    }
  }

  return { enviar, enviando, resultado, reiniciar: () => setResultado(null) };
}
