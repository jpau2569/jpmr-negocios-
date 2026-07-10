import * as THREE from 'three';

/**
 * Anillos de choque expansivos para el feedback de recogida: un aro que crece y
 * se desvanece en el punto del pickup, orientado hacia la cámara (billboard).
 *
 * Usa un pool fijo de mallas reutilizadas (cero allocations por recogida) y
 * blending aditivo, de modo que refuerza el "pop" de la moneda a coste ínfimo.
 */
const POOL_SIZE = 6;

interface Ring {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  active: boolean;
}

export class RingFx {
  readonly group = new THREE.Group();
  private rings: Ring[] = [];
  private cursor = 0;

  constructor() {
    // Aro fino centrado; se escala desde casi cero hasta ~1.6 al expandirse.
    const geo = new THREE.RingGeometry(0.5, 0.62, 32);
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.rings.push({ mesh, material, age: 0, life: 0.45, active: false });
    }
  }

  /** Lanza un anillo en `pos` con el color dado (recicla el más antiguo del pool). */
  spawn(pos: THREE.Vector3, color: number): void {
    const ring = this.rings[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    ring.mesh.position.copy(pos);
    ring.mesh.scale.setScalar(0.2);
    ring.material.color.set(color);
    ring.material.opacity = 0.9;
    ring.mesh.visible = true;
    ring.age = 0;
    ring.active = true;
  }

  /** Anima los anillos activos; los orienta hacia la cámara. */
  update(dt: number, camera: THREE.Camera): void {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.age += dt;
      const t = ring.age / ring.life;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      // Expansión con desaceleración (easeOut) y desvanecimiento.
      const scale = 0.2 + (1 - (1 - t) * (1 - t)) * 1.5;
      ring.mesh.scale.setScalar(scale);
      ring.material.opacity = 0.9 * (1 - t);
      ring.mesh.quaternion.copy(camera.quaternion); // billboard
    }
  }
}
