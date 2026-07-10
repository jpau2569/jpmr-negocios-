/** Estados globales del juego. */
export type GameStateName = 'loading' | 'title' | 'playing' | 'paused' | 'won';

/** Eventos que cruzan módulos (juego ↔ UI). Tipado central para evitar strings sueltos. */
export interface GameEvents {
  'state-changed': { state: GameStateName };
  'coin-collected': { collected: number; total: number };
  'all-coins-collected': { timeSeconds: number };
}

/** Snapshot del input de un frame, ya normalizado. */
export interface InputFrame {
  moveX: number; // -1..1 (A/D)
  moveZ: number; // -1..1 (W/S)
  jump: boolean;
  run: boolean;
  lookDeltaX: number; // píxeles de ratón acumulados este frame
  lookDeltaY: number;
  zoomDelta: number;
}
