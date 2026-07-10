import type { EventBus } from '../core/EventBus';
import type { GameStateName, MissionInfo } from '../types';

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
  private winBest: HTMLElement;
  private missionsPanel: HTMLElement;
  private pauseStats: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;

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
    this.winBest = get('win-best');
    this.missionsPanel = get('hud-missions');
    this.pauseStats = get('pause-stats');
    this.toast = get('hud-toast');

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
    events.on('missions-updated', ({ missions }) => this.renderMissions(missions));
    events.on('mission-completed', ({ title }) => this.showToast(`✔ ${title}`));
  }

  private renderMissions(missions: MissionInfo[]): void {
    this.missionsPanel.replaceChildren(
      ...missions.map((m) => {
        const row = document.createElement('div');
        row.className = m.done ? 'mission done' : 'mission';
        const check = document.createElement('span');
        check.className = 'check';
        check.textContent = m.done ? '✔' : '';
        const title = document.createElement('span');
        title.textContent = m.title;
        const prog = document.createElement('span');
        prog.className = 'prog';
        prog.textContent = `${m.progress}/${m.target}`;
        row.append(check, title, prog);
        return row;
      }),
    );
  }

  /** Aviso temporal centrado (misión completada). */
  private showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.remove('hidden');
    // Reinicia la animación CSS si el toast anterior sigue visible.
    this.toast.style.animation = 'none';
    void this.toast.offsetWidth;
    this.toast.style.animation = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.add('hidden'), 2600);
  }

  /** Estadísticas persistentes (inventario) para el menú de pausa. */
  setStats(totalCoins: number, trophies: number, bestTime: number | null): void {
    this.pauseStats.replaceChildren(
      statBlock(String(totalCoins), 'monedas totales'),
      statBlock(String(trophies), 'trofeos'),
      statBlock(bestTime === null ? '—' : formatTime(bestTime), 'mejor tiempo'),
    );
  }

  setWinBest(text: string): void {
    this.winBest.textContent = text;
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

function statBlock(value: string, label: string): HTMLElement {
  const el = document.createElement('span');
  const b = document.createElement('b');
  b.textContent = value;
  el.append(b, label);
  return el;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
