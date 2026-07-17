/**
 * Registro del service worker.
 *
 * De momento /sw.js es un PLACEHOLDER (no cachea nada; solo instala/activa).
 * Cuando definamos la estrategia real de caché (App Shell + runtime caching),
 * el registro ya estará en su sitio y solo cambiará el contenido de /sw.js.
 *
 * Se invoca desde un componente cliente montado en el layout raíz.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Evitamos registrar en desarrollo para no interferir con el HMR de Next.
  if (process.env.NODE_ENV !== 'production') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      // Silencioso en producción; visible en consola para depuración.
      console.warn('[Castresana] No se pudo registrar el service worker:', error);
    });
  });
}
