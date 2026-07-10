# Memoria del proyecto — Nicer RoboPro

Contexto persistente para retomar el desarrollo. Actualizar este archivo al final
de cada sesión de trabajo importante.

## Qué es

Videojuego web 3D sandbox social retro-modernizado (nostalgia 2006 reinterpretada,
NO un clon de Roblox). MVP premium offline jugable en navegador. Vive en el
subdirectorio `nicer-robopro/` de este repo (la raíz contiene otra app, LimpiaFotos —
no tocarla).

## Estado actual (2026-07-10)

**Fases 0–3 del plan de ejecución COMPLETADAS y verificadas. Fase 4 diseñada.
Los 6 Bloques de la lista de tareas están CERRADOS** (incluida la limpieza de
código —hot paths sin allocations— y la documentación del sprint siguiente en
`docs/sprint-02.md`).

Rama de trabajo: `claude/nicer-robopro-mvp-el56jp`. Commits clave:
- `3de52e0` — Fases 0–1: MVP jugable (lobby, jugador, cámara, físicas, monedas, HUD, pausa, win)
- `738bb1d` — Fases 2–3: game feel (audio, partículas, squash & stretch, transiciones) +
  sistemas (misiones, inventario persistente, capa de red abstracta) + diseño online
- (último) — Limpieza: scratch vectors en CameraRig/PlayerController (cero allocations
  por frame en caminos calientes) + plan del Sprint 2

### Qué funciona (verificado en Chromium headless con Playwright)
- Pantalla de inicio → Jugar → pointer lock → lobby 3D con HUD
- Movimiento WASD relativo a cámara, salto (coyote time), correr con Shift
- 12 monedas con pickup por proximidad; win screen al recogerlas todas, con tiempo
- Misiones: recoger monedas / visitar 4 zonas / subir a la torre + toasts
- Pausa (Esc, con fallback sin pointer lock) con stats de inventario
- Inventario persistente en localStorage (`nicer-robopro:save-v1`): monedas totales,
  trofeos, mejor tiempo
- Sin errores de consola; build limpio (`npm run build` = tsc + vite)

## Arquitectura (decisiones clave — NO romper)

- **Física a timestep fijo 60 Hz** con acumulador + **interpolación visual** del jugador.
- **KinematicCharacterController de Rapier** (`@dimforge/rapier3d-compat`): autostep 0.7,
  snap-to-ground 0.4, gravedad manual, kill-plane y=-25 con respawn.
- **EventBus tipado** (`core/EventBus.ts` + eventos en `types/index.ts`): juego y UI no se
  conocen; TODO acoplamiento cruzado va por eventos. Pensado para sustituirse por red.
- **Máquina de estados explícita** (`core/StateMachine.ts`): solo el estado activo recibe
  `update(dt)`. 'playing' delega en `Game.simulate()`. Estados triviales son literales;
  los pesados del Sprint 2 (racing/build) deben ser su propio módulo que implemente `GameState`.
- **Mundos dirigidos por datos** (`world/LevelData.ts`): registro `WORLDS` de 6 mundos (hub,
  plaza/Parque, islas, obby, cielo, desafío) como `LevelDefinition` planas (spawn, plataformas,
  monedas, zonas, torre/checkpoints/finish/bouncePads opcionales, portales; `noGround`/`killY`/
  `centerPlaza`). El hub tiene 5 portales en arco (selector de mundos). `Game.loadWorld(id)` carga/descarga mundos EN CALIENTE: `Lobby.dispose()` quita
  colliders (`PhysicsWorld.removeCollider`) y libera geometrías; `CoinSystem`/`MissionSystem`
  se recrean por mundo (con `dispose()` para desuscribirse). El jugador y el `Inventory`
  persisten. Portales: arcos que brillan; `Game.checkPortals` viaja por proximidad (con
  cooldown al aparecer) y muestra aviso en el HUD. Hook de depuración: `window.roboproGame`.
- **Tuning centralizado** en `core/Config.ts`; **paleta única** en `assets/palette.ts`;
  materiales cacheados por color en `assets/materials.ts`.
- **Capa de red abstracta** en `net/NetworkAdapter.ts`: el juego ya publica
  `PlayerSnapshot` (JSON plano) a 10 Hz vía `LocalNetworkAdapter`. Colyseus deberá
  implementar la misma interfaz sin tocar el resto.
