import * as THREE from 'three';

/**
 * Motas de polvo/luz flotando suavemente por el aire: dan sensación de
 * atmósfera viva sin coste apreciable (un único THREE.Points estático que
 * deriva hacia arriba y reaparece abajo). Persiste entre mundos.
 */
const COUNT = 150;
const AREA = 80; // extensión horizontal
const HEIGHT = 30;

export class AmbientMotes {
  readonly points: THREE.Points;
  private positions: Float32Array;
  private speeds: Float32Array;

  constructor() {
    this.positions = new Float32Array(COUNT * 3);
    this.speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * AREA;
      this.positions[i * 3 + 1] = Math.random() * HEIGHT;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * AREA;
      this.speeds[i] = 0.3 + Math.random() * 0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfff4d8,
      size: 0.14,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  update(dt: number): void {
    for (let i = 0; i < COUNT; i++) {
      let y = this.positions[i * 3 + 1] + this.speeds[i] * dt;
      if (y > HEIGHT) y -= HEIGHT; // reaparece abajo
      this.positions[i * 3 + 1] = y;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
