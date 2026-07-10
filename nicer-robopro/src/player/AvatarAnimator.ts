import type { AvatarRig } from './PlayerAvatar';
import type { AvatarAnimState } from '../types';

/**
 * Cerebro de animación del avatar: traduce un estado de locomoción
 * (idle/walk/run/air) + velocidad a poses del rig, de forma procedural.
 *
 * Está deliberadamente desacoplado del rig concreto (solo toca `AvatarRig`) y
 * del controlador (recibe el estado ya calculado). Para mejorar las animaciones
 * después basta con sustituir/ampliar esta clase — por ejemplo, mapear los
 * estados a clips de un `AnimationMixer` de Three, o añadir blending entre poses
 * y nuevos estados (dash, caída larga, celebración) sin tocar física ni red.
 */
export class AvatarAnimator {
  private walkPhase = 0;
  private stretch = 0; // -1 aplastado (aterrizar) .. +1 estirado (saltar)
  private swingTime = 0; // >0 mientras dura el golpe de espada

  constructor(private rig: AvatarRig) {}

  /** Lanza una animación de espadazo con el brazo derecho. */
  triggerSwing(): void {
    this.swingTime = 0.35;
  }

  /** Impulso visual al despegar: estiramiento vertical breve. */
  triggerJump(): void {
    this.stretch = 1;
  }

  /** Impulso visual al aterrizar: aplastamiento breve proporcional al impacto. */
  triggerLand(impact: number): void {
    this.stretch = -Math.min(impact / 18, 1);
  }

  /**
   * Pose del frame según el estado de locomoción.
   * @param state estado de locomoción (única fuente de verdad, la calcula el controlador)
   * @param speed velocidad horizontal (m/s), marca la cadencia del paso
   * @param time tiempo acumulado (para la respiración del idle)
   */
  update(dt: number, state: AvatarAnimState, speed: number, time: number): void {
    const { body, leftArm, rightArm, leftLeg, rightLeg } = this.rig;

    // Squash & stretch: decae hacia 0 y se aplica conservando el volumen aparente.
    this.stretch *= Math.exp(-8 * dt);
    body.scale.y = 1 + this.stretch * 0.18;
    body.scale.x = body.scale.z = 1 - this.stretch * 0.1;

    if (state === 'walk' || state === 'run') {
      this.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.7;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.8;
      rightArm.rotation.x = swing * 0.8;
      body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.05;
    } else if (state === 'air') {
      // Pose de salto: brazos ligeramente arriba, piernas recogidas.
      this.lerpLimbs(dt, -0.5, -0.5, 0.35, -0.25);
      body.position.y = 0;
    } else {
      // Idle: vuelta suave a la pose neutra + respiración sutil.
      this.lerpLimbs(dt, 0, 0, 0, 0);
      body.position.y = Math.sin(time * 1.8) * 0.02;
      this.walkPhase = 0;
    }

    // Espadazo: sobrescribe el brazo derecho con un arco rápido hacia delante.
    if (this.swingTime > 0) {
      this.swingTime -= dt;
      const t = 1 - Math.max(this.swingTime, 0) / 0.35;
      rightArm.rotation.x -= Math.sin(t * Math.PI) * 2.3;
    }
  }

  private lerpLimbs(dt: number, la: number, ra: number, ll: number, rl: number): void {
    const { leftArm, rightArm, leftLeg, rightLeg } = this.rig;
    const t = 1 - Math.exp(-12 * dt);
    leftArm.rotation.x += (la - leftArm.rotation.x) * t;
    rightArm.rotation.x += (ra - rightArm.rotation.x) * t;
    leftLeg.rotation.x += (ll - leftLeg.rotation.x) * t;
    rightLeg.rotation.x += (rl - rightLeg.rotation.x) * t;
  }
}
