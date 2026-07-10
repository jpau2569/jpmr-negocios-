import * as THREE from 'three';
import { CONFIG } from './Config';
import { EventBus } from './EventBus';
import { Renderer } from '../engine/Renderer';
import { CameraRig } from '../engine/CameraRig';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputManager } from '../player/InputManager';
import { PlayerController } from '../player/PlayerController';
import { setupEnvironment } from '../world/Environment';
import { Lobby } from '../world/Lobby';
import { CoinSystem } from '../systems/CoinSystem';
import { UIManager } from '../ui/UIManager';
import type { GameStateName } from '../types';

/**
 * Orquestador del juego: composición de todos los módulos, máquina de estados
 * y bucle principal. La física corre a timestep fijo (acumulador) y el visual
 * del jugador se interpola entre pasos, de modo que el render es fluido a
 * cualquier framerate sin comprometer la estabilidad de las colisiones.
 */
export class Game {
  private state: GameStateName = 'loading';
  private events = new EventBus();

  private renderer!: Renderer;
  private scene = new THREE.Scene();
  private cameraRig!: CameraRig;
  private physics = new PhysicsWorld();
  private input!: InputManager;
  private player!: PlayerController;
  private coins!: CoinSystem;
  private ui!: UIManager;

  private accumulator = 0;
  private lastTime = 0;
  private elapsed = 0; // tiempo de partida (solo avanza en 'playing')

  constructor(private canvas: HTMLCanvasElement) {}

  async init(): Promise<void> {
    this.ui = new UIManager(this.events);
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(this.canvas);

    await this.physics.init();

    this.cameraRig = new CameraRig(this.physics.world, this.physics.rapier);
    setupEnvironment(this.scene);

    const lobby = new Lobby(this.physics);
    this.scene.add(lobby.group);

    this.player = new PlayerController(this.physics);
    this.scene.add(this.player.avatar.group);

    this.coins = new CoinSystem(lobby.coinSpots, this.events);
    this.scene.add(this.coins.group);

    this.wireUI();

    window.addEventListener('resize', () => this.renderer.onResize(this.cameraRig.camera));

    this.setState('title');
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private wireUI(): void {
    this.ui.onPlay = () => this.startPlaying();
    this.ui.onResume = () => this.startPlaying();
    this.ui.onRestart = () => this.restart();

    // Perder el pointer lock (Esc del navegador) equivale a pausar.
    this.input.onPointerLockLost = () => {
      if (this.state === 'playing') this.setState('paused');
    };

    // Fallback: si el pointer lock no está activo, Esc pausa/reanuda directamente.
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.state === 'playing') this.setState('paused');
      else if (this.state === 'paused') this.startPlaying();
    });

    this.events.on('all-coins-collected', () => {
      this.input.exitPointerLock();
      this.setState('won');
    });
  }

  private startPlaying(): void {
    this.setState('playing');
    this.input.requestPointerLock();
  }

  private restart(): void {
    this.elapsed = 0;
    this.coins.reset();
    this.player.respawn();
    this.ui.updateTimer(0);
    this.startPlaying();
  }

  private setState(state: GameStateName): void {
    this.state = state;
    this.events.emit('state-changed', { state });
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // clamp anti-pestaña dormida
    this.lastTime = now;

    if (this.state === 'playing') {
      const input = this.input.consumeFrame();
      this.cameraRig.applyLook(input);

      // Física a paso fijo con acumulador.
      this.accumulator += dt;
      const step = CONFIG.physics.fixedStep;
      let subSteps = 0;
      while (this.accumulator >= step && subSteps < CONFIG.physics.maxSubSteps) {
        this.player.fixedUpdate(step, input, this.cameraRig.yaw);
        this.physics.step();
        this.accumulator -= step;
        subSteps++;
        input.jump = false; // el salto solo se consume una vez
      }
      if (subSteps === CONFIG.physics.maxSubSteps) this.accumulator = 0;

      const alpha = this.accumulator / step;
      this.player.syncVisual(alpha, dt);
      this.coins.update(dt, this.player.visualPos, this.elapsed);

      this.elapsed += dt;
      this.ui.updateTimer(this.elapsed);
    }

    // La cámara se actualiza también en pausa/victoria para mantener el encuadre vivo.
    this.cameraRig.update(dt, this.player.visualPos, this.player.collider);
    this.renderer.render(this.scene, this.cameraRig.camera);
  };
}
