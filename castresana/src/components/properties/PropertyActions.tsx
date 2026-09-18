import type { Property } from '@/types';
import { Button } from '@/components/shared';
import {
  CalendarIcon,
  FileIcon,
  HeartIcon,
  ShareIcon,
  WhatsappIcon,
} from '@/components/shared/Icons';
import styles from './PropertyActions.module.css';

export interface PropertyActionsProps {
  property: Property;
}

/**
 * CTAs comerciales de la ficha. En esta fase son maquetación: la agenda,
 * el dossier PDF y compartir se conectarán en fases posteriores.
 */
export function PropertyActions({ property }: PropertyActionsProps) {
  const sold = property.status === 'vendido';

  return (
    <section className={styles.actions} aria-label="Acciones comerciales">
      <Button variant="primary" size="lg" fullWidth iconLeft={<CalendarIcon size={17} />} disabled={sold}>
        Agendar visita
      </Button>
      <Button variant="secondary" size="md" fullWidth iconLeft={<WhatsappIcon size={16} />}>
        Enviar a un lead
      </Button>
      <div className={styles.row}>
        <Button variant="ghost" size="md" fullWidth iconLeft={<FileIcon size={15} />}>
          Dossier PDF
        </Button>
        <Button variant="ghost" size="md" fullWidth iconLeft={<ShareIcon size={15} />}>
          Compartir
        </Button>
        <Button variant="ghost" size="md" fullWidth iconLeft={<HeartIcon size={15} />}>
          Guardar
        </Button>
      </div>
    </section>
  );
}
