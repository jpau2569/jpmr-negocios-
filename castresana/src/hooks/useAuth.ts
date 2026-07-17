'use client';

/** Punto de acceso canónico a la sesión: const { user, demoMode } = useAuth(). */
export { useAuthContext as useAuth } from '@/components/providers/AuthProvider';
export type { AuthContextValue } from '@/components/providers/AuthProvider';
