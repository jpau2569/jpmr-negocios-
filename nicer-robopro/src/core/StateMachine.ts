import type { GameStateName } from '../types';

/**
 * Un estado del juego. Solo el estado ACTIVO recibe `update(dt)`, de modo que
 * la lógica de simulación vive en el estado y no en `if`s dentro del bucle.
 *
 * Los estados triviales (title, paused, won) se definen como objetos literales.
 * Los estados con lógica propia y pesada (p. ej. el minijuego contrarreloj o el
 * modo construcción del Sprint 2) deberían ser su propio módulo que implemente
 * esta interfaz, recibiendo el contexto que necesiten por constructor.
 */
export interface GameState {
  readonly name: GameStateName;
  /** Se ejecuta al entrar en el estado (mostrar UI, capturar input, resetear timers…). */
  onEnter?(): void;
  /** Se ejecuta al salir (limpiar, soltar recursos…). */
  onExit?(): void;
  /** Actualización por frame del estado activo (dt en segundos, ya clampado). */
  update?(dt: number): void;
}

/**
 * Máquina de estados explícita: registra estados y gestiona transiciones con
 * hooks enter/exit. Notifica cada cambio por un callback (que el juego usa para
 * emitir `state-changed` por el EventBus, preservando el contrato con la UI).
 */
export class StateMachine {
  private states = new Map<GameStateName, GameState>();
  private currentState: GameState | null = null;

  constructor(private onChange?: (name: GameStateName) => void) {}

  register(...states: GameState[]): void {
    for (const s of states) this.states.set(s.name, s);
  }

  get current(): GameStateName | null {
    return this.currentState?.name ?? null;
  }

  is(name: GameStateName): boolean {
    return this.currentState?.name === name;
  }

  /** Cambia de estado (no-op si ya es el actual). Corre onExit/onEnter y notifica. */
  transition(to: GameStateName): void {
    if (this.currentState?.name === to) return;
    const next = this.states.get(to);
    if (!next) throw new Error(`StateMachine: estado desconocido "${to}"`);
    this.currentState?.onExit?.();
    this.currentState = next;
    next.onEnter?.();
    this.onChange?.(to);
  }

  /** Delegado al update del estado activo; los estados sin update no hacen nada. */
  update(dt: number): void {
    this.currentState?.update?.(dt);
  }
}
