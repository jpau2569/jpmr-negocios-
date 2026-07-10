import * as THREE from 'three';
import { PALETTE } from './palette';

/**
 * Fábrica de materiales estilizados compartidos. Los materiales se cachean por color
 * para que todo el mundo reutilice instancias (menos cambios de estado en GPU).
 */
const cache = new Map<string, THREE.MeshStandardMaterial>();

export function matte(color: number, roughness = 0.9, metalness = 0): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}-${metalness}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    cache.set(key, mat);
  }
  return mat;
}

export function coinMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: PALETTE.coin,
    emissive: PALETTE.coinEmissive,
    emissiveIntensity: 1.3, // >1 para cruzar el umbral de bloom y "florecer"
    roughness: 0.25,
    metalness: 0.75,
  });
}
