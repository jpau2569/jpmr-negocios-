'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker básico (/sw.js) — solo en producción para no
 * interferir con el HMR de desarrollo. La lógica avanzada de caché llegará
 * en la fase PWA completa.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      console.warn('[Castresana] Registro de service worker fallido:', error);
    });
  }, []);

  return null;
}
