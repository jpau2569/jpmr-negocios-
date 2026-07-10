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

  // Scratch reutilizables: update() corre cada frame y no debe alocar.
  private scratchTarget = new THREE.Vector3();
  private scratchDir = new THREE.Vector3();
  private ray: RAPIER.Ray;

  constructor(private physicsWorld: RAPIER.World, rapier: typeof RAPIER) {
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
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
    const target = this.scratchTarget.set(
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
    const dir = this.scratchDir.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );

    // Anticolisión: si hay algo entre el objetivo y la cámara, acercarla.
    let desired = this.distance;
    this.ray.origin.x = this.smoothedTarget.x;
    this.ray.origin.y = this.smoothedTarget.y;
    this.ray.origin.z = this.smoothedTarget.z;
    this.ray.dir.x = dir.x;
    this.ray.dir.y = dir.y;
    this.ray.dir.z = dir.z;
    const hit = this.physicsWorld.castRay(
      this.ray,
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
