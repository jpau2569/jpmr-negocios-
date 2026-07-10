import * as THREE from 'three';

interface Target {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  broken: boolean;
  respawn: number; // >0 mientras está roto/oculto
  phase: number;
}

/**
 * Enemigos "slime" que se rompen con la espada (cuerpo a cuerpo) o con la
 * pistola de agua. Flotan y botan; al romperlos disparan un callback (para la
 * recompensa) y reaparecen tras unos segundos. Da combate a la espada.
 */
export class TargetSystem {
  readonly group = new THREE.Group();
  private targets: Target[] = [];
  private time = 0;

  constructor(positions: THREE.Vector3[], private onBreak: (pos: THREE.Vector3) => void) {
    positions.forEach((pos, i) => {
      const obj = this.buildEnemy();
      obj.position.copy(pos);
      this.group.add(obj);
      this.targets.push({ obj, basePos: pos.clone(), broken: false, respawn: 0, phase: i * 1.7 });
    });
  }

  private buildEnemy(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({ color: 0x9b4fd4, emissive: 0x5b2f88, emissiveIntensity: 0.5, roughness: 0.5 }),
    );
    body.scale.y = 0.82;
    body.castShadow = true;
    g.add(body);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.4 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
      eye.position.set(s * 0.15, 0.08, 0.34);
      g.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.03), eyeMat);
      brow.position.set(s * 0.15, 0.2, 0.36);
      brow.rotation.z = s * 0.5; // ceño enfadado
      g.add(brow);
    }
    return g;
  }

  update(dt: number, camY = 0): void {
    void camY;
    this.time += dt;
    for (const t of this.targets) {
      if (t.broken) {
        if (t.respawn > 0) {
          t.respawn -= dt;
          if (t.respawn <= 0) {
            t.broken = false;
            t.obj.visible = true;
            t.obj.scale.setScalar(1);
          }
        }
        continue;
      }
      t.obj.rotation.y = this.time * 1.2 + t.phase;
      t.obj.position.y = t.basePos.y + Math.sin(this.time * 3 + t.phase) * 0.14;
    }
  }

  private breakTarget(t: Target): void {
    t.broken = true;
    t.respawn = 6;
    t.obj.visible = false;
    this.onBreak(t.obj.position.clone());
  }

  /** Rompe todos los enemigos dentro de `radius` de `point` (espadazo). */
  trySwordHit(point: THREE.Vector3, radius: number): number {
    let n = 0;
    const r2 = radius * radius;
    for (const t of this.targets) {
      if (t.broken) continue;
      if (t.obj.position.distanceToSquared(point) < r2) {
        this.breakTarget(t);
        n++;
      }
    }
    return n;
  }

  /** Rompe un enemigo cercano a `point` (impacto de agua). */
  tryHit(point: THREE.Vector3, radius: number): boolean {
    const r2 = radius * radius;
    for (const t of this.targets) {
      if (t.broken) continue;
      if (t.obj.position.distanceToSquared(point) < r2) {
        this.breakTarget(t);
        return true;
      }
    }
    return false;
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
