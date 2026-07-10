import * as THREE from 'three';

/**
 * Proyectiles de agua de las pistolas: un pool fijo de gotas que viajan con una
 * gravedad ligera y se desactivan al impactar (una moneda) o agotar su vida.
 * El test de impacto lo inyecta el juego (para no acoplar con CoinSystem).
 */
const POOL = 40;
const GRAVITY = 12;
const LIFE = 1.4;
const HIDDEN_Y = -1000;

interface Drop {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  active: boolean;
}

export class WaterGun {
  readonly group = new THREE.Group();
  private drops: Drop[] = [];
  private cursor = 0;

  constructor() {
    const geo = new THREE.SphereGeometry(0.13, 8, 8);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x5b8fd9, emissive: 0x2a4f80, emissiveIntensity: 0.4, roughness: 0.3, transparent: true, opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.drops.push({ mesh, vel: new THREE.Vector3(), life: 0, active: false });
    }
  }

  /** Dispara una gota desde `origin` en la dirección `dir` (normalizada). */
  fire(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, color: number): void {
    const drop = this.drops[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    drop.mesh.position.copy(origin);
    drop.vel.copy(dir).multiplyScalar(speed);
    (drop.mesh.material as THREE.MeshStandardMaterial).color.setHex(color);
    drop.mesh.visible = true;
    drop.life = LIFE;
    drop.active = true;
  }

  /** Mueve las gotas; `hitTest(pos)` devuelve true si impactó algo (se desactiva). */
  update(dt: number, hitTest: (pos: THREE.Vector3) => boolean): void {
    for (const drop of this.drops) {
      if (!drop.active) continue;
      drop.life -= dt;
      drop.vel.y -= GRAVITY * dt;
      drop.mesh.position.addScaledVector(drop.vel, dt);
      if (drop.life <= 0 || hitTest(drop.mesh.position)) {
        drop.active = false;
        drop.mesh.visible = false;
        drop.mesh.position.y = HIDDEN_Y;
      }
    }
  }
}
