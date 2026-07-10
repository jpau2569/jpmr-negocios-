import * as THREE from 'three';
import { PALETTE } from '../assets/palette';
import {
  DEFAULT_AVATAR, type AvatarConfig, type HatId, type BootsId, type WeaponId, weaponKind, WATER_GUNS,
} from './AvatarConfig';

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
  private leftBootSlot!: THREE.Group;
  private rightBootSlot!: THREE.Group;
  private weaponSlot!: THREE.Group;

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

    // Slots de gear: botas al pie de cada pierna, arma en la mano derecha.
    this.leftBootSlot = new THREE.Group();
    this.leftBootSlot.position.y = -0.75;
    leftLeg.add(this.leftBootSlot);
    this.rightBootSlot = new THREE.Group();
    this.rightBootSlot.position.y = -0.75;
    rightLeg.add(this.rightBootSlot);
    this.weaponSlot = new THREE.Group();
    this.weaponSlot.position.set(0, -0.58, 0.12);
    rightArm.add(this.weaponSlot);

    this.buildHat(config.hat);
    this.buildBoots(config.boots);
    this.buildWeapon(config.weapon);
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
    this.buildBoots(config.boots);
    this.buildWeapon(config.weapon);
  }

  private clearSlot(slot: THREE.Group): void {
    for (const child of [...slot.children]) {
      if (child instanceof THREE.Mesh) child.geometry.dispose();
    }
    slot.clear();
  }

  private buildBoots(boots: BootsId): void {
    this.clearSlot(this.leftBootSlot);
    this.clearSlot(this.rightBootSlot);
    if (boots === 'none') return;
    // Salto = teal brillante; velocidad = naranja. Emisivas para florecer con el bloom.
    const color = boots === 'jump' ? 0x35d0ba : 0xe8934a;
    for (const slot of [this.leftBootSlot, this.rightBootSlot]) {
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.46),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.5 }),
      );
      boot.position.set(0, -0.02, 0.07);
      boot.castShadow = true;
      slot.add(boot);
    }
  }

  private buildWeapon(weapon: WeaponId): void {
    this.clearSlot(this.weaponSlot);
    const kind = weaponKind(weapon);
    if (kind === 'none') return;

    if (kind === 'sword') {
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xe2eaf0, metalness: 0.7, roughness: 0.25, emissive: 0x223a4a, emissiveIntensity: 0.3,
      });
      const hiltMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 });
      const sword = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.03), bladeMat);
      blade.position.y = 0.5;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.07), hiltMat);
      guard.position.y = 0.03;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.07), hiltMat);
      grip.position.y = -0.1;
      sword.add(blade, guard, grip);
      sword.rotation.x = -Math.PI / 2;
      sword.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      this.weaponSlot.add(sword);
      return;
    }

    // Pistola de agua: cuerpo + cañón + depósito. Tamaño/color según el modelo.
    const stats = WATER_GUNS[weapon];
    const scale = weapon === 'mega' ? 1.35 : weapon === 'super' ? 1.15 : 1;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.6 });
    const tankMat = new THREE.MeshStandardMaterial({
      color: stats.color, emissive: stats.color, emissiveIntensity: 0.35, roughness: 0.4, transparent: true, opacity: 0.85,
    });
    const gun = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.34), bodyMat);
    body.position.z = 0.14;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.34);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), bodyMat);
    grip.position.set(0, -0.16, 0.05);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12), tankMat);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0, 0.14, 0.06);
    gun.add(body, barrel, grip, tank);
    gun.scale.setScalar(scale);
    gun.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    this.weaponSlot.add(gun);
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
    } else if (hat === 'headphones') {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.5 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 8, 16, Math.PI), mat);
      band.rotation.z = Math.PI; // arco sobre la cabeza
      add(band, 0.05);
      for (const side of [-1, 1]) {
        const cup = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.18), mat);
        cup.position.set(side * 0.28, -0.12, 0);
        cup.castShadow = true;
        this.hatSlot.add(cup);
      }
    } else if (hat === 'wizard') {
      const mat = new THREE.MeshStandardMaterial({ color: 0x6b4fb0, roughness: 0.6 });
      const hat3 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 16), mat);
      hat3.position.y = 0.38;
      hat3.castShadow = true;
      this.hatSlot.add(hat3);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16), mat);
      add(brim, 0.04);
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshStandardMaterial({ color: PALETTE.coin, emissive: PALETTE.coinEmissive, emissiveIntensity: 1.5 }),
      );
      add(star, 0.72);
    } else if (hat === 'halo') {
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.045, 10, 24),
        new THREE.MeshStandardMaterial({ color: PALETTE.coin, emissive: PALETTE.coinEmissive, emissiveIntensity: 2.2 }),
      );
      halo.rotation.x = Math.PI / 2;
      add(halo, 0.34);
    }
  }
}
