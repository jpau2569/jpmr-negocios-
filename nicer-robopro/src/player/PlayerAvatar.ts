import * as THREE from 'three';
import { PALETTE } from '../assets/palette';
import { matte } from '../assets/materials';

/**
 * Avatar por bloques (cabeza, torso, brazos, piernas) con animación procedural:
 * balanceo de extremidades al andar, bob en idle y pose de salto.
 * Es solo representación visual: la física vive en PlayerController.
 */
export class PlayerAvatar {
  readonly group: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private body: THREE.Group;
  private walkPhase = 0;

  constructor() {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const torsoMat = matte(PALETTE.playerTorso, 0.75);
    const legMat = matte(PALETTE.playerLegs, 0.8);
    const headMat = matte(PALETTE.playerHead, 0.7);
    const faceMat = matte(PALETTE.playerFace, 0.6);

    // Torso: 0.7 x 0.65 x 0.4, con la base a la altura de la cadera (0.75)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.4), torsoMat);
    torso.position.y = 0.75 + 0.325;
    this.body.add(torso);

    // Cabeza con ojos y boca (bloques pequeños, sin texturas)
    const head = new THREE.Group();
    head.position.y = 0.75 + 0.65 + 0.28;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.45), headMat);
    head.add(skull);
    const eyeGeo = new THREE.BoxGeometry(0.09, 0.11, 0.03);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, faceMat);
      eye.position.set(side * 0.12, 0.05, 0.235);
      head.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), faceMat);
    mouth.position.set(0, -0.12, 0.235);
    head.add(mouth);
    this.body.add(head);

    // Extremidades: grupos con pivote en el hombro/cadera para rotarlas al andar.
    this.leftArm = this.makeLimb(0.22, 0.6, matte(PALETTE.playerArms, 0.75), matte(PALETTE.playerHands, 0.7));
    this.leftArm.position.set(-0.47, 0.75 + 0.6, 0);
    this.rightArm = this.makeLimb(0.22, 0.6, matte(PALETTE.playerArms, 0.75), matte(PALETTE.playerHands, 0.7));
    this.rightArm.position.set(0.47, 0.75 + 0.6, 0);
    this.leftLeg = this.makeLimb(0.28, 0.75, legMat);
    this.leftLeg.position.set(-0.19, 0.75, 0);
    this.rightLeg = this.makeLimb(0.28, 0.75, legMat);
    this.rightLeg.position.set(0.19, 0.75, 0);
    this.body.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });
  }

  /** Extremidad con pivote arriba; opcionalmente con "mano" de otro color en la punta. */
  private makeLimb(
    width: number,
    length: number,
    mat: THREE.Material,
    tipMat?: THREE.Material,
  ): THREE.Group {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), mat);
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    if (tipMat) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, width), tipMat);
      tip.position.y = -length + 0.07;
      pivot.add(tip);
    }
    return pivot;
  }

  /**
   * Anima el avatar según el estado de movimiento.
   * @param horizontalSpeed velocidad horizontal actual (m/s)
   * @param grounded si está apoyado en el suelo
   */
  update(dt: number, horizontalSpeed: number, grounded: boolean, time: number): void {
    const moving = horizontalSpeed > 0.5;

    if (grounded && moving) {
      this.walkPhase += dt * horizontalSpeed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.7;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.8;
      this.rightArm.rotation.x = swing * 0.8;
      this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.05;
    } else if (!grounded) {
      // Pose de salto: brazos ligeramente arriba, piernas recogidas.
      this.lerpLimbs(dt, -0.5, -0.5, 0.35, -0.25);
      this.body.position.y = 0;
    } else {
      // Idle: vuelta suave a la pose neutra + respiración sutil.
      this.lerpLimbs(dt, 0, 0, 0, 0);
      this.body.position.y = Math.sin(time * 1.8) * 0.02;
      this.walkPhase = 0;
    }
  }

  private lerpLimbs(dt: number, la: number, ra: number, ll: number, rl: number): void {
    const t = 1 - Math.exp(-12 * dt);
    this.leftArm.rotation.x += (la - this.leftArm.rotation.x) * t;
    this.rightArm.rotation.x += (ra - this.rightArm.rotation.x) * t;
    this.leftLeg.rotation.x += (ll - this.leftLeg.rotation.x) * t;
    this.rightLeg.rotation.x += (rl - this.rightLeg.rotation.x) * t;
  }
}
