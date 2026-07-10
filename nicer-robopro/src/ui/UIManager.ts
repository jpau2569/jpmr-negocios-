import type { EventBus } from '../core/EventBus';
import type { GameStateName, MissionInfo } from '../types';
import {
  type AvatarConfig, type HatId, loadAvatar, TORSO_COLORS, LEG_COLORS, SKIN_COLORS, HATS, HAT_PRICES,
} from '../player/AvatarConfig';

/**
 * Gestión de toda la UI HTML: pantallas (inicio, pausa, victoria, carga) y HUD.
 * Escucha el bus de eventos para actualizarse y expone callbacks que el juego
 * conecta a sus acciones (jugar, continuar, reiniciar). No conoce nada de Three/Rapier.
 */
export class UIManager {
  onPlay: (() => void) | null = null;
  onResume: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  /** Preview en vivo al cambiar una opción del avatar. */
  onAvatarChange: ((config: AvatarConfig) => void) | null = null;
  /** Al pulsar "Listo": persistir la configuración elegida. */
  onAvatarDone: ((config: AvatarConfig) => void) | null = null;
  /** Tienda: intenta comprar un gorro; devuelve true si la compra se realiza. */
  onBuyHat: ((hat: HatId, price: number) => boolean) | null = null;
  isHatUnlocked: ((hat: HatId) => boolean) | null = null;
  getCoins: (() => number) | null = null;

  private avatarConfig: AvatarConfig = loadAvatar();
  private czCoins!: HTMLElement;
  private czHats!: HTMLElement;

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
  private portalPrompt: HTMLElement;

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
    this.portalPrompt = get('hud-portal');

    get('btn-play').addEventListener('click', () => this.onPlay?.());
    get('btn-resume').addEventListener('click', () => this.onResume?.());
    get('btn-restart').addEventListener('click', () => this.onRestart?.());
    get('btn-win-restart').addEventListener('click', () => this.onRestart?.());

    // --- Personalizador ---
    const screenCustomize = get('screen-customize');
    const screenTitle = this.screens.title;
    this.czCoins = get('cz-coins');
    this.czHats = get('cz-hats');
    get('btn-customize').addEventListener('click', () => {
      this.refreshShop();
      screenTitle.classList.add('hidden');
      screenCustomize.classList.remove('hidden');
    });
    get('btn-customize-done').addEventListener('click', () => {
      screenCustomize.classList.add('hidden');
      screenTitle.classList.remove('hidden');
      this.onAvatarDone?.(this.avatarConfig);
    });
    this.buildColorSwatches(get('cz-torso'), TORSO_COLORS, 'torso');
    this.buildColorSwatches(get('cz-legs'), LEG_COLORS, 'legs');
    this.buildColorSwatches(get('cz-skin'), SKIN_COLORS, 'skin');

    // El saldo mostrado en la tienda se refresca al cambiar las monedas.
    events.on('coins-changed', () => { this.czCoins.textContent = String(this.getCoins?.() ?? 0); });

    events.on('state-changed', ({ state }) => this.showState(state));
    events.on('coin-collected', ({ collected, total }) => {
      this.coinCount.textContent = `${collected} / ${total}`;
      // Mundos sin monedas (el hub) ocultan el contador.
      this.coinCount.parentElement?.classList.toggle('hidden', total === 0);
      if (collected > 0) this.pulseCoins();
    });
    events.on('missions-updated', ({ missions }) => this.renderMissions(missions));
    events.on('mission-completed', ({ title }) => this.showToast(`✔ ${title}`));
    events.on('checkpoint-reached', () => this.showToast('🚩 ¡Checkpoint!'));
  }

  private renderMissions(missions: MissionInfo[]): void {
    // Mundos sin misiones (el hub) ocultan el panel entero.
    this.missionsPanel.classList.toggle('hidden', missions.length === 0);
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

  setWinTime(seconds: number): void {
    this.winTime.textContent = formatTime(seconds);
  }

  setWinBest(text: string): void {
    this.winBest.textContent = text;
  }

  /** Configuración de avatar cargada (para crear el jugador con ella). */
  get avatar(): AvatarConfig {
    return this.avatarConfig;
  }

  private buildColorSwatches(
    container: HTMLElement,
    colors: number[],
    slot: 'torso' | 'legs' | 'skin',
  ): void {
    const buttons: HTMLButtonElement[] = [];
    for (const color of colors) {
      const btn = document.createElement('button');
      btn.className = 'cz-swatch';
      btn.style.background = '#' + color.toString(16).padStart(6, '0');
      if (this.avatarConfig[slot] === color) btn.classList.add('sel');
      btn.addEventListener('click', () => {
        this.avatarConfig = { ...this.avatarConfig, [slot]: color };
        for (const b of buttons) b.classList.remove('sel');
        btn.classList.add('sel');
        this.onAvatarChange?.(this.avatarConfig);
      });
      buttons.push(btn);
      container.appendChild(btn);
    }
  }

  /** Refresca la tienda (saldo + gorros) según monedas y desbloqueos actuales. */
  private refreshShop(): void {
    this.czCoins.textContent = String(this.getCoins?.() ?? 0);
    this.buildHatButtons(this.czHats);
  }

  private buildHatButtons(container: HTMLElement): void {
    container.replaceChildren();
    const buttons: HTMLButtonElement[] = [];
    for (const { id, label } of HATS) {
      const price = HAT_PRICES[id];
      const owned = price === 0 || (this.isHatUnlocked?.(id) ?? false);
      const btn = document.createElement('button');
      btn.className = 'cz-hat';
      btn.textContent = label;
      if (!owned) {
        btn.classList.add('locked');
        const tag = document.createElement('span');
        tag.className = 'price';
        tag.textContent = `${price}🪙`;
        btn.appendChild(tag);
      }
      if (this.avatarConfig.hat === id) btn.classList.add('sel');

      btn.addEventListener('click', () => {
        // Si es de pago y no se posee, intentar comprarlo.
        if (!(price === 0 || (this.isHatUnlocked?.(id) ?? false))) {
          const bought = this.onBuyHat?.(id, price) ?? false;
          if (!bought) {
            this.showToast('Te faltan monedas');
            return;
          }
        }
        this.avatarConfig = { ...this.avatarConfig, hat: id };
        this.onAvatarChange?.(this.avatarConfig);
        this.refreshShop(); // re-render: quita el candado y marca selección
      });
      buttons.push(btn);
      container.appendChild(btn);
    }
  }

  /** Muestra/oculta el aviso de portal cercano (null = ocultar). */
  setPortalPrompt(label: string | null): void {
    if (label) {
      this.portalPrompt.innerHTML = `▶ <b>${label}</b>`;
      this.portalPrompt.classList.remove('hidden');
    } else {
      this.portalPrompt.classList.add('hidden');
    }
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
