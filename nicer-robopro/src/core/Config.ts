/**
 * Configuración central del juego. Todos los números "de sensación"
 * (movimiento, cámara, físicas) viven aquí para poder ajustarlos en un solo sitio.
 */
export const CONFIG = {
  physics: {
    fixedStep: 1 / 60,
    gravity: -32,
    maxSubSteps: 5,
  },
  player: {
    walkSpeed: 6,
    runSpeed: 9.5,
    jumpSpeed: 12.5,
    airControl: 0.6, // fracción de aceleración disponible en el aire
    accel: 60, // aceleración horizontal en suelo (m/s²)
    capsuleHalfHeight: 0.55,
    capsuleRadius: 0.4,
    spawn: { x: 0, y: 3, z: 6 },
    killPlaneY: -25, // por debajo de esto se respawnea
    coyoteTime: 0.12, // segundos de gracia para saltar tras dejar el suelo
  },
  camera: {
    fov: 60,
    minDistance: 3,
    maxDistance: 12,
    startDistance: 7,
    heightOffset: 1.4, // punto que mira la cámara, sobre los pies del jugador
    sensitivity: 0.0024,
    minPitch: -0.25 * Math.PI,
    maxPitch: 0.42 * Math.PI,
    followLerp: 14, // velocidad de suavizado del objetivo
    collisionMargin: 0.3,
  },
  world: {
    size: 90,
    fogColor: 0xcfe6f2,
    fogNear: 45,
    fogFar: 130,
  },
  coins: {
    total: 12,
    pickupRadius: 1.3,
    spinSpeed: 2.2,
    bobAmplitude: 0.18,
    bobSpeed: 2.4,
  },
};
