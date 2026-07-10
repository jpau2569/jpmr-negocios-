import type * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { MissionInfo } from '../types';

/**
 * Misiones simples del lobby. Cada misión es un contador con objetivo;
 * el progreso llega por eventos (monedas) o por posición del jugador
 * (zonas visitadas, cima de la torre). Emite eventos para HUD y trofeos.
 */

/** Centros de las cuatro zonas de plataformas (debe coincidir con Lobby). */
const ZONES = [
  { id: 'norte', x: 0, z: -25 },
  { id: 'este', x: 18, z: -3 },
  { id: 'sur', x: 0, z: 22 },
  { id: 'oeste', x: -20, z: 2 },
];
const ZONE_RADIUS = 8;
const TOWER = { x: -20, z: 2, topY: 8.2 };

export class MissionSystem {
  private missions: MissionInfo[] = [];
  private visitedZones = new Set<string>();

  constructor(private events: EventBus, coinTotal: number) {
    this.missions = [
      { id: 'coleccionista', title: 'Recoge todas las monedas', progress: 0, target: coinTotal, done: false },
      { id: 'explorador', title: 'Visita las 4 zonas', progress: 0, target: 4, done: false },
      { id: 'escalador', title: 'Sube a la torre', progress: 0, target: 1, done: false },
    ];

    events.on('coin-collected', ({ collected }) => {
      this.setProgress('coleccionista', collected);
    });
  }

  /** Chequeos por posición; llamar cada frame durante la partida. */
  update(playerPos: THREE.Vector3): void {
    for (const zone of ZONES) {
      if (this.visitedZones.has(zone.id)) continue;
      const dx = playerPos.x - zone.x;
      const dz = playerPos.z - zone.z;
      if (dx * dx + dz * dz < ZONE_RADIUS * ZONE_RADIUS) {
        this.visitedZones.add(zone.id);
        this.setProgress('explorador', this.visitedZones.size);
      }
    }

    const dxT = playerPos.x - TOWER.x;
    const dzT = playerPos.z - TOWER.z;
    if (playerPos.y > TOWER.topY && dxT * dxT + dzT * dzT < 9) {
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
