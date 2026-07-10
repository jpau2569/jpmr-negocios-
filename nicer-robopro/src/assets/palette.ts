/**
 * Paleta central del juego: "nostalgia 2006 reinterpretada".
 * Verdes de hierba saturados pero suaves, cielo pastel, acentos teal/dorado.
 * Todo el color del mundo sale de aquí para mantener coherencia visual.
 */
export const PALETTE = {
  sky: 0xa8d8ef, // horizonte (parte baja del degradado)
  skyTop: 0x4f97d6, // cenit (parte alta, azul más saturado)
  fog: 0xcfe6f2,
  sunlight: 0xfff3dd,
  ambientSky: 0xbfd9e8,
  ambientGround: 0x8aa06a,

  grass: 0x79c153,
  grassDark: 0x5fa441,
  plaza: 0xe8e2d4,
  plazaTrim: 0xcbc3af,

  brickRed: 0xd9634f,
  brickBlue: 0x5b8fd9,
  brickYellow: 0xe8c04a,
  brickTeal: 0x35d0ba,
  brickPurple: 0x9b7fd4,
  wood: 0x9a6b45,
  leaves: 0x4da653,
  leavesLight: 0x66bf62,
  stone: 0xb8b2a6,

  coin: 0xffd94a,
  coinEmissive: 0xffaa00,

  playerTorso: 0x35d0ba,
  playerLegs: 0x3e5a6b,
  playerArms: 0x35d0ba,
  playerHands: 0xf5c542,
  playerHead: 0xf5c542,
  playerFace: 0x132028,
} as const;
