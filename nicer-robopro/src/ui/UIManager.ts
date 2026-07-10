import type { EventBus } from '../core/EventBus';
import type { GameStateName } from '../types';

/**
 * Gestión de toda la UI HTML: pantallas (inicio, pausa, victoria, carga) y HUD.
 * Escucha el bus de eventos para actualizarse y expone callbacks que el juego
 * conecta a sus acciones (jugar, continuar, reiniciar). No conoce nada de Three/Rapier.
 */
export class UIManager {
  onPlay: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;

  private screens: Record<string, HTMLElement>;
  private hud: HTMLElement;
  private coinCount: HTMLElement;
  private timeLabel: HTMLElement;
  private winTime: HTMLElement;

  constructor(events: EventBus) {
    const get = (id: string): HTMLElement => {
      const el = document.getElementById(id);
      if (!el) throw new Error(`UI: falta el elemento #${id}`);
      return el;
    };

    this.screens = {
      loading: get('screen-loading'),
      title: get('screen-title'),
      paused: get('screen-pause'),
      won: get('screen-win'),
    };
    this.hud = get('hud');
    this.coinCount = get('hud-coin-count');
    this.timeLabel = get('hud-time');
    this.winTime = get('win-time');

    get('btn-play').addEventListener('click', () => this.onPlay?.());
    get('btn-resume').addEventListener('click', () => this.onResume?.());
    get('btn-restart').addEventListener('click', () => this.onRestart?.());
    get('btn-win-restart').addEventListener('click', () => this.onRestart?.());

    events.on('state-changed', ({ state }) => this.showState(state));
    events.on('coin-collected', ({ collected, total }) => {
      this.coinCount.textContent = `${collected} / ${total}`;
      if (collected > 0) this.pulseCoins();
    });
    events.on('all-coins-collected', ({ timeSeconds }) => {
      this.winTime.textContent = formatTime(timeSeconds);
    });
  }

  private showState(state: GameStateName): void {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== state);
    }
    this.hud.classList.toggle('hidden', state !== 'playing' && state !== 'paused');
  }

  updateTimer(seconds: number): void {
    this.timeLabel.textContent = formatTime(seconds);
  }

  private pulseCoins(): void {
    const panel = this.coinCount.parentElement;
    if (!panel) return;
    panel.classList.remove('pulse');
    void panel.offsetWidth; // reinicia la animación CSS
    panel.classList.add('pulse');
  }
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
