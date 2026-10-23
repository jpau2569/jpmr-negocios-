import type { CSSProperties, ReactNode } from 'react';
import type { PropertyKind } from '@/types';
import { cn } from '@/lib/utils/cn';
import { BuildingIcon } from './Icons';
import styles from './MediaFrame.module.css';

export interface MediaFrameProps {
  /** Par de colores del gradiente placeholder (de la paleta de marca). */
  palette: [string, string];
  /** Marca de agua central; por defecto el edificio del monograma. */
  kind?: PropertyKind;
  /** Overlays: badges, precio, play, duración… posicionados por el padre. */
  children?: ReactNode;
  className?: string;
}

/**
 * MediaFrame — «fotografía» placeholder premium: gradiente cálido de la
 * paleta + veladura de textura + marca de agua fina. Cuando existan fotos
 * reales, este componente pasará a renderizar <Image> con el mismo marco.
 */
export function MediaFrame({ palette, children, className }: MediaFrameProps) {
  const style = {
    '--media-a': palette[0],
    '--media-b': palette[1],
  } as CSSProperties;

  return (
    <div className={cn(styles.frame, className)} style={style}>
      <span className={styles.watermark}>
        <BuildingIcon size={34} />
      </span>
      {children}
    </div>
  );
}
