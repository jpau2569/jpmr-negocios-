import * as THREE from 'three';
import { PALETTE } from '../assets/palette';
import { matte } from '../assets/materials';

/**
 * Partes articuladas del avatar que el animador rota/escala. Grupos con el
 * pivote en el hombro/cadera (brazos y piernas) y el tronco completo (body).
 */
export interface AvatarRig {
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

/**
 * Avatar por bloques (cabeza, torso, brazos, piernas): SOLO construcción del
 * rig y exposición de sus partes. Ninguna lógica de animación vive aquí — de eso
 * se encarga `AvatarAnimator`, de modo que el rig es reemplazable (p. ej. por un
 * modelo GLTF con esqueleto) sin tocar al controlador ni la animación.
 */
export class PlayerAvatar {
  readonly group: THREE.Group;
  readonly parts: AvatarRig;

  constructor() {
    this.group = new THREE.Group();
    const body = new THREE.Group();
    this.group.add(body);

    const torsoMat = matte(PALETTE.playerTorso, 0.75);
    const legMat = matte(PALETTE.playerLegs, 0.8);
    const headMat = matte(PALETTE.playerHead, 0.7);
    const faceMat = matte(PALETTE.playerFace, 0.6);

    // Torso: 0.7 x 0.65 x 0.4, con la base a la altura de la cadera (0.75)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.4), torsoMat);
    torso.position.y = 0.75 + 0.325;
    body.add(torso);

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
    body.add(head);

    // Extremidades: grupos con pivote en el hombro/cadera para rotarlas al andar.
    const leftArm = this.makeLimb(0.22, 0.6, matte(PALETTE.playerArms, 0.75), matte(PALETTE.playerHands, 0.7));
    leftArm.position.set(-0.47, 0.75 + 0.6, 0);
    const rightArm = this.makeLimb(0.22, 0.6, matte(PALETTE.playerArms, 0.75), matte(PALETTE.playerHands, 0.7));
    rightArm.position.set(0.47, 0.75 + 0.6, 0);
    const leftLeg = this.makeLimb(0.28, 0.75, legMat);
    leftLeg.position.set(-0.19, 0.75, 0);
    const rightLeg = this.makeLimb(0.28, 0.75, legMat);
    rightLeg.position.set(0.19, 0.75, 0);
    body.add(leftArm, rightArm, leftLeg, rightLeg);

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });

    this.parts = { body, leftArm, rightArm, leftLeg, rightLeg };
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
}
