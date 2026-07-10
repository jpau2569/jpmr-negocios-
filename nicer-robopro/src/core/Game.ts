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
import { LOBBY_LEVEL } from '../world/LevelData';
import { CoinSystem } from '../systems/CoinSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { MissionSystem } from '../systems/MissionSystem';
import { Inventory } from '../systems/Inventory';
import { LocalNetworkAdapter, type NetworkAdapter } from '../net/NetworkAdapter';
import { UIManager, formatTime } from '../ui/UIManager';
import { PALETTE } from '../assets/palette';
import { StateMachine } from './StateMachine';

/**
 * Orquestador del juego: composición de todos los módulos, máquina de estados
 * y bucle principal. La física corre a timestep fijo (acumulador) y el visual
 * del jugador se interpola entre pasos, de modo que el render es fluido a
 * cualquier framerate sin comprometer la estabilidad de las colisiones.
 */
export class Game {
  private events = new EventBus();
  // La máquina notifica cada cambio y el juego lo reemite por el bus (contrato con la UI).
  private machine = new StateMachine((name) => this.events.emit('state-changed', { state: name }));

  private renderer!: Renderer;
  private scene = new THREE.Scene();
  private cameraRig!: CameraRig;
  private physics = new PhysicsWorld();
  private input!: InputManager;
  private player!: PlayerController;
  private coins!: CoinSystem;
  private ui!: UIManager;
  private audio = new AudioSystem();
  private particles = new ParticleSystem();
  private missions!: MissionSystem;
  private inventory!: Inventory;
  private network: NetworkAdapter = new LocalNetworkAdapter();

  private accumulator = 0;
  private lastTime = 0;
  private elapsed = 0; // tiempo de partida (solo avanza en 'playing')
  private snapshotTimer = 0;

  constructor(private canvas: HTMLCanvasElement) {}

  async init(): Promise<void> {
    this.ui = new UIManager(this.events);
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(this.canvas);

    await this.physics.init();

    this.cameraRig = new CameraRig(this.physics.world, this.physics.rapier);
    setupEnvironment(this.scene);

    // El nivel se define como datos (LevelData); geometría, monedas y misiones
    // consumen la MISMA fuente de verdad.
    const level = LOBBY_LEVEL;
    const lobby = new Lobby(this.physics, level);
    this.scene.add(lobby.group);

    this.player = new PlayerController(this.physics);
    this.scene.add(this.player.avatar.group);

    // Los spots del nivel son tuplas planas; se convierten a Vector3 en el
    // límite con el sistema de render (LevelData se mantiene serializable).
    const coinSpots = level.coins.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
    this.coins = new CoinSystem(coinSpots, this.events);
    this.scene.add(this.coins.group);
    this.scene.add(this.particles.points);

    // El inventario se suscribe antes que los handlers de wireGameFeel para que
    // récords y trofeos ya estén actualizados cuando estos los lean.
    this.inventory = new Inventory(this.events);
    this.missions = new MissionSystem(this.events, this.coins.total, level);

    this.registerStates();
    this.wireUI();
    this.wireGameFeel();
    this.missions.emitState();
    void this.network.connect();

    window.addEventListener('resize', () => this.renderer.onResize(this.cameraRig.camera));

    this.machine.transition('title');
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  /**
   * Registra los estados del juego. Los triviales son literales; solo 'playing'
   * simula el mundo (delegando en `simulate`). El estado 'loading' es implícito:
   * la pantalla de carga se muestra por defecto hasta la primera transición.
   */
  private registerStates(): void {
    this.machine.register(
      { name: 'title' },
      { name: 'playing', update: (dt) => this.simulate(dt) },
      { name: 'paused' },
      { name: 'won', onEnter: () => this.input.exitPointerLock() },
    );
  }

  private wireUI(): void {
    this.ui.onPlay = () => this.startPlaying();
    this.ui.onResume = () => this.startPlaying();
    this.ui.onRestart = () => this.restart();

    // Perder el pointer lock (Esc del navegador) equivale a pausar.
    this.input.onPointerLockLost = () => {
      if (this.machine.is('playing')) this.machine.transition('paused');
    };

    // Fallback: si el pointer lock no está activo, Esc pausa/reanuda directamente.
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape') return;
      if (this.machine.is('playing')) this.machine.transition('paused');
      else if (this.machine.is('paused')) this.startPlaying();
    });

