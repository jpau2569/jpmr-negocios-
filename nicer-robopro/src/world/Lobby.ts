import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../core/Config';
import { PALETTE } from '../assets/palette';
import { matte } from '../assets/materials';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { LevelDefinition, TowerDef, PortalDef } from './LevelData';

/**
 * Construye un mundo a partir de una `LevelDefinition`:
 * - geometría de gameplay (plataformas, torre opcional) leída de datos
 * - geometría decorativa/procedural (suelo, plaza, árboles)
 * - portales visuales a otros mundos (arcos que brillan)
 *
 * Es DESCARGABLE: `dispose()` retira todos los colliders del mundo físico y
 * libera las geometrías, de modo que el hub puede cargar y descargar mundos en
 * caliente sin fugas. Los materiales cacheados (compartidos) no se liberan.
 */
export class Lobby {
  readonly group = new THREE.Group();
  /** Datos de portal (posición + destino) para que el juego dispare el viaje. */
  readonly portals: PortalDef[];
  private colliders: RAPIER.Collider[] = [];

  constructor(private physics: PhysicsWorld, level: LevelDefinition) {
    this.portals = level.portals;
    if (!level.noGround) this.buildGround();
    if (level.centerPlaza) this.buildPlaza();
    this.buildPlatforms(level);
    if (level.tower) this.buildTower(level.tower);
    if (!level.noGround) this.buildTrees();
    this.buildPortals(level.portals);
    if (level.checkpoints) this.buildCheckpoints(level.checkpoints);
    if (level.finish) this.buildFinish(level.finish);
  }

  /** Retira colliders del mundo físico y libera geometrías. */
  dispose(): void {
    for (const c of this.colliders) this.physics.removeCollider(c);
    this.colliders.length = 0;
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.group.clear();
  }

