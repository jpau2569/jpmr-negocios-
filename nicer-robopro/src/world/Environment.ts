import * as THREE from 'three';
import { CONFIG } from '../core/Config';
import { PALETTE } from '../assets/palette';
import { createSky } from './Sky';

/**
 * Atmósfera del mundo: cielo con degradado, niebla ligera e iluminación suave
 * (hemisférica para el relleno + direccional cálida con sombras).
 */
export function setupEnvironment(scene: THREE.Scene): void {
  // Cúpula con degradado; el color de fondo queda como fallback bajo ella.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.add(createSky());
  scene.fog = new THREE.Fog(CONFIG.world.fogColor, CONFIG.world.fogNear, CONFIG.world.fogFar);

  const hemi = new THREE.HemisphereLight(PALETTE.ambientSky, PALETTE.ambientGround, 0.8);
  scene.add(hemi);

  // Luz de contra fría y tenue: separa las siluetas del fondo sin proyectar sombras.
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.4);
  rim.position.set(-30, 25, -35);
  scene.add(rim);

  const sun = new THREE.DirectionalLight(PALETTE.sunlight, 1.6);
  sun.position.set(35, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 160;
  const s = 60;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
}
