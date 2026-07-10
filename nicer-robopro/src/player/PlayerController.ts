import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../core/Config';
import type { InputFrame, AvatarAnimState } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import { AvatarAnimator } from './AvatarAnimator';
import { type AvatarConfig, JUMP_MUL, SPEED_MUL, weaponKind } from './AvatarConfig';
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
  private animator: AvatarAnimator;
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
  onSwing: (() => void) | null = null;

  // Modificadores de gear (botas) y tipo de arma equipada.
  private jumpMul = 1;
  private speedMul = 1;
  private weaponType: 'none' | 'sword' | 'water' = 'none';

  // Posiciones del paso físico anterior/actual para interpolar el visual.
  private prevPos = new THREE.Vector3();
  private currPos = new THREE.Vector3();
  /** Posición visual interpolada (pies del personaje). La usa la cámara y los pickups. */
  readonly visualPos = new THREE.Vector3();

  private targetHeading = Math.PI; // de espaldas a la cámara inicial (mirando a la plaza)
  private animTime = 0;
  private spawn = { ...CONFIG.player.spawn }; // punto de reaparición (lo fija cada mundo/checkpoint)
  private killY = CONFIG.player.killPlaneY; // altura de caída (la fija cada mundo)

  // Scratch reutilizables: fixedUpdate corre 60 veces/s y no debe alocar.
  private scratchWish = new THREE.Vector3();
  private scratchForward = new THREE.Vector3();
  private scratchRight = new THREE.Vector3();
  private scratchDelta = new THREE.Vector3();

  constructor(physics: PhysicsWorld, avatarConfig?: AvatarConfig) {
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

    this.avatar = new PlayerAvatar(avatarConfig);
    this.animator = new AvatarAnimator(this.avatar.parts);
    if (avatarConfig) this.applyGear(avatarConfig);
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
    const wish = this.scratchWish.set(0, 0, 0);
    if (inputLen > 0) {
      const forward = this.scratchForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
      const right = this.scratchRight.set(-forward.z, 0, forward.x);
      wish
        .addScaledVector(forward, -input.moveZ / Math.max(inputLen, 1))
        .addScaledVector(right, input.moveX / Math.max(inputLen, 1));
      wish.normalize();
    }

    const maxSpeed = (input.run ? p.runSpeed : p.walkSpeed) * this.speedMul;
    const control = this.grounded ? 1 : p.airControl;

    // Aceleración hacia la velocidad horizontal objetivo (delta = objetivo - actual).
    const delta = this.scratchDelta
      .copy(wish)
      .multiplyScalar(inputLen > 0 ? maxSpeed : 0)
      .sub(this.velocity)
      .setY(0);
    const maxDelta = p.accel * control * dt;
    if (delta.length() > maxDelta) delta.setLength(maxDelta);
    this.velocity.x += delta.x;
    this.velocity.z += delta.z;

    // --- Salto y gravedad ---
    this.timeSinceGrounded = this.grounded ? 0 : this.timeSinceGrounded + dt;
    if (input.jump && this.timeSinceGrounded <= p.coyoteTime && this.velocity.y <= 0.1) {
      this.velocity.y = p.jumpSpeed * this.jumpMul;
      this.timeSinceGrounded = 999;
      this.animator.triggerJump(); // respuesta visual (squash & stretch)
      this.onJump?.(); // game feel externo (audio, partículas) que orquesta Game
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
      this.animator.triggerLand(impactSpeed); // respuesta visual (aplastamiento)
      this.onLand?.(impactSpeed); // game feel externo (audio, partículas)
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

    // Caída bajo el umbral → reaparecer (en el mundo o en el último checkpoint).
    if (next.y < this.killY) this.respawn();
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

    // Estado de locomoción calculado UNA vez: alimenta animación y red por igual.
    this.animTime += dt;
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animator.update(dt, this.animState, horizSpeed, this.animTime);
  }

  /**
   * Estado de locomoción del jugador. Única fuente de verdad, consumida tanto
   * por el animador como por el snapshot de red (misma clasificación).
   */
  get animState(): AvatarAnimState {
    if (!this.grounded) return 'air';
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed < 0.5) return 'idle';
    return speed > CONFIG.player.walkSpeed + 0.5 ? 'run' : 'walk';
  }

  get heading(): number {
    return this.avatar.group.rotation.y;
  }

  /** Fija el punto de reaparición del mundo actual y teletransporta allí. */
  setSpawn(x: number, y: number, z: number): void {
    this.spawn = { x, y, z };
    this.respawn();
  }

  /** Actualiza el punto de reaparición SIN teletransportar (checkpoints de obby). */
  setRespawnPoint(x: number, y: number, z: number): void {
    this.spawn = { x, y, z };
  }

  /** Umbral de caída del mundo actual (por debajo se reaparece). */
  setKillY(y: number): void {
    this.killY = y;
  }

  /** Aplica los efectos del gear equipado (botas → salto/velocidad; arma → tipo). */
  applyGear(config: AvatarConfig): void {
    this.jumpMul = JUMP_MUL[config.boots];
    this.speedMul = SPEED_MUL[config.boots];
    this.weaponType = weaponKind(config.weapon);
  }

  /** Tipo de arma equipada (el juego decide entre espadazo y disparo). */
  get weapon(): 'none' | 'sword' | 'water' {
    return this.weaponType;
  }

  /** Impulso vertical de un trampolín. */
  bounce(vy: number): void {
    this.velocity.y = vy;
    this.animator.triggerJump();
  }

  /** Blande la espada (solo si es el arma equipada). */
  swing(): void {
    if (this.weaponType === 'sword') {
      this.animator.triggerSwing();
      this.onSwing?.();
    }
  }

  /** Gesto de disparo del brazo (pistola de agua). */
  triggerShootAnim(): void {
    this.animator.triggerSwing();
  }

  respawn(): void {
    const s = this.spawn;
    this.velocity.set(0, 0, 0);
    this.body.setNextKinematicTranslation({ x: s.x, y: s.y, z: s.z });
    this.body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
    this.currPos.set(s.x, s.y, s.z);
    this.prevPos.copy(this.currPos);
    this.visualPos.set(s.x, s.y, s.z);
  }
}
