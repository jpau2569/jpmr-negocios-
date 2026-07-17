'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { IconButton } from '@/components/shared';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/shared/Icons';
import { SectionHeader } from './SectionHeader';
import styles from './PropertyRail.module.css';

export interface PropertyRailProps {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
}

/**
 * Rail horizontal genérico: cabecera editorial + pista con scroll-snap,
 * degradados en los bordes y flechas de paginación en desktop.
 * Los hijos (tarjetas) definen su propio ancho.
 */
export function PropertyRail({ title, subtitle, href, children }: PropertyRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateArrows]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' });
  };

  return (
    <section className={styles.rail}>
      <SectionHeader
        title={title}
        subtitle={subtitle}
        href={href}
        actions={
          <span className={styles.arrows}>
            <IconButton label="Anterior" size="sm" disabled={!canLeft} onClick={() => scrollBy(-1)}>
              <ChevronLeftIcon size={16} />
            </IconButton>
            <IconButton label="Siguiente" size="sm" disabled={!canRight} onClick={() => scrollBy(1)}>
              <ChevronRightIcon size={16} />
            </IconButton>
          </span>
        }
      />

      <div className={styles.viewport}>
        <div
          ref={trackRef}
          className={cn(styles.track)}
          onScroll={updateArrows}
          role="list"
          aria-label={title}
        >
          {children}
        </div>
        <span className={cn(styles.fade, styles.fadeLeft, canLeft && styles.fadeVisible)} />
        <span className={cn(styles.fade, styles.fadeRight, canRight && styles.fadeVisible)} />
      </div>
    </section>
  );
}
