"use client";

import { useEffect } from "react";

/** Registra el service worker. Si falla, la web funciona igual. */
export function RegistrarPWA() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Sin PWA se vive: no merece molestar al usuario con un aviso.
      });
    }, 2000); // tras la carga, para no competir por ancho de banda
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