- Audio 100% sintetizado con WebAudio (sin assets); partículas con pool fijo sobre un
  único `THREE.Points`; anillos de recogida con pool fijo (`systems/RingFx.ts`).
- **Post-procesado** (`engine/Renderer.ts`): EffectComposer con bloom SELECTIVO (umbral 1.1
  en HDR lineal → solo florecen emisivos con intensidad >1: monedas 1.3, lámparas 2.5) +
  OutputPass (tone mapping ACES al final). Cielo con degradado (`world/Sky.ts`), niebla
  FogExp2 sutil, e IBL suave (`RoomEnvironment` vía PMREM, `environmentIntensity` 0.35).
  ¡OJO! subir emisivos <1 o bajar el umbral <1 relava toda la escena.
- El avatar mira hacia +Z local (la cara está en z positivo); heading = atan2(wish.x, wish.z).
- **Personalización de avatar** (`player/AvatarConfig.ts`): `AvatarConfig` plano (torso, legs,
  skin, hat) persistido en `localStorage` (`nicer-robopro:avatar-v1`). `PlayerAvatar` tiene
  materiales propios recoloreables + slot de gorro; `applyConfig()` aplica en caliente.
  Pantalla "Personalizar" en el título (swatches + gorros) con preview en vivo. Semilla del
  perfil online. PENDIENTE de pulido: encuadre de cámara para ver el avatar mientras se edita.
- **Obby con checkpoints** (mundo `obby`): parkour flotante (`noGround`, `killY`), checkpoints
  que actualizan la reaparición (`PlayerController.setRespawnPoint`) y meta (`finish`) que
  completa el mundo. Victoria unificada en `Game.completeWorld` (monedas o meta) con récord
  por mundo (`Inventory.recordBestTime/getBestTime`).
- **Economía + tienda**: `Inventory` guarda saldo gastable (`coins`), desbloqueos (`unlocked`)
  y mejores tiempos por mundo; `spend/canAfford/isUnlocked/unlock`. La pantalla "Personalizar"
  es también tienda (gorros, botas, arma) con candado/precio; `buildOptionRow` genérico,
  ids `hat.*`/`boots.*`/`weapon.*`. Evento `coins-changed` refresca el saldo.
- **Gear con efecto**: botas saltarinas (+salto) / veloces (+velocidad) → `PlayerController.applyGear`
  (multiplicadores `JUMP_MUL`/`SPEED_MUL`); espada (mano derecha, `swing()` con clic, `AvatarAnimator.triggerSwing`).
  7 gorros (incl. Cascos/Mago/Aureola). `PlayerAvatar` renderiza botas y espada en slots.
- **Pistolas de agua** (`weaponKind`='water', modelos en `WATER_GUNS`: pistola/chorro/super/mega):
  clic dispara gotas (`systems/WaterGun`, pool) hacia donde mira la cámara; impactar una moneda la
  recoge (`CoinSystem.tryHit`). Depósito de agua que se recarga (HUD barra, `UIManager.setWater`).
  Marcador de **puntos** en el HUD (10 pts/moneda). Game.fireWater orquesta disparo+cooldown+tanque.
- **Cargadores de agua**: `Inventory` guarda `cartridges`+`lifetimeCoins`; recarga al vaciar el
  depósito (auto-consume), compra a 75 monedas y uno gratis cada 100 monedas recogidas. HUD de munición.
- **Cabezas de animal + militar**: `AvatarConfig` gana `head` (normal/dragon/croc/lion/bear/dino),
  `hair` (militar/largo/punki) y `outfit` (militar). `PlayerAvatar` construye rasgos de animal
  (hocico, cuernos, melena, orejas) ocultando la cara humana; chaleco militar + recolor. Filas nuevas
  en el personalizador (scrollable). `buildOptionRow` genérico ahora cubre hat/head/hair/outfit/boots/weapon.
- **Monedas premium + regalos** (D): `CoinSystem` con `CoinDef` (color/valor/premium), disco+aro;
  gemas (`LevelData.gemCoins`) valen más puntos; `GiftSystem` (`LevelData.gifts`) da recompensa
  aleatoria (monedas/cargador/puntos). Puntos por moneda en el evento; `UIManager.addScore`.
- **Power-ups** (E): `PowerupSystem` (`LevelData.powerups`) — imán (`CoinSystem.update` con radio de
  atracción) y doble salto (`PlayerController.setDoubleJump`/`maxAirJumps`), temporales con HUD.
