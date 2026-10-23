import { Logo } from './Logo';
import styles from './Wordmark.module.css';

/**
 * Wordmark — logo + nombre de producto + subtítulo.
 * `compact` oculta el texto (rail estrecho / móvil).
 */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.wordmark}>
      <Logo size={30} />
      {!compact && (
        <span className={styles.text}>
          <span className={styles.name}>Castresana</span>
          <span className={styles.tagline}>Inbox inmobiliario</span>
        </span>
      )}
    </span>
  );
}
