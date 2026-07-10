import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../core/Config';
import type { InputFrame } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/**
 * Controlador de personaje cinemático sobre Rapier:
 * - cápsula + KinematicCharacterController (autostep, snap-to-ground, slopes)
 * - aceleración/deceleración en suelo y control reducido en el aire
 * - salto con coyote time y gravedad manual
 * - interpolación visual entre pasos físicos (el render va desacoplado del fixed step)
 * El movimiento es relativo al yaw de la cámara: prioridad nº1 del proyecto.
 */
export class PlayerController {
  readonly avatar: PlayerAvatar;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;

  private velocity = new THREE.Vector3();
  private grounded = false;
  private wasGrounded = false;
  private timeSinceGrounded = 999;

  /** Hooks de game feel: el juego conecta aquí audio, partículas y squash & stretch. */
  onJump: (() => void) | null = null;
  onLand: ((impactSpeed: number) => void) | null = null;

  // Posiciones del paso físico anterior/actual para interpolar el visual.
  private prevPos = new THREE.Vector3();
  private currPos = new THREE.Vector3();
  /** Posición visual interpolada (pies del personaje). La usa la cámara y los pickups. */
  readonly visualPos = new THREE.Vector3();

  private targetHeading = Math.PI; // de espaldas a la cámara inicial (mirando a la plaza)
  private animTime = 0;

  constructor(physics: PhysicsWorld) {
    const p = CONFIG.player;
    const R = physics.rapier;

    const spawn = p.spawn;
    this.body = physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    // El collider se centra en el cuerpo; el "origen lógico" del jugador son los pies.
    this.collider = physics.world.createCollider(
      R.ColliderDesc.capsule(p.capsuleHalfHeight, p.capsuleRadius),
      this.body,
    );

    this.controller = physics.world.createCharacterController(0.05);
    this.controller.enableAutostep(0.7, 0.3, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(true);

    this.avatar = new PlayerAvatar();
    this.avatar.group.rotation.y = this.targetHeading;

    this.currPos.set(spawn.x, spawn.y, spawn.z);
    this.prevPos.copy(this.currPos);
    this.syncVisual(1, 0);
  }

  /** Altura desde los pies hasta el centro de la cápsula. */
  private get feetOffset(): number {
    return CONFIG.player.capsuleHalfHeight + CONFIG.player.capsuleRadius;
  }

  /** Paso físico a timestep fijo. cameraYaw orienta el input al espacio de la cámara. */
  fixedUpdate(dt: number, input: InputFrame, cameraYaw: number): void {
    const p = CONFIG.player;

    // --- Dirección deseada en espacio de cámara ---
    const inputLen = Math.hypot(input.moveX, input.moveZ);
    const wish = new THREE.Vector3();
    if (inputLen > 0) {
      const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      wish
        .addScaledVector(forward, -input.moveZ / Math.max(inputLen, 1))
        .addScaledVector(right, input.moveX / Math.max(inputLen, 1));
      wish.normalize();
    }

    const maxSpeed = input.run ? p.runSpeed : p.walkSpeed;
    const control = this.grounded ? 1 : p.airControl;

    // Aceleración hacia la velocidad horizontal objetivo.
    const targetVel = wish.clone().multiplyScalar(inputLen > 0 ? maxSpeed : 0);
    const horiz = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    const delta = targetVel.sub(horiz);
    const maxDelta = p.accel * control * dt;
    if (delta.length() > maxDelta) delta.setLength(maxDelta);
    this.velocity.x += delta.x;
    this.velocity.z += delta.z;

    // --- Salto y gravedad ---
    this.timeSinceGrounded = this.grounded ? 0 : this.timeSinceGrounded + dt;
    if (input.jump && this.timeSinceGrounded <= p.coyoteTime && this.velocity.y <= 0.1) {
      this.velocity.y = p.jumpSpeed;
      this.timeSinceGrounded = 999;
      this.onJump?.();
    }
    this.velocity.y += CONFIG.physics.gravity * dt;
    this.velocity.y = Math.max(this.velocity.y, -40); // velocidad terminal

    // --- Mover con el character controller ---
    const desired = {
      x: this.velocity.x * dt,
      y: this.velocity.y * dt,
      z: this.velocity.z * dt,
    };
    this.controller.computeColliderMovement(this.collider, desired);
    const move = this.controller.computedMovement();
    const impactSpeed = -this.velocity.y; // velocidad de caída antes de tocar suelo
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && !this.wasGrounded && impactSpeed > 3) {
      this.onLand?.(impactSpeed);
    }
    this.wasGrounded = this.grounded;
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;

    const pos = this.body.translation();
    const next = { x: pos.x + move.x, y: pos.y + move.y, z: pos.z + move.z };
    this.body.setNextKinematicTranslation(next);

    this.prevPos.copy(this.currPos);
    this.currPos.set(next.x, next.y, next.z);

    // Orientación del avatar hacia la dirección de movimiento.
    if (inputLen > 0) this.targetHeading = Math.atan2(wish.x, wish.z);

    // Kill plane → respawn.
    if (next.y < p.killPlaneY) this.respawn();
  }

  /** Interpola el visual entre el paso físico anterior y el actual. */
  syncVisual(alpha: number, dt: number): void {
    this.visualPos.lerpVectors(this.prevPos, this.currPos, alpha);
    const feetY = this.visualPos.y - this.feetOffset;
    this.avatar.group.position.set(this.visualPos.x, feetY, this.visualPos.z);

    // Giro suave hacia la dirección de marcha (ángulo más corto).
    let diff = this.targetHeading - this.avatar.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.avatar.group.rotation.y += diff * Math.min(1, 14 * dt);

    this.animTime += dt;
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.avatar.update(dt, horizSpeed, this.grounded, this.animTime);
  }

  /** Estado de animación replicable (para snapshots de red). */
  get animState(): 'idle' | 'walk' | 'run' | 'air' {
    if (!this.grounded) return 'air';
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed < 0.5) return 'idle';
    return speed > CONFIG.player.walkSpeed + 0.5 ? 'run' : 'walk';
  }

  get heading(): number {
    return this.avatar.group.rotation.y;
  }

  respawn(): void {
    const s = CONFIG.player.spawn;
    this.velocity.set(0, 0, 0);
    this.body.setNextKinematicTranslation({ x: s.x, y: s.y, z: s.z });
    this.body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
    this.currPos.set(s.x, s.y, s.z);
    this.prevPos.copy(this.currPos);
  }
}
