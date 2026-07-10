import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../core/Config';
import { PALETTE } from '../assets/palette';
import { createSky } from './Sky';

/**
 * Atmósfera del mundo: cielo con degradado, niebla ligera, iluminación suave
 * (hemisférica + direccional cálida con sombras + contra fría) e IBL suave.
 *
 * El `scene.environment` (image-based lighting) se genera UNA vez con PMREM a
 * partir de un entorno neutro: da respuesta especular y reflejos sutiles a
 * todos los materiales estándar (sobre todo a las monedas metálicas), sin coste
 * por frame — solo el cálculo inicial del mapa.
 */
export function setupEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  // Cúpula con degradado; el color de fondo queda como fallback bajo ella.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.add(createSky());

  // Niebla exponencial: cae de forma más natural que la lineal y funde la
  // geometría lejana en el horizonte. Densidad baja para un velo sutil.
  scene.fog = new THREE.FogExp2(CONFIG.world.fogColor, 0.004);

  // IBL suave (una sola vez). environmentIntensity bajo para no aplanar la luz directa.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const hemi = new THREE.HemisphereLight(PALETTE.ambientSky, PALETTE.ambientGround, 0.65);
  scene.add(hemi);

  // Luz de contra fría y tenue: separa las siluetas del fondo sin proyectar sombras.
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.45);
  rim.position.set(-30, 25, -35);
  scene.add(rim);

  const sun = new THREE.DirectionalLight(PALETTE.sunlight, 1.75);
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
  sun.shadow.radius = 3; // bordes de sombra más suaves (PCFSoft)
  scene.add(sun);
}
