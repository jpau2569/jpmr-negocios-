/** Estados globales del juego. */
export type GameStateName = 'loading' | 'title' | 'playing' | 'paused' | 'won';

/**
 * Estado de locomoción del avatar. Única fuente de verdad de "qué está haciendo
 * el jugador": lo consume el animador (poses) y el snapshot de red (replicación).
 */
export type AvatarAnimState = 'idle' | 'walk' | 'run' | 'air';

/** Estado visible de una misión (para HUD y persistencia). */
export interface MissionInfo {
  id: string;
  title: string;
  progress: number;
  target: number;
  done: boolean;
}

/** Eventos que cruzan módulos (juego ↔ UI). Tipado central para evitar strings sueltos. */
export interface GameEvents {
  'state-changed': { state: GameStateName };
  'coin-collected': {
    collected: number;
    total: number;
    /** Posición mundial de la moneda (para partículas). Ausente en resets. */
    position?: { x: number; y: number; z: number };
  };
  'all-coins-collected': { timeSeconds: number };
  'missions-updated': { missions: MissionInfo[] };
  'mission-completed': { id: string; title: string };
  'checkpoint-reached': { index: number };
  'coins-changed': { coins: number };
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
