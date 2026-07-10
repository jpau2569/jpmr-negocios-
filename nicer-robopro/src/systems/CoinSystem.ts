import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import { coinMaterial } from '../assets/materials';
import type { EventBus } from '../core/EventBus';

interface Coin {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  collected: boolean;
  popTime: number; // >0 mientras dura la animación de recogida
  phase: number;
}

/**
 * Sistema de monedas/pickups: spawnea las monedas en los puntos que expone el mundo,
 * las anima (giro + flotación), detecta la recogida por proximidad al jugador y
 * emite eventos para el HUD y la condición de victoria. No usa colliders:
 * un chequeo de distancia es más barato y suficiente para pickups.
 */
export class CoinSystem {
  readonly group = new THREE.Group();
  private coins: Coin[] = [];
  private collectedCount = 0;
  private time = 0;

  constructor(spots: THREE.Vector3[], private events: EventBus) {
    const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 20);
    geo.rotateX(Math.PI / 2); // de pie, como una moneda clásica
    const mat = coinMaterial();

    for (let i = 0; i < Math.min(spots.length, CONFIG.coins.total); i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(spots[i]);
      mesh.castShadow = true;
      this.group.add(mesh);
      this.coins.push({
        mesh,
        basePos: spots[i].clone(),
        collected: false,
        popTime: 0,
        phase: i * 0.7,
      });
    }
  }

  /** Libera geometrías/materiales de las monedas (al descargar el mundo). */
  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        (obj.material as THREE.Material).dispose();
      }
    });
    this.group.clear();
  }

  get total(): number {
    return this.coins.length;
  }

  get collected(): number {
    return this.collectedCount;
  }

  update(dt: number, playerPos: THREE.Vector3, elapsedSeconds: number): void {
    this.time += dt;
    const c = CONFIG.coins;
    const r2 = c.pickupRadius * c.pickupRadius;

    for (const coin of this.coins) {
      if (coin.collected) {
        // Animación de recogida: salto + encogimiento, luego se oculta.
        if (coin.popTime > 0) {
          coin.popTime -= dt;
          const t = 1 - Math.max(coin.popTime, 0) / 0.25;
          coin.mesh.position.y = coin.basePos.y + t * 1.2;
          coin.mesh.scale.setScalar(Math.max(1 - t, 0.001));
          coin.mesh.rotation.y += dt * 20;
          if (coin.popTime <= 0) coin.mesh.visible = false;
        }
        continue;
      }

      coin.mesh.rotation.y = this.time * c.spinSpeed + coin.phase;
      coin.mesh.position.y =
        coin.basePos.y + Math.sin(this.time * c.bobSpeed + coin.phase) * c.bobAmplitude;

      if (coin.mesh.position.distanceToSquared(playerPos) < r2) {
        coin.collected = true;
        coin.popTime = 0.25;
        this.collectedCount++;
        this.events.emit('coin-collected', {
          collected: this.collectedCount,
          total: this.coins.length,
          position: { x: coin.mesh.position.x, y: coin.mesh.position.y, z: coin.mesh.position.z },
        });
        if (this.collectedCount === this.coins.length) {
          this.events.emit('all-coins-collected', { timeSeconds: elapsedSeconds });
        }
      }
    }
  }

  reset(): void {
    this.collectedCount = 0;
    for (const coin of this.coins) {
      coin.collected = false;
      coin.popTime = 0;
      coin.mesh.visible = true;
      coin.mesh.scale.setScalar(1);
      coin.mesh.position.copy(coin.basePos);
    }
    this.events.emit('coin-collected', { collected: 0, total: this.coins.length });
  }
}
