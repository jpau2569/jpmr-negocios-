/* ============================================================================
   Repositorios — decisión de fuente de datos
   ----------------------------------------------------------------------------
   Regla única para toda la capa:
     · Firestore cuando hay proyecto configurado Y estamos en navegador
       (las reglas exigen usuario autenticado; en SSR no hay sesión).
     · Seeds locales en cualquier otro caso (modo demo y SSR/SSG).

   Consecuencia deliberada: las páginas server-rendered pintan datos seed y,
   si hay Firebase, los componentes cliente pueden refrescar contra Firestore.
   Cuando montemos SSR autenticado (cookies de sesión + Admin SDK) solo habrá
   que cambiar esta función, no los repositorios ni la UI.
   ============================================================================ */

import { isBrowser, isFirebaseConfigured } from '@/lib/firebase/client';

export function useFirestoreSource(): boolean {
  return isFirebaseConfigured() && isBrowser();
}
