import * as THREE from 'three';
import { PlayerAvatar } from '../player/PlayerAvatar';
import { AvatarAnimator } from '../player/AvatarAnimator';
import { DEFAULT_AVATAR, type AvatarConfig } from '../player/AvatarConfig';

/** Aspecto de Iyan: rival en rojo con gorra, para distinguirlo del jugador. */
const IYAN: AvatarConfig = {
  ...DEFAULT_AVATAR, torso: 0xd9634f, legs: 0x2b2f3a, skin: 0xd9a066, hat: 'cap',
};

/**
 * Iyan, el rival controlado por el juego: recorre una ruta de waypoints hacia la
 * meta a un ritmo exigente (calibrado al tiempo de oro), animado como corredor.
 * El juego compara quién llega antes. Es difícil pero batible con buena carrera.
 */
export class RivalRacer {
  readonly group: THREE.Group;
  private animator: AvatarAnimator;
  private path: THREE.Vector3[];
  private seg = 0;
  private segT = 0;
  private speed: number;
  private time = 0;
  finished = false;

  constructor(path: THREE.Vector3[], targetTime: number) {
    const avatar = new PlayerAvatar(IYAN);
    this.animator = new AvatarAnimator(avatar.parts);
    this.group = avatar.group;
    this.path = path;

    let length = 0;
    for (let i = 0; i < path.length - 1; i++) length += path[i].distanceTo(path[i + 1]);
    this.speed = length / Math.max(targetTime, 1);

    if (path.length > 0) this.group.position.copy(path[0]);
  }

  /** Progreso 0..1 a lo largo de la ruta (para el HUD). */
  get progress(): number {
    if (this.path.length < 2) return 1;
    return Math.min(1, (this.seg + this.segT) / (this.path.length - 1));
  }

  update(dt: number): void {
    this.time += dt;
    if (this.finished || this.path.length < 2) {
      this.animator.update(dt, 'idle', 0, this.time);
      return;
    }

    let move = this.speed * dt;
    while (move > 0 && this.seg < this.path.length - 1) {
      const a = this.path[this.seg];
      const b = this.path[this.seg + 1];
      const segLen = a.distanceTo(b);
      const remain = segLen * (1 - this.segT);
      if (move < remain) {
        this.segT += move / segLen;
        move = 0;
      } else {
        move -= remain;
        this.seg++;
        this.segT = 0;
      }
    }

    const i = Math.min(this.seg, this.path.length - 1);
    const j = Math.min(this.seg + 1, this.path.length - 1);
    const a = this.path[i];
    const b = this.path[j];
    this.group.position.copy(a).lerp(b, this.segT);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (dx * dx + dz * dz > 0.0001) this.group.rotation.y = Math.atan2(dx, dz);

    if (this.seg >= this.path.length - 1) this.finished = true;
    this.animator.update(dt, 'run', this.speed, this.time);
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.group.clear();
  }
}
