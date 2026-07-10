import * as THREE from 'three';
import { PALETTE } from '../assets/palette';
import {
  DEFAULT_AVATAR, type AvatarConfig, type HatId, type HeadId, type HairId, type OutfitId,
  type BootsId, type WeaponId, weaponKind, WATER_GUNS, ANIMAL_COLORS, MILITARY_TORSO, MILITARY_LEGS,
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
  private animalMat: THREE.MeshStandardMaterial;
  private hatSlot: THREE.Group;
  private headExtras!: THREE.Group; // rasgos de cabeza de animal
  private hairSlot!: THREE.Group;
  private outfitSlot!: THREE.Group; // chaleco militar
  private skull!: THREE.Mesh;
  private faceParts: THREE.Mesh[] = []; // ojos + boca humanos (se ocultan en animales)
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
    this.animalMat = new THREE.MeshStandardMaterial({ color: 0x4da653, roughness: 0.6 });
    const faceMat = new THREE.MeshStandardMaterial({ color: PALETTE.playerFace, roughness: 0.6 });

    // Torso + slot de ropa (chaleco militar).
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.65, 0.4), this.torsoMat);
    torso.position.y = 0.75 + 0.325;
    body.add(torso);
    this.outfitSlot = new THREE.Group();
    this.outfitSlot.position.y = 0.75 + 0.325;
    body.add(this.outfitSlot);

    // Cabeza con ojos y boca humanos (se ocultan al poner cabeza de animal).
    const head = new THREE.Group();
    head.position.y = 0.75 + 0.65 + 0.28;
    this.skull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.45), this.skinMat);
    head.add(this.skull);
    const eyeGeo = new THREE.BoxGeometry(0.09, 0.11, 0.03);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, faceMat);
      eye.position.set(side * 0.12, 0.05, 0.235);
      head.add(eye);
      this.faceParts.push(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), faceMat);
    mouth.position.set(0, -0.12, 0.235);
    head.add(mouth);
    this.faceParts.push(mouth);
    this.headExtras = new THREE.Group();
    head.add(this.headExtras);
    this.hairSlot = new THREE.Group();
    head.add(this.hairSlot);
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

    this.buildHead(config.head);
    this.buildHair(config.hair);
    this.buildOutfit(config.outfit, config.torso, config.legs);
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
    this.skinMat.color.setHex(config.skin);
    // buildOutfit fija torso/piernas (color elegido o militar); buildHead maneja el cráneo.
    this.buildOutfit(config.outfit, config.torso, config.legs);
    this.buildHead(config.head);
    this.buildHair(config.hair);
    this.buildHat(config.hat);
    this.buildBoots(config.boots);
    this.buildWeapon(config.weapon);
  }

  private buildHead(head: HeadId): void {
    this.clearSlot(this.headExtras);
    if (head === 'normal') {
      this.skull.material = this.skinMat;
      for (const f of this.faceParts) f.visible = true;
      return;
    }
    // Cabeza de animal: cráneo recoloreado, cara humana oculta, rasgos propios.
    this.animalMat = new THREE.MeshStandardMaterial({ color: ANIMAL_COLORS[head], roughness: 0.6 });
    this.skull.material = this.animalMat;
    for (const f of this.faceParts) f.visible = false;
    this.buildAnimalFeatures(head, this.animalMat);
  }

  private buildAnimalFeatures(head: HeadId, mat: THREE.MeshStandardMaterial): void {
    const slot = this.headExtras;
    const dark = new THREE.MeshStandardMaterial({ color: 0x161c22, roughness: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
    const add = (m: THREE.Mesh) => { m.castShadow = true; slot.add(m); };
    // Ojos comunes a todos los animales.
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), dark);
      eye.position.set(s * 0.13, 0.08, 0.22);
      add(eye);
    }
    if (head === 'croc' || head === 'dino' || head === 'dragon') {
      // Hocico alargado con dientes.
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.4), mat);
      snout.position.set(0, -0.08, 0.32);
      add(snout);
      for (let i = -1; i <= 1; i++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), white);
        tooth.position.set(i * 0.1, -0.16, 0.48);
        tooth.rotation.x = Math.PI;
        add(tooth);
      }
    } else {
      // Oso/León: hocico corto redondeado.
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.18), mat);
      snout.position.set(0, -0.06, 0.28);
      add(snout);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.05), dark);
      nose.position.set(0, -0.02, 0.38);
      add(nose);
    }
    if (head === 'dragon' || head === 'dino') {
      // Cuernos / crestas hacia atrás.
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), head === 'dragon' ? new THREE.MeshStandardMaterial({ color: 0xe8c04a, roughness: 0.4 }) : mat);
        horn.position.set(s * 0.14, 0.28, -0.05);
        horn.rotation.x = -0.5;
        add(horn);
      }
    } else if (head === 'bear') {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), mat);
        ear.position.set(s * 0.18, 0.26, 0);
        add(ear);
      }
    } else if (head === 'lion') {
      // Melena: anillo de "pelo" alrededor de la cabeza.
      const mane = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 8, 18), new THREE.MeshStandardMaterial({ color: 0x9a5a1e, roughness: 0.8 }));
      mane.position.z = -0.02;
      add(mane);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat);
        ear.position.set(s * 0.2, 0.24, 0);
        add(ear);
      }
    } else if (head === 'croc') {
      for (const s of [-1, 1]) {
        const bump = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat);
        bump.position.set(s * 0.12, 0.18, 0.1);
        add(bump);
      }
    }
  }

  private buildHair(hair: HairId): void {
    this.clearSlot(this.hairSlot);
    if (hair === 'none') return;
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c1e12, roughness: 0.85 });
    if (hair === 'militar') {
      const buzz = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.47), new THREE.MeshStandardMaterial({ color: 0x3a3f2a, roughness: 0.9 }));
      buzz.position.y = 0.22;
      buzz.castShadow = true;
      this.hairSlot.add(buzz);
    } else if (hair === 'largo') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.5), mat);
      top.position.y = 0.2;
      this.hairSlot.add(top);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.12), mat);
      back.position.set(0, -0.02, -0.24);
      this.hairSlot.add(back);
      this.hairSlot.children.forEach((c) => { c.castShadow = true; });
    } else if (hair === 'punki') {
      const mohMat = new THREE.MeshStandardMaterial({ color: 0xe8467e, roughness: 0.6 });
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), mohMat);
        spike.position.set(0, 0.3, 0.15 - i * 0.12);
        spike.castShadow = true;
        this.hairSlot.add(spike);
      }
    }
  }

  private buildOutfit(outfit: OutfitId, torsoColor: number, legsColor: number): void {
    this.clearSlot(this.outfitSlot);
    if (outfit === 'militar') {
      this.torsoMat.color.setHex(MILITARY_TORSO);
      this.legMat.color.setHex(MILITARY_LEGS);
      // Chaleco táctico oscuro con bolsillos.
      const vestMat = new THREE.MeshStandardMaterial({ color: 0x3a4028, roughness: 0.8 });
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.5, 0.46), vestMat);
      vest.position.y = 0.02;
      vest.castShadow = true;
      this.outfitSlot.add(vest);
      for (const s of [-1, 1]) {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a3018, roughness: 0.8 }));
        pouch.position.set(s * 0.2, -0.1, 0.24);
        this.outfitSlot.add(pouch);
      }
    } else {
      this.torsoMat.color.setHex(torsoColor);
      this.legMat.color.setHex(legsColor);
    }
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
