import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AuthGate } from '@/components/providers/AuthGate';

/**
 * Layout de las rutas privadas: exige sesión (o modo demo) y monta el
 * armazón de la app. /login queda fuera de este grupo, sin AppShell.
 */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
