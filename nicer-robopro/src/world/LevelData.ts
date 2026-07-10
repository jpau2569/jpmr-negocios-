import { PALETTE } from '../assets/palette';

/**
 * Definición de nivel DIRIGIDA POR DATOS.
 *
 * Describe el "contrato de gameplay" que varios sistemas deben compartir
 * (plataformas jugables, posiciones de moneda, zonas de misión, torre) en una
 * estructura PLANA y serializable a JSON. Antes estos datos vivían duplicados
 * entre `Lobby.ts` y `MissionSystem.ts`; ahora hay una única fuente de verdad.
 *
 * Deliberadamente NO incluye la geometría puramente decorativa/procedural
 * (suelo, plaza, escalera de la torre, árboles): eso sigue en `Lobby`, porque
 * se genera con algoritmos y no forma parte del contrato entre sistemas.
 *
 * Al ser plano y sin objetos de Three/Rapier, este formato es la semilla del
 * futuro editor de mapas (Fase 4) y de la replicación de nivel por red.
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
  topY: number; // por encima de esta Y (cerca de x,z) se considera "en la cima"
}

export interface LevelDefinition {
  id: string;
  platforms: PlatformDef[];
  coins: Vec3[];
  zones: ZoneDef[];
  tower: TowerDef;
}

/**
 * El lobby actual, expresado como datos. Coordenadas idénticas a las que antes
 * estaban repartidas por el código, de modo que el comportamiento no cambia.
 */
export const LOBBY_LEVEL: LevelDefinition = {
  id: 'lobby',

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
    // Norte
    [0, 1.9, -16], [0, 4.1, -26], [-7, 5.3, -30],
    // Este
    [16, 4.3, -2.2], [22, 5.8, -7],
    // Sur
    [-4, 2.1, 18], [3, 3.1, 22], [-3, 4.1, 27],
    // Cima de la torre
    [-20, 8.6, 2],
    // A ras de suelo (recompensa inmediata al arrancar)
    [6, 1.1, 12], [-10, 1.1, -6], [11, 1.1, -12],
  ],

  zones: [
    { id: 'norte', label: 'Zona norte', x: 0, z: -25, radius: 8 },
    { id: 'este', label: 'Zona este', x: 18, z: -3, radius: 8 },
    { id: 'sur', label: 'Zona sur', x: 0, z: 22, radius: 8 },
    { id: 'oeste', label: 'Zona oeste', x: -20, z: 2, radius: 8 },
  ],

  tower: { x: -20, z: 2, topY: 8.2 },
};
