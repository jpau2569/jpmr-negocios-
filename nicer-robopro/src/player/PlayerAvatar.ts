import * as THREE from 'three';
import { PALETTE } from '../assets/palette';
import { DEFAULT_AVATAR, type AvatarConfig, type HatId } from './AvatarConfig';

/**
 * Partes articuladas del avatar que el animador rota/escala.
 */
export interface AvatarRig {
  body: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

/**
 * Avatar por bloques con COSMÉTICA aplicable en caliente. Construye el rig una
 * vez y guarda sus materiales propios (torso+brazos, piernas, piel=cabeza+manos)
 * para recolorear sin recrear la geometría ni invalidar las referencias del
 * animador. El gorro vive en un slot sobre la cabeza que se reconstruye al
 * cambiar. La lógica de animación sigue en `AvatarAnimator`.
 */
export class PlayerAvatar {
  readonly group: THREE.Group;
  readonly parts: AvatarRig;

  // Materiales propios (no cacheados) para poder recolorear este avatar aislado.
  private torsoMat: THREE.MeshStandardMaterial;
  private legMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private hatSlot: THREE.Group;

  constructor(config: AvatarConfig = DEFAULT_AVATAR) {
    this.group = new THREE.Group();
    const body = new THREE.Group();
    this.group.add(body);

    this.torsoMat = new THREE.MeshStandardMaterial({ color: config.torso, roughness: 0.75 });
    this.legMat = new THREE.MeshStandardMaterial({ color: config.legs, roughness: 0.8 });
    this.skinMat = new THREE.MeshStandardMaterial({ color: config.skin, roughness: 0.7 });
    const faceMat = new THREE.MeshStandardMaterial({ color: PALETTE.playerFace, roughness: 0.6 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.4), this.torsoMat);
    torso.position.y = 0.75 + 0.325;
    body.add(torso);

    // Cabeza (piel) con ojos, boca (cara fija) y slot de gorro.
    const head = new THREE.Group();
    head.position.y = 0.75 + 0.65 + 0.28;
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.45), this.skinMat);
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
    this.hatSlot = new THREE.Group();
    this.hatSlot.position.y = 0.26;
    head.add(this.hatSlot);
    body.add(head);

    // Extremidades (brazos usan piel en las manos; piernas, color de piernas).
    const leftArm = this.makeLimb(0.22, 0.6, this.torsoMat, this.skinMat);
    leftArm.position.set(-0.47, 0.75 + 0.6, 0);
    const rightArm = this.makeLimb(0.22, 0.6, this.torsoMat, this.skinMat);
    rightArm.position.set(0.47, 0.75 + 0.6, 0);
    const leftLeg = this.makeLimb(0.28, 0.75, this.legMat);
    leftLeg.position.set(-0.19, 0.75, 0);
    const rightLeg = this.makeLimb(0.28, 0.75, this.legMat);
    rightLeg.position.set(0.19, 0.75, 0);
    body.add(leftArm, rightArm, leftLeg, rightLeg);

    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });

    this.parts = { body, leftArm, rightArm, leftLeg, rightLeg };
    this.buildHat(config.hat);
  }

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

  /** Aplica una configuración cosmética en caliente (recolorea + reconstruye gorro). */
  applyConfig(config: AvatarConfig): void {
    this.torsoMat.color.setHex(config.torso);
    this.legMat.color.setHex(config.legs);
    this.skinMat.color.setHex(config.skin);
    this.buildHat(config.hat);
  }

  private buildHat(hat: HatId): void {
    // Limpia el gorro anterior liberando su geometría.
    for (const child of [...this.hatSlot.children]) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    this.hatSlot.clear();
    if (hat === 'none') return;

    const add = (mesh: THREE.Mesh, y: number) => {
      mesh.position.y = y;
      mesh.castShadow = true;
      this.hatSlot.add(mesh);
    };

    if (hat === 'cap') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xd94f4f, roughness: 0.6 });
      add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.44), mat), 0.08);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), mat);
      brim.position.set(0, 0.02, 0.34);
      brim.castShadow = true;
      this.hatSlot.add(brim);
    } else if (hat === 'crown') {
      const mat = new THREE.MeshStandardMaterial({
        color: PALETTE.coin, emissive: PALETTE.coinEmissive, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.6,
      });
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 12, 1, true), mat), 0.1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), mat);
        spike.position.set(Math.cos(a) * 0.26, 0.22, Math.sin(a) * 0.26);
        spike.castShadow = true;
        this.hatSlot.add(spike);
      }
    } else if (hat === 'party') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xe86fa8, roughness: 0.5 });
      add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 14), mat), 0.28);
      const pom = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      );
      add(pom, 0.54);
    }
  }
}
