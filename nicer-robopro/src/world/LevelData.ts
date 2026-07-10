import { PALETTE } from '../assets/palette';

/**
 * Definición de mundos DIRIGIDA POR DATOS.
 *
 * Cada mundo (hub, plaza, islas…) es una estructura PLANA y serializable que
 * describe su contrato de gameplay: dónde aparece el jugador, plataformas,
 * monedas, zonas de misión, torre opcional y portales a otros mundos.
 *
 * Un registro central (`WORLDS`) permite cargar/descargar mundos en caliente:
 * es la base del hub "estilo plataforma de muchos juegos". Al no contener
 * objetos de Three/Rapier, este formato también es la semilla del editor de
 * mapas y de la replicación de mundo por red.
 */

export type Vec3 = readonly [x: number, y: number, z: number];

/** Plataforma sólida: caja visual + collider estático. Rotaciones opcionales (rampas). */
export interface PlatformDef {
  size: Vec3; // ancho, alto, profundo
  pos: Vec3;
  color: number;
  rotY?: number;
  rotZ?: number;
}

/** Zona de misión: volumen cilíndrico de disparo en el plano XZ. */
export interface ZoneDef {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
}

/** Landmark "torre": base para construirla y umbral de altura para la misión de escalada. */
export interface TowerDef {
  x: number;
  z: number;
  topY: number;
}

/** Portal a otro mundo: arco visual + disparador de teletransporte por proximidad. */
export interface PortalDef {
  pos: Vec3;
  target: string; // id del mundo destino en WORLDS
  label: string; // rótulo mostrado (nombre del mundo)
  color: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  spawn: Vec3;
  platforms: PlatformDef[];
  coins: Vec3[];
  zones: ZoneDef[];
  portals: PortalDef[];
  tower?: TowerDef;
  /** Plaza central decorativa (hub y parque social). */
  centerPlaza?: boolean;
  /** Checkpoints de obby: al tocarlos se actualiza el punto de reaparición. */
  checkpoints?: Vec3[];
  /** Meta del obby: al alcanzarla se completa el mundo (con tiempo/récord). */
  finish?: Vec3;
  /** Sin suelo (mundos flotantes tipo obby: caerse cuenta). */
  noGround?: boolean;
  /** Altura por debajo de la cual se reaparece (obby: justo bajo las plataformas). */
  killY?: number;
}

// --- HUB: lobby social central. Sin monedas ni misiones; solo portales. ---
const HUB: LevelDefinition = {
  id: 'hub',
  name: 'Plaza Central',
  spawn: [0, 3, 0],
  centerPlaza: true,
  platforms: [],
  coins: [],
  zones: [],
  portals: [
    { pos: [-9, 0.9, -6], target: 'plaza', label: 'Parque', color: PALETTE.brickRed },
    { pos: [9, 0.9, -6], target: 'islas', label: 'Islas', color: PALETTE.brickTeal },
    { pos: [0, 0.9, -9], target: 'obby', label: 'Obby', color: PALETTE.brickYellow },
  ],
};

// --- PARQUE: el lobby original con plataformas, torre, monedas y misiones. ---
const PLAZA: LevelDefinition = {
  id: 'plaza',
  name: 'Parque',
  spawn: [0, 3, 8],
  centerPlaza: true,
  platforms: [
    // Zona norte (-Z): escalones rojos hacia una isla flotante.
    { size: [5, 1, 5], pos: [0, 0.5, -16], color: PALETTE.brickRed },
    { size: [4, 1, 4], pos: [5, 1.6, -21], color: PALETTE.brickRed },
    { size: [4, 1, 4], pos: [0, 2.7, -26], color: PALETTE.brickRed },
    { size: [6, 1, 6], pos: [-7, 3.9, -30], color: PALETTE.brickRed },
    // Zona este (+X): rampa azul larga hasta un mirador.
    { size: [3.5, 0.5, 10], pos: [16, 1.4, 6], color: PALETTE.brickBlue, rotZ: 0.28 },
    { size: [6, 1, 6], pos: [16, 2.9, -2.2], color: PALETTE.brickBlue },
    { size: [4, 1, 4], pos: [22, 4.4, -7], color: PALETTE.brickBlue },
    // Zona sur (+Z): plataformas amarillas bajas, salto fácil.
    { size: [4, 1.2, 4], pos: [-4, 0.6, 18], color: PALETTE.brickYellow },
    { size: [4, 2.2, 4], pos: [3, 1.1, 22], color: PALETTE.brickYellow },
    { size: [4, 3.2, 4], pos: [-3, 1.6, 27], color: PALETTE.brickYellow },
  ],
  coins: [
    [0, 1.9, -16], [0, 4.1, -26], [-7, 5.3, -30],
    [16, 4.3, -2.2], [22, 5.8, -7],
    [-4, 2.1, 18], [3, 3.1, 22], [-3, 4.1, 27],
    [-20, 8.6, 2],
    [6, 1.1, 12], [-10, 1.1, -6], [11, 1.1, -12],
  ],
  zones: [
    { id: 'norte', label: 'Zona norte', x: 0, z: -25, radius: 8 },
    { id: 'este', label: 'Zona este', x: 18, z: -3, radius: 8 },
    { id: 'sur', label: 'Zona sur', x: 0, z: 22, radius: 8 },
    { id: 'oeste', label: 'Zona oeste', x: -20, z: 2, radius: 8 },
  ],
  tower: { x: -20, z: 2, topY: 8.2 },
  portals: [{ pos: [0, 0.9, 12], target: 'hub', label: 'Volver al hub', color: PALETTE.brickPurple }],
};

