'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { authErrorMessage } from '@/lib/firebase/auth';
import { Wordmark } from '@/components/branding/Wordmark';
import { Button } from '@/components/shared';
import styles from './login.module.css';

/**
 * Login — email/password contra Firebase Auth.
 * Sin proyecto configurado muestra el acceso en modo demo (seeds locales).
 */
export default function LoginPage() {
  const { demoMode, signIn, user } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sesión ya iniciada: directo al inbox.
  if (user) {
    router.replace('/inbox');
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/inbox');
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Wordmark />
        </div>

        {demoMode ? (
          <>
            <h1 className={styles.title}>Modo demo</h1>
            <p className={styles.text}>
              No hay proyecto Firebase configurado en este entorno, así que la app
              funciona con datos de ejemplo locales. Configura las variables de{' '}
              <code>.env.local</code> para activar el acceso con cuenta.
            </p>
            <Button variant="primary" size="lg" fullWidth onClick={() => router.replace('/inbox')}>
              Entrar en la demo
            </Button>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Acceso interno</h1>
            <p className={styles.text}>Software de gestión de Asesoría Castresana.</p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  placeholder="tu@asesoriacastresana.es"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Contraseña</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" fullWidth disabled={submitting}>
                {submitting ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