- **Combate** (F): `TargetSystem` (`LevelData.targets`) — enemigos slime que rompe la espada
  (`Game.trySwordAttack`) o el agua; +15 pts al romper.
- **Carreras + ranking** (G): mundo `carrera` + `LevelData.medalTimes` (oro/plata/bronce);
  `Game.completeWorld` da medalla; pantalla de victoria con medalla y ranking (`UIManager.setWinMedal`).
- **Rival Iyan** (H): `RivalRacer` (`LevelData.rivalPath`) — avatar rojo que corre la ruta al ritmo
  del tiempo de oro; HUD de progreso (`setRival`); la victoria dice si le ganaste. Compite en
  carrera/obby/desafío. TODOS los bloques del plan del usuario (A–H) están hechos.
- **Trampolines** (`bouncePads` en LevelData → `PlayerController.bounce`) y **motas ambientales**
  (`systems/AmbientMotes`, un `THREE.Points` que flota). **Preview en vivo** del avatar en el
  personalizador vía `CameraRig.setPortrait` (encuadre frontal).
- **Animación desacoplada**: `PlayerAvatar` = solo el rig (meshes + `parts`); `AvatarAnimator`
  = lógica de poses driven por `AvatarAnimState` (idle/walk/run/air). El estado de locomoción
  lo calcula `PlayerController.animState` UNA vez y alimenta animación y red por igual. Para
  mejorar animaciones (clips GLTF, blending, estados nuevos) se amplía/sustituye solo el
  animador. El squash & stretch lo dispara el propio controlador al detectar salto/aterrizaje;
  los hooks `onJump/onLand` quedan para el game feel externo (audio/partículas) que orquesta Game.
- Cámara: yaw 0 = detrás del jugador mirando a -Z (plaza en el origen); anticolisión por
  raycast de Rapier excluyendo el collider del jugador.

### Estructura
```
src/core (Game, Config, EventBus) · src/engine (Renderer, CameraRig)
src/physics (PhysicsWorld) · src/player (Input, Controller, Avatar)
src/world (Environment, Lobby) · src/systems (Coin, Mission, Inventory, Audio, Particle)
src/net (NetworkAdapter) · src/ui (UIManager, styles.css) · src/assets · src/types
docs/online-design.md (diseño Fase 4)
```

### Gotchas conocidos
- `CoinSystem.reset()` emite `coin-collected` con `collected: 0` — los consumidores deben
  ignorar ese caso (Inventory y el pulso del HUD ya lo hacen).
- El orden de suscripción al EventBus importa: Inventory se suscribe antes que los
  handlers de `wireGameFeel` para que récords/trofeos estén frescos al leerlos.
- (RESUELTO) El acoplamiento de coinSpots/zonas con la geometría se eliminó: ahora todo
  vive en `world/LevelData.ts`. Editar el nivel = editar esos datos.
- En headless/SwiftShader el juego va a pocos FPS y el clamp de dt (0.1 s) ralentiza el
  tiempo de juego — no es un bug; en GPU real va fluido.
- Verificación: script Playwright con chromium de `/opt/pw-browsers` (import
  `/opt/node22/lib/node_modules/playwright/index.mjs`), `npx vite preview` + capturas.
- No usar `pkill -f "vite preview"` desde la tool Bash (mata la propia shell).

## Próximos pasos

**El siguiente sprint está planificado en `docs/sprint-02.md`** (construcción de
bloques con preview fantasma, hotbar de piezas con economía de monedas y save v2,
minijuego contrarreloj con checkpoints; deuda técnica: code-splitting y táctil).
Empezar por ahí.

Después del Sprint 2:
1. **Migración online paso 1** (ver `docs/online-design.md`): extraer la simulación de
   movimiento de `PlayerController` a un módulo puro sin Three, compartible con servidor.
2. **Fase 4**: `ColyseusAdapter` + `LobbyRoom` mínimo con posiciones, avatares remotos
   interpolados reutilizando `PlayerAvatar`.

## Cómo trabajar

- Desarrollo: `cd nicer-robopro && npm install && npm run dev`
- Antes de commitear: `npm run build` (type-check + build) y verificación en navegador
- Commits y push SIEMPRE a la rama designada de la sesión
- Idioma del proyecto: español (código comentado en español, UI en español)
