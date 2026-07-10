import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../core/Config';
import type { InputFrame } from '../types';

/**
 * Cámara en tercera persona con órbita por ratón:
 * - yaw/pitch controlados por el ratón (pointer lock)
 * - seguimiento suavizado del objetivo (lerp exponencial, independiente del framerate)
 * - zoom con la rueda
 * - anticolisión: un raycast desde el objetivo acerca la cámara si hay geometría en medio
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0; // cámara detrás del jugador, mirando hacia -Z (la plaza central)
  private pitch = 0.28;
  private distance = CONFIG.camera.startDistance;
  private currentDistance = CONFIG.camera.startDistance;
  private smoothedTarget = new THREE.Vector3();
  private initialized = false;

  constructor(private physicsWorld: RAPIER.World, private rapier: typeof RAPIER) {
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
  }

  applyLook(input: InputFrame): void {
    const c = CONFIG.camera;
    this.yaw -= input.lookDeltaX * c.sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + input.lookDeltaY * c.sensitivity,
      c.minPitch,
      c.maxPitch,
    );
    if (input.zoomDelta !== 0) {
      this.distance = THREE.MathUtils.clamp(
        this.distance + input.zoomDelta * 0.005,
        c.minDistance,
        c.maxDistance,
      );
    }
  }

  update(dt: number, playerFeet: THREE.Vector3, excludeCollider: RAPIER.Collider): void {
    const c = CONFIG.camera;
    const target = new THREE.Vector3(
      playerFeet.x,
      playerFeet.y + c.heightOffset,
      playerFeet.z,
    );

    if (!this.initialized) {
      this.smoothedTarget.copy(target);
      this.initialized = true;
    } else {
      // Lerp exponencial independiente del framerate.
      const t = 1 - Math.exp(-c.followLerp * dt);
      this.smoothedTarget.lerp(target, t);
    }

    // Offset esférico a partir de yaw/pitch.
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    // Anticolisión: si hay algo entre el objetivo y la cámara, acercarla.
    let desired = this.distance;
    const ray = new this.rapier.Ray(
      { x: this.smoothedTarget.x, y: this.smoothedTarget.y, z: this.smoothedTarget.z },
      { x: dir.x, y: dir.y, z: dir.z },
    );
    const hit = this.physicsWorld.castRay(
      ray,
      this.distance + c.collisionMargin,
      true,
      undefined,
      undefined,
      excludeCollider,
    );
    if (hit !== null) {
      desired = Math.max(c.minDistance * 0.4, hit.timeOfImpact - c.collisionMargin);
    }

    // Suaviza los cambios de distancia (evita saltos bruscos al despejar un obstáculo).
    const dt2 = 1 - Math.exp(-20 * dt);
    this.currentDistance += (desired - this.currentDistance) * dt2;

    this.camera.position.copy(this.smoothedTarget).addScaledVector(dir, this.currentDistance);
    this.camera.lookAt(this.smoothedTarget);
  }
}
