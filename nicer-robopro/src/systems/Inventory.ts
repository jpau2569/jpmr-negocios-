import type { EventBus } from '../core/EventBus';

/**
 * Progreso local persistido en localStorage: saldo de monedas (gastable en la
 * tienda), mejores tiempos por mundo, trofeos de misiones y cosméticos
 * desbloqueados. Es la semilla del futuro perfil online: el mismo shape podrá
 * vivir en el servidor.
 */
export interface SaveData {
  coins: number; // saldo gastable
  bestTimes: Record<string, number>; // worldId → mejor tiempo (s)
  trophies: string[];
  unlocked: string[]; // ids de cosméticos comprados
  cartridges: number; // cargadores de agua para recargar la pistola
  lifetimeCoins: number; // monedas totales recogidas (para el cargador gratis cada 100)
}

const STORAGE_KEY = 'nicer-robopro:save-v1';
const FREE_CARTRIDGE_EVERY = 100;

export class Inventory {
  private data: SaveData = {
    coins: 0, bestTimes: {}, trophies: [], unlocked: [], cartridges: 2, lifetimeCoins: 0,
  };

  constructor(private events: EventBus) {
    this.load();

    events.on('coin-collected', ({ collected }) => {
      // Solo las recogidas reales (collected>0) suman; los resets emiten 0.
      if (collected > 0) {
        this.data.coins++;
        this.data.lifetimeCoins++;
        // Cargador de agua gratis cada 100 monedas recogidas.
        if (this.data.lifetimeCoins % FREE_CARTRIDGE_EVERY === 0) {
          this.data.cartridges++;
          this.events.emit('cartridges-changed', { cartridges: this.data.cartridges, awarded: true });
        }
        this.save();
        this.emitCoins();
      }
    });

    events.on('mission-completed', ({ id }) => {
      if (!this.data.trophies.includes(id)) {
        this.data.trophies.push(id);
        this.save();
      }
    });
  }

  get coins(): number {
    return this.data.coins;
  }

  get cartridges(): number {
    return this.data.cartridges;
  }

  /** Añade monedas de bonificación (regalos). */
  addCoins(n: number): void {
    this.data.coins += n;
    this.save();
    this.emitCoins();
  }

  /** Añade cargadores (compra en tienda). */
  addCartridge(n = 1): void {
    this.data.cartridges += n;
    this.save();
    this.events.emit('cartridges-changed', { cartridges: this.data.cartridges, awarded: false });
  }

  /** Consume un cargador si hay; devuelve true si se pudo recargar. */
  useCartridge(): boolean {
    if (this.data.cartridges <= 0) return false;
    this.data.cartridges--;
    this.save();
    this.events.emit('cartridges-changed', { cartridges: this.data.cartridges, awarded: false });
    return true;
  }

  get trophyCount(): number {
    return this.data.trophies.length;
  }

  /** Mejor tiempo global (mínimo entre mundos) para la pantalla de pausa. */
  get bestTimeSeconds(): number | null {
    const times = Object.values(this.data.bestTimes);
    return times.length ? Math.min(...times) : null;
  }

  getBestTime(worldId: string): number | null {
    return this.data.bestTimes[worldId] ?? null;
  }

  /** Registra un tiempo; devuelve true si es nuevo récord del mundo. */
  recordBestTime(worldId: string, seconds: number): boolean {
    const prev = this.data.bestTimes[worldId];
    if (prev === undefined || seconds < prev) {
      this.data.bestTimes[worldId] = seconds;
      this.save();
      return true;
    }
    return false;
  }

  // --- Tienda ---
  canAfford(price: number): boolean {
    return this.data.coins >= price;
  }

  /** Gasta monedas si hay saldo; devuelve true si se realizó la compra. */
  spend(price: number): boolean {
    if (this.data.coins < price) return false;
    this.data.coins -= price;
    this.save();
    this.emitCoins();
    return true;
  }

  isUnlocked(id: string): boolean {
    return this.data.unlocked.includes(id);
  }

  unlock(id: string): void {
    if (!this.data.unlocked.includes(id)) {
      this.data.unlocked.push(id);
      this.save();
    }
  }

  /** Reemite el saldo como evento de moneda para refrescar HUD/tienda. */
  private emitCoins(): void {
    this.events.emit('coins-changed', { coins: this.data.coins });
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<SaveData> & { totalCoins?: number };
        this.data = {
          // Migración: saves antiguos guardaban `totalCoins`.
          coins: typeof p.coins === 'number' ? p.coins : typeof p.totalCoins === 'number' ? p.totalCoins : 0,
          bestTimes: p.bestTimes && typeof p.bestTimes === 'object' ? p.bestTimes : {},
          trophies: Array.isArray(p.trophies) ? p.trophies.filter((t) => typeof t === 'string') : [],
          unlocked: Array.isArray(p.unlocked) ? p.unlocked.filter((t) => typeof t === 'string') : [],
          cartridges: typeof p.cartridges === 'number' ? p.cartridges : 2,
          lifetimeCoins: typeof p.lifetimeCoins === 'number' ? p.lifetimeCoins : 0,
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
