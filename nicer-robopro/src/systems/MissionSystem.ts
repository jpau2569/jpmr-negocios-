import type * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { MissionInfo } from '../types';
import type { LevelDefinition } from '../world/LevelData';

/**
 * Misiones simples del lobby. Cada misión es un contador con objetivo;
 * el progreso llega por eventos (monedas) o por posición del jugador
 * (zonas visitadas, cima de la torre). Emite eventos para HUD y trofeos.
 *
 * Las zonas y la torre se leen de la `LevelDefinition`: una única fuente de
 * verdad compartida con la geometría del lobby (antes estaban duplicadas).
 */
export class MissionSystem {
  private missions: MissionInfo[] = [];
  private visitedZones = new Set<string>();

  constructor(private events: EventBus, coinTotal: number, private level: LevelDefinition) {
    this.missions = [
      { id: 'coleccionista', title: 'Recoge todas las monedas', progress: 0, target: coinTotal, done: false },
      { id: 'explorador', title: 'Visita las 4 zonas', progress: 0, target: level.zones.length, done: false },
      { id: 'escalador', title: 'Sube a la torre', progress: 0, target: 1, done: false },
    ];

    events.on('coin-collected', ({ collected }) => {
      this.setProgress('coleccionista', collected);
    });
  }

  /** Chequeos por posición; llamar cada frame durante la partida. */
  update(playerPos: THREE.Vector3): void {
    for (const zone of this.level.zones) {
      if (this.visitedZones.has(zone.id)) continue;
      const dx = playerPos.x - zone.x;
      const dz = playerPos.z - zone.z;
      if (dx * dx + dz * dz < zone.radius * zone.radius) {
        this.visitedZones.add(zone.id);
        this.setProgress('explorador', this.visitedZones.size);
      }
    }

    const tower = this.level.tower;
    const dxT = playerPos.x - tower.x;
    const dzT = playerPos.z - tower.z;
    if (playerPos.y > tower.topY && dxT * dxT + dzT * dzT < 9) {
      this.setProgress('escalador', 1);
    }
  }

  private setProgress(id: string, value: number): void {
    const mission = this.missions.find((m) => m.id === id);
    if (!mission || mission.done || value === mission.progress) return;
    mission.progress = Math.min(value, mission.target);
    if (mission.progress >= mission.target) {
      mission.done = true;
      this.events.emit('mission-completed', { id: mission.id, title: mission.title });
    }
    this.emitState();
  }

  emitState(): void {
    this.events.emit('missions-updated', { missions: this.missions.map((m) => ({ ...m })) });
  }

  reset(): void {
    this.visitedZones.clear();
    for (const m of this.missions) {
      m.progress = 0;
      m.done = false;
    }
    this.emitState();
  }
}
