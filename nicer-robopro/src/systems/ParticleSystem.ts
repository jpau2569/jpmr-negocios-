import * as THREE from 'three';

/**
 * Sistema de partículas suaves con un pool fijo sobre un único THREE.Points:
 * cero allocations por frame y un solo draw call. Se usa para el brillo al
 * recoger monedas y el polvo de los aterrizajes.
 */
const CAPACITY = 256;
const HIDDEN_Y = -1000;

interface BurstOptions {
  count?: number;
  speed?: number;
  spread?: number; // radio inicial alrededor del centro
  life?: number;
  gravity?: number; // m/s² (negativo cae, positivo flota)
  upBias?: number; // velocidad vertical extra
}

export class ParticleSystem {
  readonly points: THREE.Points;
  private positions = new Float32Array(CAPACITY * 3);
  private colors = new Float32Array(CAPACITY * 3);
  private velocities = new Float32Array(CAPACITY * 3);
  private baseColors = new Float32Array(CAPACITY * 3);
  private life = new Float32Array(CAPACITY);
  private maxLife = new Float32Array(CAPACITY);
  private gravity = new Float32Array(CAPACITY);
  private cursor = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.positions.fill(HIDDEN_Y); // todo oculto al inicio
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  burst(center: THREE.Vector3, color: number, opts: BurstOptions = {}): void {
    const {
      count = 12,
      speed = 2.5,
      spread = 0.15,
      life = 0.6,
      gravity = -4,
      upBias = 1.5,
    } = opts;
    const c = new THREE.Color(color);

    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % CAPACITY; // el pool recicla los más antiguos

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );

      this.positions[i * 3] = center.x + dir.x * spread;
      this.positions[i * 3 + 1] = center.y + dir.y * spread;
      this.positions[i * 3 + 2] = center.z + dir.z * spread;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.velocities[i * 3] = dir.x * s;
      this.velocities[i * 3 + 1] = dir.y * s + upBias;
      this.velocities[i * 3 + 2] = dir.z * s;
      this.baseColors[i * 3] = c.r;
      this.baseColors[i * 3 + 1] = c.g;
      this.baseColors[i * 3 + 2] = c.b;
      this.life[i] = this.maxLife[i] = life * (0.7 + Math.random() * 0.6);
      this.gravity[i] = gravity;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < CAPACITY; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = HIDDEN_Y;
        this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
        continue;
      }
      this.velocities[i * 3 + 1] += this.gravity[i] * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      // Desvanecimiento: con blending aditivo, color→negro equivale a alpha→0.
      const a = this.life[i] / this.maxLife[i];
      this.colors[i * 3] = this.baseColors[i * 3] * a;
      this.colors[i * 3 + 1] = this.baseColors[i * 3 + 1] * a;
      this.colors[i * 3 + 2] = this.baseColors[i * 3 + 2] * a;
    }
    const geo = this.points.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
}
