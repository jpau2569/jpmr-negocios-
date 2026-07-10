# Nicer RoboPro — MVP (Fase 1)

Videojuego web 3D sandbox social retro-modernizado: la simplicidad visual de los juegos
de bloques de 2006, reinterpretada con dirección artística, físicas y sensación de
control modernas.

## Jugar en local

```bash
npm install
npm run dev      # desarrollo en http://localhost:5173
npm run build    # type-check + build de producción en dist/
npm run preview  # sirve el build de producción
```

## Controles

| Tecla | Acción |
|---|---|
| `WASD` | Mover |
| `Ratón` | Cámara (pointer lock) |
| `Rueda` | Zoom |
| `Espacio` | Saltar |
| `Shift` | Correr |
| `Esc` | Pausa |

**Meta:** recoger las 12 monedas repartidas por el lobby. El HUD muestra el progreso
y el tiempo; al completarlo aparece la pantalla de victoria con tu tiempo.

## Stack

TypeScript · Three.js · Rapier 3D (`@dimforge/rapier3d-compat`) · Vite · HTML/CSS para UI.

## Arquitectura

```
src/
  core/      Game (orquestador + bucle), Config (tuning), EventBus (juego ↔ UI)
  engine/    Renderer (WebGL, sombras, tone mapping), CameraRig (3ª persona + anticolisión)
  physics/   PhysicsWorld (envoltorio de Rapier, colliders estáticos)
  player/    InputManager, PlayerController (character controller cinemático), PlayerAvatar
  world/     Environment (luz, niebla, cielo), Lobby (geometría + colliders + coinSpots)
  systems/   CoinSystem (pickups, animación, condición de victoria)
  ui/        UIManager (pantallas + HUD), styles.css
  assets/    palette (colores centrales), materials (materiales cacheados)
  types/     Tipos compartidos (estados, eventos, input)
```

Decisiones clave:

- **Física a timestep fijo (60 Hz)** con acumulador e **interpolación visual** del
  jugador: colisiones estables y render fluido a cualquier framerate.
- **Movimiento relativo a cámara** con aceleración/deceleración, control reducido en el
  aire, *coyote time* para el salto y autostep/snap-to-ground de Rapier.
- **EventBus tipado**: los sistemas de juego y la UI no se conocen entre sí; solo
  intercambian eventos declarados en `types/`. Esto deja el terreno preparado para
  sustituir eventos locales por mensajes de red (Colyseus) en la Fase 3.
- **Materiales cacheados por color** y geometría de primitivas: pocos draw calls,
  estética low-poly coherente definida en una única paleta.

## Roadmap

- **Fase 1 (este MVP):** lobby offline jugable ✔
- **Fase 2:** construcción básica, inventario simple, minijuego
- **Fase 3:** multijugador con Colyseus, perfiles, salas
- **Fase 4:** editor de mapas y expansión social