  /** Caja visual + collider estático. rotY en radianes sobre el eje Y. */
  private box(
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    color: number,
    rotY = 0,
    rotZ = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matte(color));
    mesh.position.set(x, y, z);
    mesh.rotation.set(0, rotY, rotZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, rotZ));
    this.colliders.push(
      this.physics.addStaticBox(
        { x: w / 2, y: h / 2, z: d / 2 },
        { x, y, z },
        { x: q.x, y: q.y, z: q.z, w: q.w },
      ),
    );
    return mesh;
  }

  private buildGround(): void {
    const size = CONFIG.world.size;
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(size + 6, 1, size + 6),
      matte(PALETTE.grassDark),
    );
    border.position.y = -0.55;
    border.receiveShadow = true;
    this.group.add(border);

    const ground = new THREE.Mesh(new THREE.BoxGeometry(size, 1, size), matte(PALETTE.grass));
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.colliders.push(
      this.physics.addStaticBox({ x: size / 2 + 3, y: 0.5, z: size / 2 + 3 }, { x: 0, y: -0.55, z: 0 }),
    );
  }

  private buildPlaza(): void {
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 0.6, 32), matte(PALETTE.plaza));
    plaza.position.y = 0.3;
    plaza.castShadow = true;
    plaza.receiveShadow = true;
    this.group.add(plaza);
    this.colliders.push(this.physics.addStaticCylinder(0.3, 8.2, { x: 0, y: 0.3, z: 0 }));

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.4, 0.12, 10, 48),
      matte(PALETTE.plazaTrim, 0.6),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.62;
    this.group.add(ring);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 7.2;
      const z = Math.sin(a) * 7.2;
      this.box(0.5, 2.6, 0.5, x, 1.9, z, PALETTE.stone);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        new THREE.MeshStandardMaterial({
          color: PALETTE.coin,
          emissive: PALETTE.coinEmissive,
          emissiveIntensity: 2.5,
        }),
      );
      lamp.position.set(x, 3.5, z);
      this.group.add(lamp);
    }
  }

  private buildPlatforms(level: LevelDefinition): void {
    for (const p of level.platforms) {
      this.box(
        p.size[0], p.size[1], p.size[2],
        p.pos[0], p.pos[1], p.pos[2],
        p.color,
        p.rotY ?? 0,
        p.rotZ ?? 0,
      );
    }
  }

  private buildTower(tower: TowerDef): void {
    const { x, z } = tower;
    this.box(6, 1, 6, x, 0.5, z, PALETTE.brickTeal);
    for (let i = 1; i <= 5; i++) {
      const a = (i / 5) * Math.PI * 1.5;
      const sx = x + Math.cos(a) * 5;
      const sz = z + Math.sin(a) * 5;
      this.box(2.6, 0.6, 2.6, sx, 0.5 + i * 1.15, sz, i % 2 ? PALETTE.brickTeal : PALETTE.brickPurple);
    }
    this.box(5, 1, 5, x, 7.2, z, PALETTE.brickPurple);
  }

  private buildTrees(): void {
    const positions: Array<[number, number]> = [
      [-14, 14], [14, 16], [-26, -12], [26, 10], [-12, -20], [24, -18], [-28, 12], [10, 26],
    ];
    for (const [x, z] of positions) {
      const trunkH = 2.2 + ((x * 7 + z * 13) % 10) / 10;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, trunkH, 8), matte(PALETTE.wood));
      trunk.position.set(x, trunkH / 2, z);
      trunk.castShadow = true;
      this.group.add(trunk);
      this.colliders.push(this.physics.addStaticCylinder(trunkH / 2, 0.45, { x, y: trunkH / 2, z }));

      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), matte(PALETTE.leaves));
      crown.position.set(x, trunkH + 1.1, z);
      crown.scale.y = 0.8;
      crown.castShadow = true;
      this.group.add(crown);
      const crown2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), matte(PALETTE.leavesLight));
      crown2.position.set(x + 0.7, trunkH + 1.9, z - 0.4);
      crown2.castShadow = true;
      this.group.add(crown2);
    }
  }

  /**
   * Portales: arco de dos pilares + dintel con un plano central emisivo que
   * "florece" con el bloom. No son sólidos (se cruzan para viajar); el disparo
   * lo gestiona el juego por proximidad a `portal.pos`.
   */
  private buildPortals(portals: PortalDef[]): void {
    for (const portal of portals) {
      const [px, , pz] = portal.pos;
      const arch = new THREE.Group();
      arch.position.set(px, 0, pz);

      const frameMat = matte(PALETTE.stone, 0.7);
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.4), frameMat);
        pillar.position.set(side * 1.5, 1.6, 0);
        pillar.castShadow = true;
        arch.add(pillar);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 0.4), frameMat);
      lintel.position.set(0, 3.4, 0);
      lintel.castShadow = true;
      arch.add(lintel);

      // Plano central brillante del color del mundo destino.
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 3),
        new THREE.MeshStandardMaterial({
          color: portal.color,
          emissive: portal.color,
          emissiveIntensity: 1.6,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        }),
      );
      glow.position.set(0, 1.7, 0);
      arch.add(glow);

      this.group.add(arch);
    }
  }

  /** Banderines de checkpoint (poste + bandera teal). No sólidos. */
  private buildCheckpoints(checkpoints: import('./LevelData').Vec3[]): void {
    for (const [x, y, z] of checkpoints) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), matte(PALETTE.stone));
      pole.position.set(x, y + 0.8, z);
      pole.castShadow = true;
      this.group.add(pole);
      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.05),
        new THREE.MeshStandardMaterial({ color: PALETTE.brickTeal, emissive: PALETTE.brickTeal, emissiveIntensity: 0.4 }),
      );
      flag.position.set(x + 0.33, y + 1.35, z);
      flag.castShadow = true;
      this.group.add(flag);
    }
  }

  /** Arco de meta dorado y brillante (florece con el bloom). No sólido. */
  private buildFinish(finish: import('./LevelData').Vec3): void {
    const [fx, fy, fz] = finish;
    const arch = new THREE.Group();
    arch.position.set(fx, fy - 1.5, fz);
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.coin, emissive: PALETTE.coinEmissive, emissiveIntensity: 2, roughness: 0.3, metalness: 0.6,
    });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 0.4), mat);
      pillar.position.set(side * 1.6, 1.5, 0);
      pillar.castShadow = true;
      arch.add(pillar);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.4, 0.4), mat);
    bar.position.set(0, 3.2, 0);
    arch.add(bar);
    this.group.add(arch);
  }
}
