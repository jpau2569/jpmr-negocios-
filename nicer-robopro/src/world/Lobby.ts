import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import { PALETTE } from '../assets/palette';
import { matte } from '../assets/materials';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { LevelDefinition, TowerDef } from './LevelData';

/**
 * Construcción del lobby a partir de una `LevelDefinition`:
 * - geometría de gameplay (plataformas, torre) leída de datos → `LevelData`
 * - geometría decorativa/procedural (suelo, plaza, árboles) generada aquí
 *
 * Cada pieza sólida registra su collider estático en el mundo físico. Las
 * posiciones de moneda y las zonas de misión ya NO viven aquí: son datos del
 * nivel que consumen directamente CoinSystem y MissionSystem.
 */
export class Lobby {
  readonly group = new THREE.Group();

  constructor(private physics: PhysicsWorld, level: LevelDefinition) {
    this.buildGround();
    this.buildPlaza();
    this.buildPlatforms(level);
    this.buildTower(level.tower);
    this.buildTrees();
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
    this.physics.addStaticBox(
      { x: w / 2, y: h / 2, z: d / 2 },
      { x, y, z },
      { x: q.x, y: q.y, z: q.z, w: q.w },
    );
    return mesh;
  }

  private buildGround(): void {
    const size = CONFIG.world.size;
    // Baseplate de hierba con borde más oscuro (marco visual clásico).
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
    this.physics.addStaticBox({ x: size / 2 + 3, y: 0.5, z: size / 2 + 3 }, { x: 0, y: -0.55, z: 0 });
  }

  private buildPlaza(): void {
    // Plaza circular central: punto de spawn social del lobby.
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 0.6, 32), matte(PALETTE.plaza));
    plaza.position.y = 0.3;
    plaza.castShadow = true;
    plaza.receiveShadow = true;
    this.group.add(plaza);
    this.physics.addStaticCylinder(0.3, 8.2, { x: 0, y: 0.3, z: 0 });

    // Anillo decorativo y cuatro pilares con luces cálidas.
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
          emissiveIntensity: 2.5, // lámparas: brillo fuerte para un halo de bloom marcado
        }),
      );
      lamp.position.set(x, 3.5, z);
      this.group.add(lamp);
    }
  }

  /** Plataformas jugables (norte/este/sur) leídas del nivel. */
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

  /** Torre teal con escalera de caracol: base + espiral procedural + plataforma cima. */
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
      this.physics.addStaticCylinder(trunkH / 2, 0.45, { x, y: trunkH / 2, z });

      // Copa en dos bolas achatadas: silueta low-poly amable.
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
}
