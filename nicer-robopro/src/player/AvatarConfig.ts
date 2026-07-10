import { PALETTE } from '../assets/palette';

/**
 * Configuración cosmética del avatar (colores + gorro), persistida en
 * localStorage. Es un objeto plano y serializable: mañana será parte del perfil
 * remoto (Fase online). Los catálogos de opciones alimentan el personalizador.
 */

export type HatId = 'none' | 'cap' | 'crown' | 'party';

export interface AvatarConfig {
  torso: number; // color de torso + brazos
  legs: number;
  skin: number; // color de cabeza + manos
  hat: HatId;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  torso: PALETTE.playerTorso,
  legs: PALETTE.playerLegs,
  skin: PALETTE.playerHead,
  hat: 'none',
};

/** Catálogos de opciones para el personalizador (colores amables tipo bloques). */
export const TORSO_COLORS = [0x35d0ba, 0xd9634f, 0x5b8fd9, 0x9b7fd4, 0x66bf62, 0xe8934a, 0xe86fa8];
export const LEG_COLORS = [0x3e5a6b, 0x9a6b45, 0x2b2f3a, 0x8a8f99, 0x2f8f80, 0x5b3a6b];
export const SKIN_COLORS = [0xf5c542, 0xf0d0b0, 0xd9a066, 0x9c6b4a, 0x8fd46a, 0x9fd8e8];
export const HATS: { id: HatId; label: string }[] = [
  { id: 'none', label: 'Sin gorro' },
  { id: 'cap', label: 'Gorra' },
  { id: 'crown', label: 'Corona' },
  { id: 'party', label: 'Fiesta' },
];

const STORAGE_KEY = 'nicer-robopro:avatar-v1';

export function loadAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AvatarConfig>;
      return {
        torso: typeof p.torso === 'number' ? p.torso : DEFAULT_AVATAR.torso,
        legs: typeof p.legs === 'number' ? p.legs : DEFAULT_AVATAR.legs,
        skin: typeof p.skin === 'number' ? p.skin : DEFAULT_AVATAR.skin,
        hat: (['none', 'cap', 'crown', 'party'] as HatId[]).includes(p.hat as HatId)
          ? (p.hat as HatId)
          : 'none',
      };
    }
  } catch {
    // storage no disponible: se usa el avatar por defecto
  }
  return { ...DEFAULT_AVATAR };
}

export function saveAvatar(config: AvatarConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignorar: sin persistencia
  }
}
