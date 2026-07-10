import { PALETTE } from '../assets/palette';

/**
 * Configuración cosmética del avatar (colores + gorro), persistida en
 * localStorage. Es un objeto plano y serializable: mañana será parte del perfil
 * remoto (Fase online). Los catálogos de opciones alimentan el personalizador.
 */

export type HatId = 'none' | 'cap' | 'crown' | 'party' | 'headphones' | 'wizard' | 'halo';
export type HeadId = 'normal' | 'dragon' | 'croc' | 'lion' | 'bear' | 'dino';
export type HairId = 'none' | 'militar' | 'largo' | 'punki';
export type OutfitId = 'normal' | 'militar';
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
  head: HeadId; // cabeza humana o de animal
  hair: HairId;
  outfit: OutfitId; // ropa normal o militar
  boots: BootsId; // gear con efecto: salto o velocidad
  weapon: WeaponId;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  torso: PALETTE.playerTorso,
  legs: PALETTE.playerLegs,
  skin: PALETTE.playerHead,
  hat: 'none',
  head: 'normal',
  hair: 'none',
  outfit: 'normal',
  boots: 'none',
  weapon: 'none',
};

/** Color base de cada cabeza de animal. */
export const ANIMAL_COLORS: Record<string, number> = {
  dragon: 0x4da653, croc: 0x3f7d3f, lion: 0xe0a03a, bear: 0x8a5a2b, dino: 0x66bf62,
};

export const HEADS: { id: HeadId; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'bear', label: 'Oso' },
  { id: 'croc', label: 'Cocodrilo' },
  { id: 'lion', label: 'León' },
  { id: 'dino', label: 'Dino' },
  { id: 'dragon', label: 'Dragón' },
];
export const HEAD_PRICES: Record<HeadId, number> = {
  normal: 0, bear: 14, croc: 16, lion: 18, dino: 20, dragon: 22,
};

export const HAIRS: { id: HairId; label: string }[] = [
  { id: 'none', label: 'Sin pelo' },
  { id: 'militar', label: 'Militar' },
  { id: 'largo', label: 'Melena' },
  { id: 'punki', label: 'Cresta' },
];
export const HAIR_PRICES: Record<HairId, number> = { none: 0, militar: 6, largo: 8, punki: 8 };

export const OUTFITS: { id: OutfitId; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'militar', label: 'Militar' },
];
export const OUTFIT_PRICES: Record<OutfitId, number> = { normal: 0, militar: 20 };
export const MILITARY_TORSO = 0x5a6b3a;
export const MILITARY_LEGS = 0x3d4a28;

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
        head: (['normal', 'dragon', 'croc', 'lion', 'bear', 'dino'] as HeadId[]).includes(p.head as HeadId)
          ? (p.head as HeadId)
          : 'normal',
        hair: (['none', 'militar', 'largo', 'punki'] as HairId[]).includes(p.hair as HairId)
          ? (p.hair as HairId)
          : 'none',
        outfit: (['normal', 'militar'] as OutfitId[]).includes(p.outfit as OutfitId)
          ? (p.outfit as OutfitId)
          : 'normal',
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
