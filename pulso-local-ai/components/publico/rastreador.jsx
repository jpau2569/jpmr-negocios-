"use client";
// ============================================================================
//  Rastreador
// ----------------------------------------------------------------------------
//  Envuelve cualquier elemento pulsable y registra el evento al pulsarlo, sin
//  interceptar la navegación: el enlace sigue funcionando igual (sendBeacon no
//  bloquea). Así un botón de WhatsApp o de reseña se mide sin cambiar nada de
//  su comportamiento.
//
//  <Vista> es la versión para "se ha visto esta sección", que se dispara una
//  sola vez al montar.
// ============================================================================
import { useEffect, useRef } from "react";
import { iniciarAnalitica, medir } from "@/lib/analitica";
export function Rastreador({ evento, subjectId, children, }) {
    return (<span className="contents" onClickCapture={() => medir(evento, subjectId ? { subject_id: subjectId } : {})}>
      {children}
    </span>);
}
/** Registra una vista una sola vez, aunque React vuelva a montar en desarrollo. */
export function Vista({ evento, subjectId }) {
    const yaEnviado = useRef(false);
    useEffect(() => {
        if (yaEnviado.current)
            return;
        yaEnviado.current = true;
        medir(evento, subjectId ? { subject_id: subjectId } : {});
    }, [evento, subjectId]);
    return null;
}
/**
 * Arranca la analítica con el negocio y el QR de origen.
 * El token del QR se guarda en la sesión: si alguien escanea el QR de la mesa
 * y luego navega a la carta y reserva, esa reserva sigue atribuida a la mesa.
 */
export function IniciarAnalitica({ slug, qr }) {
    useEffect(() => {
        let token = qr ?? null;
        try {
            const CLAVE = `plai:qr:${slug}`;
            if (token)
                sessionStorage.setItem(CLAVE, token);
            else
                token = sessionStorage.getItem(CLAVE);
        }
        catch {
            // Navegación privada: se mide sin atribuir a un QR.
        }
        iniciarAnalitica({ slug, qr: token });
        medir("qr_landing_view");
    }, [slug, qr]);
    return null;
}
