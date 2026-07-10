import RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../core/Config';

/**
 * Envoltorio de Rapier: inicialización del WASM, mundo físico y helpers
 * para crear colliders estáticos. El resto del juego no importa Rapier directamente
 * salvo para tipos, de modo que un cambio de motor quedaría contenido aquí.
 */
export class PhysicsWorld {
  world!: RAPIER.World;
  rapier!: typeof RAPIER;

  async init(): Promise<void> {
    await RAPIER.init();
    this.rapier = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: CONFIG.physics.gravity, z: 0 });
    this.world.timestep = CONFIG.physics.fixedStep;
  }

  step(): void {
    this.world.step();
  }

  /** Elimina un collider estático (al descargar un mundo). */
  removeCollider(collider: RAPIER.Collider): void {
    this.world.removeCollider(collider, false);
  }

  /** Caja estática (suelos, plataformas, rampas). Rotación opcional como cuaternión. */
  addStaticBox(
    halfExtents: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    rotation?: { x: number; y: number; z: number; w: number },
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setTranslation(position.x, position.y, position.z)
      .setFriction(1);
    if (rotation) desc.setRotation(rotation);
    return this.world.createCollider(desc);
  }

  /** Cilindro estático (plaza, troncos de árbol). */
  addStaticCylinder(
    halfHeight: number,
    radius: number,
    position: { x: number; y: number; z: number },
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius)
      .setTranslation(position.x, position.y, position.z)
      .setFriction(1);
    return this.world.createCollider(desc);
  }
}
