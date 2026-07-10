import * as THREE from 'three';
import { PALETTE } from '../assets/palette';

/**
 * Cúpula de cielo con degradado vertical (cenit saturado → horizonte claro).
 * Un único mesh esférico visto por dentro, con un shader que interpola el color
 * según la altura del rayo. Sustituye al fondo plano por un cielo con
 * profundidad — el mayor salto de "premium" por su coste. No recibe niebla
 * (fog:false) para que el degradado se mantenga limpio hasta el horizonte.
 */
export function createSky(): THREE.Mesh {
  const uniforms = {
    topColor: { value: new THREE.Color(PALETTE.skyTop) },
    bottomColor: { value: new THREE.Color(PALETTE.sky) },
    offset: { value: 12 }, // baja el punto de mezcla para ampliar el horizonte claro
    exponent: { value: 0.7 }, // curva del degradado (menor = transición más suave)
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float t = pow(max(h, 0.0), exponent);
        gl_FragColor = vec4(mix(bottomColor, topColor, clamp(t, 0.0, 1.0)), 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), material);
  sky.name = 'sky';
  return sky;
}