// --- ISLAS: mundo nuevo de plataformas flotantes con monedas. ---
const ISLAS: LevelDefinition = {
  id: 'islas',
  name: 'Islas',
  spawn: [0, 3, 10],
  platforms: [
    { size: [8, 1, 8], pos: [0, 0.5, 8], color: PALETTE.brickTeal },
    { size: [5, 1, 5], pos: [0, 1.6, 0], color: PALETTE.brickPurple },
    { size: [4, 1, 4], pos: [-7, 2.6, -6], color: PALETTE.brickBlue },
    { size: [4, 1, 4], pos: [7, 3.4, -6], color: PALETTE.brickYellow },
    { size: [5, 1, 5], pos: [0, 4.6, -13], color: PALETTE.brickRed },
    { size: [3.5, 1, 3.5], pos: [-8, 5.6, -16], color: PALETTE.brickTeal },
    { size: [3.5, 1, 3.5], pos: [8, 6.4, -16], color: PALETTE.brickPurple },
    { size: [6, 1, 6], pos: [0, 7.4, -22], color: PALETTE.brickYellow },
  ],
  coins: [
    [0, 2.7, 0], [-7, 3.7, -6], [7, 4.5, -6],
    [0, 5.7, -13], [-8, 6.7, -16], [8, 7.5, -16],
    [0, 8.7, -22],
  ],
  zones: [],
  portals: [{ pos: [0, 1.4, 11], target: 'hub', label: 'Volver al hub', color: PALETTE.brickPurple }],
};

// --- OBBY: circuito de parkour flotante con checkpoints y meta. ---
const OBBY: LevelDefinition = {
  id: 'obby',
  name: 'Obby',
  spawn: [0, 3, 12],
  noGround: true, // flotante: caerse reaparece en el último checkpoint
  killY: -3,
  platforms: [
    { size: [6, 1, 6], pos: [0, 0.5, 12], color: PALETTE.brickTeal }, // inicio
    { size: [3, 1, 3], pos: [0, 1, 5], color: PALETTE.brickYellow },
    { size: [2.6, 1, 2.6], pos: [5, 1.6, 1], color: PALETTE.brickBlue },
    { size: [2.6, 1, 2.6], pos: [5, 2.4, -5], color: PALETTE.brickRed }, // checkpoint 1
    { size: [2.6, 1, 2.6], pos: [0, 3.2, -9], color: PALETTE.brickPurple },
    { size: [2.6, 1, 2.6], pos: [-5, 4, -13], color: PALETTE.brickYellow },
    { size: [2.6, 1, 2.6], pos: [-5, 4.8, -19], color: PALETTE.brickRed }, // checkpoint 2
    { size: [2.6, 1, 2.6], pos: [0, 5.6, -23], color: PALETTE.brickBlue },
    { size: [2.6, 1, 2.6], pos: [5, 6.4, -27], color: PALETTE.brickPurple },
    { size: [6, 1, 6], pos: [0, 7, -33], color: PALETTE.brickTeal }, // meta
  ],
  coins: [],
  zones: [],
  checkpoints: [[5, 2.9, -5], [-5, 5.3, -19]],
  finish: [0, 7.5, -33],
  portals: [{ pos: [-3, 0.9, 13], target: 'hub', label: 'Volver al hub', color: PALETTE.brickPurple }],
};

/** Registro de mundos y mundo inicial. */
export const WORLDS: Record<string, LevelDefinition> = { hub: HUB, plaza: PLAZA, islas: ISLAS, obby: OBBY };
export const START_WORLD = 'hub';
