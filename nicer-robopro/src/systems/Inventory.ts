import type { EventBus } from '../core/EventBus';

/**
 * Inventario/progreso local persistido en localStorage: monedas totales
 * acumuladas entre partidas, trofeos de misiones y mejor tiempo.
 * Es la semilla del futuro perfil de jugador online (Fase 4): el mismo
 * shape de datos podrá vivir en el servidor.
 */
export interface SaveData {
  totalCoins: number;
  bestTimeSeconds: number | null;
  trophies: string[];
}

const STORAGE_KEY = 'nicer-robopro:save-v1';

export class Inventory {
  private data: SaveData = { totalCoins: 0, bestTimeSeconds: null, trophies: [] };

  constructor(events: EventBus) {
    this.load();

    events.on('coin-collected', ({ collected }) => {
      if (collected > 0) {
        // Cada evento real de recogida es exactamente una moneda (los resets emiten collected=0).
        this.data.totalCoins++;
        this.save();
      }
    });

    events.on('mission-completed', ({ id }) => {
      if (!this.data.trophies.includes(id)) {
        this.data.trophies.push(id);
        this.save();
      }
    });

    events.on('all-coins-collected', ({ timeSeconds }) => {
      if (this.data.bestTimeSeconds === null || timeSeconds < this.data.bestTimeSeconds) {
        this.data.bestTimeSeconds = timeSeconds;
        this.save();
      }
    });
  }

  get totalCoins(): number {
    return this.data.totalCoins;
  }

  get trophyCount(): number {
    return this.data.trophies.length;
  }

  get bestTimeSeconds(): number | null {
    return this.data.bestTimeSeconds;
  }

  /** ¿Es este tiempo el récord guardado? (para celebrarlo en la UI) */
  isBestTime(timeSeconds: number): boolean {
    return this.data.bestTimeSeconds !== null && timeSeconds <= this.data.bestTimeSeconds;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = {
          totalCoins: typeof parsed.totalCoins === 'number' ? parsed.totalCoins : 0,
          bestTimeSeconds:
            typeof parsed.bestTimeSeconds === 'number' ? parsed.bestTimeSeconds : null,
          trophies: Array.isArray(parsed.trophies) ? parsed.trophies.filter((t) => typeof t === 'string') : [],
        };
      }
    } catch {
      // Storage no disponible o corrupto: se juega sin persistencia.
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignorar: sin persistencia.
    }
  }
}
