import * as THREE from 'three';
import { CONFIG } from '../core/Config';

export type PowerupKind = 'magnet' | 'djump';

interface Item {
  obj: THREE.Object3D;
  kind: PowerupKind;
  basePos: THREE.Vector3;
  respawn: number; // >0 mientras está recogido/oculto
  phase: number;
}

/**
 * Power-ups temporales flotantes (imán de monedas, doble salto). Al recogerlos
 * por proximidad disparan un callback y reaparecen tras unos segundos, para que
 * el jugador pueda volver a cogerlos. Iconos low-poly emisivos que giran.
 */
export class PowerupSystem {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private time = 0;

  constructor(defs: { pos: THREE.Vector3; kind: PowerupKind }[], private onCollect: (kind: PowerupKind) => void) {
    defs.forEach((def, i) => {
      const obj = def.kind === 'magnet' ? this.buildMagnet() : this.buildDoubleJump();
      obj.position.copy(def.pos);
      this.group.add(obj);
      this.items.push({ obj, kind: def.kind, basePos: def.pos.clone(), respawn: 0, phase: i * 1.1 });
    });
  }

  private buildMagnet(): THREE.Group {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xe0405f, emissive: 0xe0405f, emissiveIntensity: 0.8, roughness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.18), red);
    top.position.y = 0.2;
    g.add(top);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), red);
      leg.position.set(s * 0.17, -0.02, 0);
      g.add(leg);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), white);
      tip.position.set(s * 0.17, -0.26, 0);
      g.add(tip);
    }
    return g;
  }

  private buildDoubleJump(): THREE.Group {
    const g = new THREE.Group();
    const green = new THREE.MeshStandardMaterial({ color: 0x66d66b, emissive: 0x39c93f, emissiveIntensity: 0.9, roughness: 0.4 });
    for (let i = 0; i < 2; i++) {
      const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 4), green);
      chevron.position.y = -0.1 + i * 0.26;
      g.add(chevron);
    }
    return g;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.time += dt;
    const r = CONFIG.coins.pickupRadius + 0.2;
    for (const it of this.items) {
      if (it.respawn > 0) {
        it.respawn -= dt;
        if (it.respawn <= 0) {
          it.obj.visible = true;
          it.obj.scale.setScalar(1);
        }
        continue;
      }
      it.obj.rotation.y = this.time * 2 + it.phase;
      it.obj.position.y = it.basePos.y + Math.sin(this.time * 2.2 + it.phase) * 0.18;
      if (it.obj.position.distanceToSquared(playerPos) < r * r) {
        this.onCollect(it.kind);
        it.respawn = 8;
        it.obj.visible = false;
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
