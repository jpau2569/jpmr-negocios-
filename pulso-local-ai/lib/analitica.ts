"use client";

// ============================================================================
//  Analítica del lado del cliente
// ----------------------------------------------------------------------------
//  Mide lo que le importa al negocio: cuánta gente escanea, qué platos se miran
//  y cuántos acaban pulsando reservar o WhatsApp. Sin un solo dato personal:
//  ni IP en claro, ni identificador de persona, ni cookies. Por eso esta web NO
//  necesita banner de consentimiento, que es precisamente lo que arruinaría la
//  experiencia de escanear un QR sentado en una mesa.
//
//  Se usa sendBeacon: sobrevive a que el usuario pulse un enlace y se vaya de
//  la página, que es justo cuando más interesa registrar el clic (whatsapp,
//  llamada, reseña).
// ============================================================================

import { huellaSesion } from "./utils";
import type { TipoEventoAnalitica } from "@/types/negocio";

interface Contexto {
  slug: string;
  qr?: string | null;
}

let contexto: Contexto | null = null;

export function iniciarAnalitica(nuevo: Contexto): void {
  contexto = nuevo;
}

export function medir(
  evento: TipoEventoAnalitica,
  extra: { subject_id?: string } = {},
): void {
  if (!contexto || typeof window === "undefined") return;

  const cuerpo = JSON.stringify({
    slug: contexto.slug,
    event_type: evento,
    ...(extra.subject_id ? { subject_id: extra.subject_id } : {}),
    ...(contexto.qr ? { qr: contexto.qr } : {}),
    path: window.location.pathname,
    session: huellaSesion(),
  });

  try {
    // sendBeacon no bloquea la navegación y llega aunque la pestaña se cierre.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/track", new Blob([cuerpo], { type: "application/json" }));
      return;
    }
    void fetch("/api/public/track", {
      method: "POST",
      body: cuerpo,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
  } catch {
    // Medir nunca puede romper la página: si falla, se pierde el dato y ya.
  }
}
