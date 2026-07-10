import * as THREE from 'three';
import { CONFIG } from '../core/Config';

interface Gift {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  opened: boolean;
  popTime: number;
  phase: number;
}

/**
 * Cajas regalo con sorpresa: giran y flotan como las monedas; al recogerlas
 * (proximidad) se abren con un estallido y disparan un callback para que el
 * juego reparta una recompensa aleatoria (monedas, cargador o puntos).
 */
export class GiftSystem {
  readonly group = new THREE.Group();
  private gifts: Gift[] = [];
  private time = 0;

  constructor(positions: THREE.Vector3[], private onOpen: (pos: THREE.Vector3) => void) {
    positions.forEach((pos, i) => {
      const obj = this.buildGift();
      obj.position.copy(pos);
      this.group.add(obj);
      this.gifts.push({ obj, basePos: pos.clone(), opened: false, popTime: 0, phase: i * 1.3 });
    });
  }

  private buildGift(): THREE.Group {
    const g = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xe8467e, roughness: 0.5 });
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: PALETTE_COIN, emissive: 0xffaa00, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), boxMat);
    box.castShadow = true;
    g.add(box);
    // Cintas cruzadas + lazo.
    const bandX = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.58), ribbonMat);
    const bandZ = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.12), ribbonMat);
    g.add(bandX, bandZ);
    for (const s of [-1, 1]) {
      const bow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), ribbonMat);
      bow.position.set(s * 0.1, 0.32, 0);
      bow.scale.set(1, 0.6, 1);
      g.add(bow);
    }
    return g;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.time += dt;
    const r = CONFIG.coins.pickupRadius + 0.3;
    for (const gift of this.gifts) {
      if (gift.opened) {
        if (gift.popTime > 0) {
          gift.popTime -= dt;
          const t = 1 - Math.max(gift.popTime, 0) / 0.3;
          gift.obj.position.y = gift.basePos.y + t * 1.4;
          gift.obj.scale.setScalar(Math.max(1 - t, 0.001));
          gift.obj.rotation.y += dt * 18;
          if (gift.popTime <= 0) gift.obj.visible = false;
        }
        continue;
      }
      gift.obj.rotation.y = this.time * 1.4 + gift.phase;
      gift.obj.position.y = gift.basePos.y + Math.sin(this.time * 2 + gift.phase) * 0.2;
      if (gift.obj.position.distanceToSquared(playerPos) < r * r) {
        gift.opened = true;
        gift.popTime = 0.3;
        this.onOpen(gift.obj.position.clone());
      }
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.group.clear();
  }
}

const PALETTE_COIN = 0xffd94a;
