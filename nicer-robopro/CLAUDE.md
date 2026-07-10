# Memoria del proyecto — Nicer RoboPro

Contexto persistente para retomar el desarrollo. Actualizar este archivo al final
de cada sesión de trabajo importante.

## Qué es

Videojuego web 3D sandbox social retro-modernizado (nostalgia 2006 reinterpretada,
NO un clon de Roblox). MVP premium offline jugable en navegador. Vive en el
subdirectorio `nicer-robopro/` de este repo (la raíz contiene otra app, LimpiaFotos —
no tocarla).

## Estado actual (2026-07-10)

**Fases 0–3 del plan de ejecución COMPLETADAS y verificadas. Fase 4 diseñada.**
Rama de trabajo: `claude/nicer-robopro-mvp-el56jp`. Commits clave:
- `3de52e0` — Fases 0–1: MVP jugable (lobby, jugador, cámara, físicas, monedas, HUD, pausa, win)
- `738bb1d` — Fases 2–3: game feel (audio, partículas, squash & stretch, transiciones) +
  sistemas (misiones, inventario persistente, capa de red abstracta) + diseño online

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
- **Tuning centralizado** en `core/Config.ts`; **paleta única** en `assets/palette.ts`;
  materiales cacheados por color en `assets/materials.ts`.
- **Capa de red abstracta** en `net/NetworkAdapter.ts`: el juego ya publica
  `PlayerSnapshot` (JSON plano) a 10 Hz vía `LocalNetworkAdapter`. Colyseus deberá
  implementar la misma interfaz sin tocar el resto.
- Audio 100% sintetizado con WebAudio (sin assets); partículas con pool fijo sobre un
  único `THREE.Points`.
- El avatar mira hacia +Z local (la cara está en z positivo); heading = atan2(wish.x, wish.z).
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
- Los coinSpots y las zonas de misiones están acoplados a la geometría de `Lobby.ts`
  (ZONES en MissionSystem debe coincidir con las 4 zonas del lobby; torre en (-20, 2) top y≈8.2).
- En headless/SwiftShader el juego va a pocos FPS y el clamp de dt (0.1 s) ralentiza el
  tiempo de juego — no es un bug; en GPU real va fluido.
- Verificación: script Playwright con chromium de `/opt/pw-browsers` (import
  `/opt/node22/lib/node_modules/playwright/index.mjs`), `npx vite preview` + capturas.
- No usar `pkill -f "vite preview"` desde la tool Bash (mata la propia shell).

## Próximos pasos (en orden sugerido)

1. **Fase 2 del roadmap original**: construcción básica de bloques, inventario de
   piezas, minijuego (p. ej. carrera de plataformas contrarreloj usando el timer ya
   existente).
2. **Migración online paso 1** (ver `docs/online-design.md`): extraer la simulación de
   movimiento de `PlayerController` a un módulo puro sin Three, compartible con servidor.
3. **Pendientes de pulido**: code-splitting del bundle (~890 KB gzip: Rapier WASM + Three,
   usar `manualChunks`), controles táctiles móviles (joystick virtual), más partículas
   ambientales (motas flotando en el lobby).
4. **Fase 4**: `ColyseusAdapter` + `LobbyRoom` mínimo con posiciones, avatares remotos
   interpolados reutilizando `PlayerAvatar`.

## Cómo trabajar

- Desarrollo: `cd nicer-robopro && npm install && npm run dev`
- Antes de commitear: `npm run build` (type-check + build) y verificación en navegador
- Commits y push SIEMPRE a la rama designada de la sesión
- Idioma del proyecto: español (código comentado en español, UI en español)
