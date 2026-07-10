/**
 * Capa de red abstracta (preparación para la Fase 3/4 con Colyseus).
 *
 * El juego habla SIEMPRE con esta interfaz, nunca con una librería concreta.
 * Hoy corre con LocalNetworkAdapter (loopback, sin servidor); mañana un
 * ColyseusAdapter implementará la misma interfaz y el resto del código
 * no cambia. Claves del diseño:
 *
 * - El input local se aplica de inmediato (predicción); los snapshots
 *   remotos llegarán por onSnapshot y el servidor será autoritativo.
 * - PlayerSnapshot es serializable a JSON plano (compatible con el
 *   schema de Colyseus) y contiene solo lo mínimo para replicar un avatar.
 */

/** Estado replicable de un avatar. Debe mantenerse plano y serializable. */
export interface PlayerSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  heading: number; // orientación del avatar (rad)
  anim: 'idle' | 'walk' | 'run' | 'air';
}

export interface NetworkAdapter {
  readonly connected: boolean;
  /** Conecta a una sala. En local resuelve inmediatamente. */
  connect(roomId?: string): Promise<void>;
  disconnect(): void;
  /** Publica el estado del jugador local (se llamará a ~10 Hz, no por frame). */
  sendSnapshot(snapshot: PlayerSnapshot): void;
  /** Snapshots de OTROS jugadores. En local no se emite nunca. */
  onSnapshot(handler: (snapshot: PlayerSnapshot) => void): () => void;
  onPlayerLeft(handler: (id: string) => void): () => void;
}

/**
 * Adaptador local (offline): implementa el contrato completo sin servidor.
 * Guarda el último snapshot enviado, útil para depuración y para validar
 * que el shape de datos es correcto antes de tener backend.
 */
export class LocalNetworkAdapter implements NetworkAdapter {
  connected = false;
  lastSent: PlayerSnapshot | null = null;

  async connect(): Promise<void> {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  sendSnapshot(snapshot: PlayerSnapshot): void {
    if (this.connected) this.lastSent = snapshot;
  }

  onSnapshot(): () => void {
    return () => {}; // sin jugadores remotos en local
  }

  onPlayerLeft(): () => void {
    return () => {};
  }
}
