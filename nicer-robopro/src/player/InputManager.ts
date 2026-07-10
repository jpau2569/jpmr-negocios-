import type { InputFrame } from '../types';

/**
 * Captura de input crudo (teclado, ratón con pointer lock, rueda) y
 * conversión a un InputFrame normalizado por frame. Los deltas de ratón
 * se acumulan entre frames y se consumen al leer.
 */
export class InputManager {
  private keys = new Set<string>();
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private zoomDelta = 0;
  private jumpQueued = false;

  /** Callback para que el juego reaccione al perder el pointer lock (→ pausa). */
  onPointerLockLost: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        if (e.code === 'Space') this.jumpQueued = true;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.lookDeltaX += e.movementX;
        this.lookDeltaY += e.movementY;
      }
    });
    window.addEventListener('wheel', (e) => {
      if (document.pointerLockElement === this.canvas) this.zoomDelta += e.deltaY;
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) {
        this.keys.clear();
        this.onPointerLockLost?.();
      }
    });
  }

  requestPointerLock(): void {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /** Lee el estado del frame actual y resetea los acumuladores de ratón. */
  consumeFrame(): InputFrame {
    const frame: InputFrame = {
      moveX: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      moveZ: (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0),
      jump: this.jumpQueued,
      run: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      lookDeltaX: this.lookDeltaX,
      lookDeltaY: this.lookDeltaY,
      zoomDelta: this.zoomDelta,
    };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.zoomDelta = 0;
    this.jumpQueued = false;
    return frame;
  }
}
