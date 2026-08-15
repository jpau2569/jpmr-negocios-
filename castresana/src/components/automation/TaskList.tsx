'use client';

import { useState } from 'react';
import type { Task } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatDay, formatTime } from '@/lib/utils/format';
import { CheckIcon } from '@/components/shared/Icons';
import styles from './TaskList.module.css';

export interface TaskListProps {
  tasks: Task[];
  /** Muestra el origen (workflow/manual) si se conoce. */
  dense?: boolean;
  now?: string; // ISO — para marcar vencidas de forma estable
}

/**
 * Lista de tareas comerciales con check local (la persistencia llegará con
 * Firestore; el estado optimista ya se comporta como el definitivo).
 */
export function TaskList({ tasks, dense, now }: TaskListProps) {
  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(tasks.filter((t) => t.done).map((t) => t.id)),
  );
  const nowMs = now ? new Date(now).getTime() : Date.now();

  const toggle = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tasks.length === 0) {
    return <p className={styles.empty}>Sin tareas pendientes.</p>;
  }

  return (
    <ul className={cn(styles.list, dense && styles.dense)}>
      {tasks.map((task) => {
        const done = doneIds.has(task.id);
        const overdue = !done && new Date(task.dueAt).getTime() < nowMs;
        return (
          <li key={task.id} className={cn(styles.item, done && styles.done)}>
            <button
              type="button"
              className={cn(styles.check, done && styles.checked)}
              onClick={() => toggle(task.id)}
              aria-label={done ? 'Marcar pendiente' : 'Marcar completada'}
            >
              {done && <CheckIcon size={12} />}
            </button>
            <span className={styles.body}>
              <span className={styles.title}>{task.title}</span>
              {!dense && task.detail && <span className={styles.detail}>{task.detail}</span>}
              <span className={cn(styles.due, overdue && styles.overdue)}>
                {overdue ? 'Vencida · ' : 'Vence '}
                {formatDay(task.dueAt)} · {formatTime(task.dueAt)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