    this.events.on('all-coins-collected', () => this.machine.transition('won'));

    // Estadísticas del inventario al entrar en pausa o victoria.
    this.events.on('state-changed', ({ state }) => {
      if (state === 'paused' || state === 'won') {
        this.ui.setStats(
          this.inventory.totalCoins,
          this.inventory.trophyCount,
          this.inventory.bestTimeSeconds,
        );
      }
    });
  }

  /** Conexiones de game feel: audio, partículas y squash & stretch. */
  private wireGameFeel(): void {
    // El squash & stretch lo dispara el propio PlayerController; aquí solo va el
    // game feel externo (audio + partículas) que orquesta el juego.
    this.player.onJump = () => {
      this.audio.jump();
    };
    this.player.onLand = (impact) => {
      this.audio.land(impact);
      this.particles.burst(this.player.avatar.group.position, 0xd8cfba, {
        count: Math.min(6 + Math.floor(impact), 18),
        speed: 1.6,
        spread: 0.35,
        life: 0.45,
        gravity: -2,
        upBias: 0.8,
      });
    };

    this.events.on('coin-collected', ({ position }) => {
      if (!position) return; // resets
      this.audio.coin();
      this.particles.burst(new THREE.Vector3(position.x, position.y, position.z), PALETTE.coin, {
        count: 16,
        speed: 3,
        life: 0.7,
        gravity: -3,
        upBias: 2,
      });
    });

    this.events.on('mission-completed', () => this.audio.missionComplete());
    this.events.on('all-coins-collected', ({ timeSeconds }) => {
      this.audio.win();
      this.ui.setWinBest(
        this.inventory.isBestTime(timeSeconds)
          ? '¡Nuevo récord personal!'
          : `Mejor tiempo: ${formatTime(this.inventory.bestTimeSeconds ?? timeSeconds)}`,
      );
    });
  }

  private startPlaying(): void {
    this.audio.unlock(); // los botones son gestos de usuario: momento válido para WebAudio
    this.audio.click();
    this.machine.transition('playing');
    this.input.requestPointerLock();
  }

  private restart(): void {
    this.elapsed = 0;
    this.coins.reset();
    this.missions.reset();
    this.player.respawn();
    this.ui.updateTimer(0);
    this.ui.setWinBest('');
    this.startPlaying();
  }

  /**
   * Simulación del mundo durante 'playing'. Física a paso fijo con acumulador +
   * interpolación visual del jugador, seguido de los sistemas de lógica/presentación.
   * Solo se ejecuta cuando el estado 'playing' está activo (lo llama la máquina).
   */
  private simulate(dt: number): void {
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
    this.particles.update(dt);
    this.missions.update(this.player.visualPos);

    // Publica el estado local a ~10 Hz por la capa de red (loopback en Fase 1).
    this.snapshotTimer += dt;
    if (this.snapshotTimer >= 0.1) {
      this.snapshotTimer = 0;
      this.network.sendSnapshot({
        id: 'local',
        x: this.player.visualPos.x,
        y: this.player.visualPos.y,
        z: this.player.visualPos.z,
        heading: this.player.heading,
        anim: this.player.animState,
      });
    }

    this.elapsed += dt;
    this.ui.updateTimer(this.elapsed);
  }

  private loop = (now: number): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // clamp anti-pestaña dormida
    this.lastTime = now;

    // Solo el estado activo simula ('playing' → simulate); el resto no hace nada.
    this.machine.update(dt);

    // Cámara y render corren SIEMPRE (también en pausa/victoria) para no congelar el encuadre.
    this.cameraRig.update(dt, this.player.visualPos, this.player.collider);
    this.renderer.render(this.scene, this.cameraRig.camera);
  };
}
