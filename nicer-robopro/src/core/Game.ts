import * as THREE from 'three';
import { CONFIG } from './Config';
import { EventBus } from './EventBus';
import { Renderer } from '../engine/Renderer';
import { CameraRig } from '../engine/CameraRig';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputManager } from '../player/InputManager';
import { PlayerController } from '../player/PlayerController';
import { saveAvatar } from '../player/AvatarConfig';
import { setupEnvironment } from '../world/Environment';
import { Lobby } from '../world/Lobby';
import { WORLDS, START_WORLD, type LevelDefinition } from '../world/LevelData';
import { CoinSystem } from '../systems/CoinSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { RingFx } from '../systems/RingFx';
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

  // Mundo actual (hub/plaza/islas) y sus sistemas descargables.
  private currentLevel!: LevelDefinition;
  private currentLobby: Lobby | null = null;
  private portalCooldown = 0; // evita re-disparar el portal justo al llegar
  private reachedCheckpoints = new Set<number>(); // checkpoints del obby ya tocados
  private audio = new AudioSystem();
  private particles = new ParticleSystem();
  private ringFx = new RingFx();
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
    setupEnvironment(this.scene, this.renderer.renderer);

    this.player = new PlayerController(this.physics, this.ui.avatar);
    this.scene.add(this.player.avatar.group);
    this.scene.add(this.particles.points);
    this.scene.add(this.ringFx.group);

    // El inventario es global (persiste entre mundos) y se suscribe antes que
    // los handlers de wireGameFeel para que récords/trofeos estén frescos.
    this.inventory = new Inventory(this.events);

    this.registerStates();
    this.wireUI();
    this.wireGameFeel();
    void this.network.connect();

    // Carga el mundo inicial (hub). Monedas y misiones se crean por mundo.
    this.loadWorld(START_WORLD);

    // Hook de depuración: permite inspeccionar/forzar estado desde la consola.
    (window as unknown as { roboproGame: Game }).roboproGame = this;

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

  /**
   * Carga un mundo por id: descarga el actual (colliders, mallas y misiones del
   * mundo anterior), construye el nuevo desde datos y reaparece al jugador en su
   * spawn. El inventario y el jugador persisten entre mundos; monedas, misiones
   * y geometría son por mundo.
   */
  private loadWorld(id: string): void {
    const level = WORLDS[id];
    if (!level) throw new Error(`Mundo desconocido: ${id}`);

    if (this.currentLobby) {
      this.scene.remove(this.currentLobby.group);
      this.currentLobby.dispose();
      this.scene.remove(this.coins.group);
      this.coins.dispose();
      this.missions.dispose();
    }

    this.currentLevel = level;
    this.currentLobby = new Lobby(this.physics, level);
    this.scene.add(this.currentLobby.group);

    const coinSpots = level.coins.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
    this.coins = new CoinSystem(coinSpots, this.events);
    this.scene.add(this.coins.group);

    this.missions = new MissionSystem(this.events, this.coins.total, level);
    this.missions.emitState();
    // Refresca el contador del HUD al conteo del nuevo mundo (0 = se oculta).
    this.events.emit('coin-collected', { collected: 0, total: this.coins.total });

    this.player.setKillY(level.killY ?? CONFIG.player.killPlaneY);
    this.player.setSpawn(level.spawn[0], level.spawn[1], level.spawn[2]);
    this.reachedCheckpoints.clear();
    this.elapsed = 0;
    this.snapshotTimer = 0;
    this.portalCooldown = 0.8; // gracia para no re-disparar el portal al aparecer
    this.ui.updateTimer(0);
    this.ui.setPortalPrompt(null);
  }

  /** Completa el mundo actual (recoger todo o llegar a meta): récord + victoria. */
  private completeWorld(timeSeconds: number): void {
    const isRecord = this.inventory.recordBestTime(this.currentLevel.id, timeSeconds);
    this.audio.win();
    this.ui.setWinTime(timeSeconds);
    const best = this.inventory.getBestTime(this.currentLevel.id);
    this.ui.setWinBest(
      isRecord ? '¡Nuevo récord!' : best !== null ? `Mejor tiempo: ${formatTime(best)}` : '',
    );
    this.machine.transition('won');
  }

  /** Obby: checkpoints (actualizan reaparición) y meta (completa el mundo). */
  private checkObbyProgress(): void {
    const level = this.currentLevel;
    const p = this.player.visualPos;
    if (level.checkpoints) {
      for (let i = 0; i < level.checkpoints.length; i++) {
        if (this.reachedCheckpoints.has(i)) continue;
        const [cx, cy, cz] = level.checkpoints[i];
        if ((p.x - cx) ** 2 + (p.z - cz) ** 2 < 4 && Math.abs(p.y - cy) < 2) {
          this.reachedCheckpoints.add(i);
          this.player.setRespawnPoint(cx, cy + 0.6, cz);
          this.events.emit('checkpoint-reached', { index: i });
        }
      }
    }
    if (level.finish) {
      const [fx, fy, fz] = level.finish;
      if ((p.x - fx) ** 2 + (p.z - fz) ** 2 < 6.25 && Math.abs(p.y - fy) < 2.5) {
        this.completeWorld(this.elapsed);
      }
    }
  }

  /**
   * Portales: muestra el aviso al acercarse y viaja al cruzarlos. Devuelve true
   * si se cargó otro mundo este frame (para abortar el resto de la simulación).
   */
  private checkPortals(dt: number): boolean {
    if (this.portalCooldown > 0) {
      this.portalCooldown -= dt;
      this.ui.setPortalPrompt(null);
      return false;
    }
    const p = this.player.visualPos;
    let nearLabel: string | null = null;
    for (const portal of this.currentLobby!.portals) {
      const dx = p.x - portal.pos[0];
      const dz = p.z - portal.pos[2];
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.6 * 1.6) {
        this.loadWorld(portal.target);
        return true;
      }
      if (d2 < 4 * 4) nearLabel = portal.label;
    }
    this.ui.setPortalPrompt(nearLabel);
    return false;
  }

  private wireUI(): void {
    this.ui.onPlay = () => this.startPlaying();
    this.ui.onResume = () => this.startPlaying();
    this.ui.onRestart = () => this.restart();
    // Personalizador: preview en vivo sobre el avatar + persistencia al confirmar.
    this.ui.onAvatarChange = (cfg) => this.player.avatar.applyConfig(cfg);
    this.ui.onAvatarDone = (cfg) => saveAvatar(cfg);

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

    this.events.on('all-coins-collected', ({ timeSeconds }) => this.completeWorld(timeSeconds));

    // Estadísticas del inventario al entrar en pausa o victoria.
    this.events.on('state-changed', ({ state }) => {
      if (state === 'paused' || state === 'won') {
        this.ui.setStats(
          this.inventory.coins,
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
      const at = new THREE.Vector3(position.x, position.y, position.z);
      this.particles.burst(at, PALETTE.coin, {
        count: 18,
        speed: 3.2,
        life: 0.7,
        gravity: -3,
        upBias: 2,
      });
      this.ringFx.spawn(at, PALETTE.coin); // anillo de choque expansivo
    });

    this.events.on('mission-completed', () => this.audio.missionComplete());
    this.events.on('checkpoint-reached', () => this.audio.missionComplete());
  }

  private startPlaying(): void {
    this.audio.unlock(); // los botones son gestos de usuario: momento válido para WebAudio
    this.audio.click();
    this.machine.transition('playing');
    this.input.requestPointerLock();
  }

  private restart(): void {
    // Recarga el mundo actual desde cero (monedas, misiones, spawn y timer).
    this.loadWorld(this.currentLevel.id);
    this.ui.setWinBest('');
    this.startPlaying();
  }

  /**
   * Simulación del mundo durante 'playing'. Física a paso fijo con acumulador +
   * interpolación visual del jugador, seguido de los sistemas de lógica/presentación.
   * Solo se ejecuta cuando el estado 'playing' está activo (lo llama la máquina).
   */
  private simulate(dt: number): void {
    if (this.checkPortals(dt)) return; // viajó a otro mundo: aborta el resto del frame

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
    this.ringFx.update(dt, this.cameraRig.camera);
    this.missions.update(this.player.visualPos);
    this.checkObbyProgress();

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
