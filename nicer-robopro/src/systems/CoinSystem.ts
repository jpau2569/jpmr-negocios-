import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import type { EventBus } from '../core/EventBus';

/** Definición de moneda: posición, color, valor en puntos y si es premium. */
export interface CoinDef {
  pos: THREE.Vector3;
  color: number;
  value: number;
  premium: boolean;
}

interface Coin {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  collected: boolean;
  popTime: number; // >0 mientras dura la animación de recogida
  phase: number;
  value: number;
}

/**
 * Monedas/pickups: cada moneda es un grupo (disco metálico + aro brillante) que
 * gira y flota. Las premium van coloreadas y valen más puntos. Detecta la
 * recogida por proximidad (y por impacto de agua vía tryHit) y admite el imán
 * de monedas (E). Emite eventos para HUD, puntos y victoria.
 */
export class CoinSystem {
  readonly group = new THREE.Group();
  private coins: Coin[] = [];
  private collectedCount = 0;
  private time = 0;
  private discGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24);
  private rimGeo = new THREE.TorusGeometry(0.4, 0.06, 8, 24);
  private matCache = new Map<number, THREE.MeshStandardMaterial>();

  constructor(defs: CoinDef[], private events: EventBus) {
    this.discGeo.rotateX(Math.PI / 2); // de pie, como una moneda clásica
    defs.forEach((def, i) => {
      const obj = this.buildCoin(def);
      obj.position.copy(def.pos);
      this.group.add(obj);
      this.coins.push({ obj, basePos: def.pos.clone(), collected: false, popTime: 0, phase: i * 0.7, value: def.value });
    });
  }

  private material(color: number, emissive: number): THREE.MeshStandardMaterial {
    const key = color * 3 + emissive;
    let m = this.matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: emissive, roughness: 0.22, metalness: 0.8,
      });
      this.matCache.set(key, m);
    }
    return m;
  }

  private buildCoin(def: CoinDef): THREE.Group {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(this.discGeo, this.material(def.color, def.premium ? 1.7 : 1.3));
    disc.castShadow = true;
    g.add(disc);
    // Aro claro que resalta el canto y florece con el bloom.
    const rim = new THREE.Mesh(this.rimGeo, this.material(def.premium ? 0xffffff : 0xfff0b0, 1.2));
    g.add(rim);
    if (def.premium) g.scale.setScalar(1.15);
    return g;
  }

  dispose(): void {
    this.group.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
    for (const m of this.matCache.values()) m.dispose();
    this.matCache.clear();
    this.discGeo.dispose();
    this.rimGeo.dispose();
    this.group.clear();
  }

  get total(): number {
    return this.coins.length;
  }

  get collected(): number {
    return this.collectedCount;
  }

  /** `magnetRange`>0 atrae las monedas cercanas hacia el jugador (power-up imán). */
  update(dt: number, playerPos: THREE.Vector3, elapsedSeconds: number, magnetRange = 0): void {
    this.time += dt;
    const c = CONFIG.coins;
    const r2 = c.pickupRadius * c.pickupRadius;

    for (const coin of this.coins) {
      if (coin.collected) {
        if (coin.popTime > 0) {
          coin.popTime -= dt;
          const t = 1 - Math.max(coin.popTime, 0) / 0.25;
          coin.obj.position.y = coin.basePos.y + t * 1.2;
          coin.obj.scale.setScalar(Math.max(1.15 - t, 0.001));
          coin.obj.rotation.y += dt * 20;
          if (coin.popTime <= 0) coin.obj.visible = false;
        }
        continue;
      }

      coin.obj.rotation.y = this.time * c.spinSpeed + coin.phase;

      // Imán: si está dentro del radio, la moneda vuela hacia el jugador.
      if (magnetRange > 0) {
        const d2 = coin.obj.position.distanceToSquared(playerPos);
        if (d2 < magnetRange * magnetRange) {
          coin.obj.position.lerp(playerPos, Math.min(1, 7 * dt));
          if (d2 < r2) this.collect(coin, elapsedSeconds);
          continue;
        }
      }

      coin.obj.position.y = coin.basePos.y + Math.sin(this.time * c.bobSpeed + coin.phase) * c.bobAmplitude;
      if (coin.obj.position.distanceToSquared(playerPos) < r2) {
        this.collect(coin, elapsedSeconds);
      }
    }
  }

  private collect(coin: Coin, elapsedSeconds: number): void {
    coin.collected = true;
    coin.popTime = 0.25;
    this.collectedCount++;
    this.events.emit('coin-collected', {
      collected: this.collectedCount,
      total: this.coins.length,
      points: coin.value,
      position: { x: coin.obj.position.x, y: coin.obj.position.y, z: coin.obj.position.z },
    });
    if (this.collectedCount === this.coins.length) {
      this.events.emit('all-coins-collected', { timeSeconds: elapsedSeconds });
    }
  }

  /** Intenta recoger una moneda no recogida cercana a `point` (impacto de agua). */
  tryHit(point: THREE.Vector3, radius: number, elapsedSeconds: number): boolean {
    const r2 = radius * radius;
    for (const coin of this.coins) {
      if (coin.collected) continue;
      if (coin.obj.position.distanceToSquared(point) < r2) {
        this.collect(coin, elapsedSeconds);
        return true;
      }
    }
    return false;
  }

  reset(): void {
    this.collectedCount = 0;
    for (const coin of this.coins) {
      coin.collected = false;
      coin.popTime = 0;
      coin.obj.visible = true;
      coin.obj.scale.setScalar(coin.value > 10 ? 1.15 : 1);
      coin.obj.position.copy(coin.basePos);
    }
    this.events.emit('coin-collected', { collected: 0, total: this.coins.length });
  }
}
