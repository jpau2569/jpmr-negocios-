import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Renderer WebGL con post-procesado: color space, tone mapping cinematográfico
 * (ACES) y un pase de bloom sutil que hace "florecer" solo lo más brillante
 * (monedas y lámparas emisivas). El composer se inicializa de forma perezosa en
 * el primer render, cuando ya se conocen escena y cámara.
 *
 * Coste del bloom: un pase extra a resolución completa (~1-2 ms en GPU de
 * escritorio). Se mantiene contenido con un umbral alto (solo emisivos) y
 * fuerza baja, de modo que la mayoría de píxeles del bloom quedan a cero.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  private setupComposer(scene: THREE.Scene, camera: THREE.Camera): void {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(scene, camera));

    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    // (resolución, fuerza, radio, umbral). El umbral >1 (espacio lineal HDR) deja
    // fuera la luz difusa de la escena; solo florecen los emisivos con intensidad >1.
    const bloom = new UnrealBloomPass(size, 0.42, 0.5, 1.1);
    composer.addPass(bloom);

    // OutputPass aplica el tone mapping y la conversión de color al final del pipeline.
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  onResize(camera: THREE.PerspectiveCamera): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setSize(window.innerWidth, window.innerHeight);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.composer) this.setupComposer(scene, camera);
    this.composer!.render();
  }
}
