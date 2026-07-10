import { PALETTE } from '../assets/palette';

/**
 * Configuración cosmética del avatar (colores + gorro), persistida en
 * localStorage. Es un objeto plano y serializable: mañana será parte del perfil
 * remoto (Fase online). Los catálogos de opciones alimentan el personalizador.
 */

export type HatId = 'none' | 'cap' | 'crown' | 'party' | 'headphones' | 'wizard' | 'halo';
export type BootsId = 'none' | 'jump' | 'speed';
export type WeaponId = 'none' | 'sword' | 'pistola' | 'chorro' | 'super' | 'mega';

/** Kind funcional del arma: espada (cuerpo a cuerpo) o pistola de agua (dispara). */
export function weaponKind(w: WeaponId): 'none' | 'sword' | 'water' {
  if (w === 'sword') return 'sword';
  if (w === 'none') return 'none';
  return 'water';
}

/** Stats de cada pistola de agua: cadencia (s), velocidad del chorro y color. */
export const WATER_GUNS: Record<string, { cooldown: number; speed: number; color: number }> = {
  pistola: { cooldown: 0.34, speed: 24, color: 0x5b8fd9 },
  chorro: { cooldown: 0.26, speed: 27, color: 0x35d0ba },
  super: { cooldown: 0.19, speed: 31, color: 0x66bf62 },
  mega: { cooldown: 0.13, speed: 35, color: 0x9b7fd4 },
};

export interface AvatarConfig {
  torso: number; // color de torso + brazos
  legs: number;
  skin: number; // color de cabeza + manos
  hat: HatId;
  boots: BootsId; // gear con efecto: salto o velocidad
  weapon: WeaponId;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  torso: PALETTE.playerTorso,
  legs: PALETTE.playerLegs,
  skin: PALETTE.playerHead,
  hat: 'none',
  boots: 'none',
  weapon: 'none',
};

/** Multiplicadores de gameplay del gear (botas). El resto es cosmético. */
export const JUMP_MUL: Record<BootsId, number> = { none: 1, jump: 1.38, speed: 1 };
export const SPEED_MUL: Record<BootsId, number> = { none: 1, jump: 1, speed: 1.42 };

export const BOOTS: { id: BootsId; label: string }[] = [
  { id: 'none', label: 'Ninguna' },
  { id: 'jump', label: 'Botas saltarinas' },
  { id: 'speed', label: 'Botas veloces' },
];
export const BOOTS_PRICES: Record<BootsId, number> = { none: 0, jump: 14, speed: 14 };

export const WEAPONS: { id: WeaponId; label: string }[] = [
  { id: 'none', label: 'Ninguna' },
  { id: 'sword', label: 'Espada' },
  { id: 'pistola', label: 'Pistola de agua' },
  { id: 'chorro', label: 'Chorro doble' },
  { id: 'super', label: 'Súper soaker' },
  { id: 'mega', label: 'Mega cañón' },
];
export const WEAPON_PRICES: Record<WeaponId, number> = {
  none: 0, sword: 20, pistola: 10, chorro: 18, super: 30, mega: 45,
};

/** Catálogos de opciones para el personalizador (colores amables tipo bloques). */
export const TORSO_COLORS = [0x35d0ba, 0xd9634f, 0x5b8fd9, 0x9b7fd4, 0x66bf62, 0xe8934a, 0xe86fa8];
export const LEG_COLORS = [0x3e5a6b, 0x9a6b45, 0x2b2f3a, 0x8a8f99, 0x2f8f80, 0x5b3a6b];
export const SKIN_COLORS = [0xf5c542, 0xf0d0b0, 0xd9a066, 0x9c6b4a, 0x8fd46a, 0x9fd8e8];
export const HATS: { id: HatId; label: string }[] = [
  { id: 'none', label: 'Sin gorro' },
  { id: 'cap', label: 'Gorra' },
  { id: 'headphones', label: 'Cascos' },
  { id: 'party', label: 'Fiesta' },
  { id: 'wizard', label: 'Mago' },
  { id: 'crown', label: 'Corona' },
  { id: 'halo', label: 'Aureola' },
];

/** Precio en monedas de cada gorro (0 = gratis). Los de pago se compran en la tienda. */
export const HAT_PRICES: Record<HatId, number> = {
  none: 0, cap: 0, headphones: 5, party: 8, wizard: 12, crown: 15, halo: 18,
};

/** Id de desbloqueo persistido para un gorro. */
export const hatUnlockId = (hat: HatId): string => `hat.${hat}`;

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
        hat: (['none', 'cap', 'crown', 'party', 'headphones', 'wizard', 'halo'] as HatId[]).includes(p.hat as HatId)
          ? (p.hat as HatId)
          : 'none',
        boots: (['none', 'jump', 'speed'] as BootsId[]).includes(p.boots as BootsId)
          ? (p.boots as BootsId)
          : 'none',
        weapon: (['none', 'sword', 'pistola', 'chorro', 'super', 'mega'] as WeaponId[]).includes(p.weapon as WeaponId)
          ? (p.weapon as WeaponId)
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
