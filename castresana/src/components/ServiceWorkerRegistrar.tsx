'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/registerServiceWorker';

/** Registra el service worker una vez montada la app (solo en producción). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
