# Propuesta técnica: preparar Nicer RoboPro para escalar

Estado del código analizado: **2.281 LOC**, 27 módulos, MVP premium completo y
verificado. Varias capas de escalado **ya están sembradas** en sprints previos
(EventBus, StateMachine, LevelData, NetworkAdapter, Config centralizado). Esta
propuesta **completa y endurece** esas capas; no parte de cero.

---

## 0. Diagnóstico honesto

**Lo que ya escala bien:**
- `EventBus` tipado desacopla juego ↔ UI. Todo cruce va por eventos.
- `StateMachine` explícita (solo el estado activo simula).
- `LevelData` dirigido por datos (geometría/monedas/zonas/torre serializables).
- `NetworkAdapter` como seam de red; `PlayerSnapshot` plano.
- `Config` y `palette` centralizan tuning y color.
- Presentación desacoplada: `AvatarAnimator` separado del rig.

**Los 6 cuellos de botella reales para escalar:**
1. **`Game.ts` es un god object** (266 LOC): compone TODO, orquesta el bucle,
   cablea todos los eventos y guarda 13 sistemas. Cada sistema nuevo lo engorda.
2. **No hay capa de systems formal**: cada sistema tiene una firma de `update()`
   distinta llamada a mano en `Game.simulate()`. El orden es implícito.
3. **No hay simulación pura**: `PlayerController` mezcla matemática de Three,
   Rapier y avatar. Bloquea el servidor autoritativo.
4. **Input no es por comandos**: `InputFrame` no tiene número de secuencia →
   imposible predicción/reconciliación.
5. **No hay concepto de entidad**: el jugador está special-cased. Los jugadores
   remotos (Colyseus) necesitan una entidad instanciable (local o remota).
6. **`NetworkAdapter` es solo-snapshot**: falta canal de comandos, ciclo de vida
   de sala y buffer de interpolación para remotos.

---

## 1. Refactors necesarios (en orden de dependencia)

| # | Refactor | Desbloquea | Riesgo |
|---|----------|-----------|--------|
| R1 | Interfaz `System` + `SystemRegistry` + `GameContext` | capa de systems, adelgazar Game | bajo |
| R2 | Composition root: separar composición de orquestación | Game mantenible | bajo |
| R3 | Extraer simulación de movimiento pura a `sim/` (sin Three) | servidor autoritativo | medio |
| R4 | `InputCommand` con `seq` (numerar input) | predicción/reconciliación | bajo |
| R5 | Abstracción de entidad de jugador (local + remota) | avatares remotos | medio |

R1/R2 son **offline puro** y de bajo riesgo: hacerlos ya. R3/R4/R5 son
prerequisitos de Colyseus pero **mejoran el código offline igualmente**.

---

## 2. Capa de game state (completar la existente)

`StateMachine` ya existe. Falta:
- **Estados pesados como módulos propios.** Hoy los 4 estados son literales dentro
  de `Game`. El `RacingState` y `BuildState` del Sprint 2 deben ser su propio
  archivo implementando `GameState`, recibiendo un `GameContext` por constructor.
- **Overlay/stack de estados.** La pausa es un overlay sobre `playing`, no un
  estado que descarta la simulación. Evaluar una pila ligera (`push`/`pop`) para
  que "pausa" congele sin perder el estado de juego subyacente. Para el MVP el
  modelo plano basta; introducir la pila solo cuando llegue el primer overlay real.
- **Transiciones declaradas.** Documentar el grafo permitido (title→playing,
  playing↔paused, playing→won, won→playing) y rechazar transiciones inválidas.

---

## 3. Capa de systems (el refactor de mayor impacto)

Introducir un contrato uniforme y un registro con orden determinista:

```ts
// core/System.ts
export interface System {
  readonly id: string;
  fixedUpdate?(ctx: GameContext, dt: number): void; // paso físico (60 Hz)
  update?(ctx: GameContext, dt: number): void;       // presentación (por frame)
  reset?(): void;
}

// core/GameContext.ts — refs compartidas que los sistemas necesitan
export interface GameContext {
  readonly scene: THREE.Scene;
  readonly events: EventBus;
  readonly player: PlayerController;
  readonly input: InputFrame;
  readonly camera: THREE.Camera;
  readonly elapsed: number;
}
```

- `SystemRegistry` mantiene un array ordenado y expone `fixedUpdate(ctx, dt)` /
  `update(ctx, dt)` / `reset()`.
- `Game.simulate()` deja de llamar a cada sistema a mano: pasa a
  `this.registry.fixedUpdate(ctx, step)` + `this.registry.update(ctx, dt)`.
- Migrar `CoinSystem`, `MissionSystem`, `ParticleSystem`, `RingFx` a `System`.
  Añadir uno nuevo (build, minijuego, NPCs) = registrarlo, sin tocar el bucle.

**Beneficio:** `Game` pasa de orquestador manual a composition root que registra
sistemas. El orden de actualización se vuelve explícito y testeable.

---

## 4. Abstracción de networking (extender el seam existente)

`NetworkAdapter` hoy solo publica/recibe snapshots. Ampliarlo al contrato completo:

```ts
export interface NetworkAdapter {
  readonly connected: boolean;
  connect(roomId?: string): Promise<void>;
  disconnect(): void;

  // Cliente → servidor: intención, no estado.
  sendCommand(cmd: InputCommand): void;          // NUEVO

  // Servidor → cliente.
  onSnapshot(fn: (s: PlayerSnapshot) => void): () => void; // otros jugadores
  onReconcile(fn: (s: PlayerSnapshot, ackSeq: number) => void): () => void; // NUEVO: estado propio autoritativo
  onPlayerLeft(fn: (id: string) => void): () => void;
}

export interface InputCommand {   // NUEVO — InputFrame + seq + dt
  seq: number; moveX: number; moveZ: number; jump: boolean; run: boolean; dt: number;
}
```

- **`PlayerSnapshot` ya es plano** → mapea 1:1 a un `Schema` de Colyseus.
- Añadir un helper de **buffer de interpolación** para remotos (guardar los 2
  últimos snapshots y renderizar ~100 ms en el pasado). Reutiliza `PlayerAvatar`.
- Regla dura mantenida: ningún estado replicable contiene objetos Three/Rapier.

---

## 5. Estrategia para integrar Colyseus (ver también `docs/online-design.md`)

**Modelo:** servidor autoritativo; predicción local del propio jugador,
interpolación de los remotos. Pasos, cada uno entregable y verificable:

1. **Extraer `sim/` pura** (R3): la lógica de movimiento corre idéntica en cliente
   (predicción) y servidor (Node, sin Three). `Config` se comparte entre ambos.
2. **`InputCommand` con seq** (R4): el cliente aplica local Y envía; el servidor
   confirma hasta `ackSeq`; el cliente rebobina y re-aplica los pendientes.
3. **`ColyseusAdapter` + `LobbyRoom` mínima**: solo posiciones. El resto del
   código no cambia (habla con `NetworkAdapter`).
4. **Avatares remotos interpolados** (R5 + buffer): instanciar `PlayerAvatar` por
   jugador remoto, mover por snapshots con retardo de interpolación.
5. **Autoridad de monedas/misiones**: el servidor valida recogidas en su tick;
   `coin-collected` pasa a originarse en el snapshot del servidor. El `EventBus`
   no cambia, solo el origen del evento.
6. **Perfiles y login**: `Inventory.SaveData` es el embrión del perfil; pasa a
   caché local de un perfil remoto con escritura optimista.

Los pasos 1–2 son **refactor de cliente sin servidor**: se pueden hacer ya y
mejoran el offline.

---

## 6. Sprint 3 — "Escalabilidad" (lista priorizada)

Ortogonal al Sprint 2 (construcción + minijuego, que es producto). Este es
fundación. Prioridad por (impacto en escalado × desbloqueo) / riesgo:

**P0 — hacer primero (offline, bajo riesgo, alto desbloqueo):**
1. `System` + `SystemRegistry` + `GameContext` (R1). Migrar los 4 sistemas actuales.
2. Adelgazar `Game`: separar composición (world builder) de orquestación (R2).

**P1 — prerequisitos de online, mejoran el offline:**
3. Extraer `sim/` de movimiento pura desde `PlayerController` (R3).
4. `InputCommand` con `seq`; `InputManager` produce comandos numerados (R4).
5. Abstracción de entidad de jugador reutilizable local/remota (R5).

**P2 — spike de red (con fundación lista):**
6. Ampliar `NetworkAdapter` (comandos + reconcile + buffer interpolación).
7. `ColyseusAdapter` + `LobbyRoom` mínima con solo posiciones (spike, no producción).

**Fuera de alcance del Sprint 3:** validación de monedas en servidor, login,
persistencia de perfil (van a Sprint 4, ya esbozados en `online-design.md`).

### Recomendación de lead sobre secuenciación

Hacer **P0 y P1 antes que el Sprint 2 de gameplay** solo si el objetivo inmediato
es multijugador. Si el objetivo es producto jugable, el orden óptimo es:
**Sprint 2 (build + minijuego) → luego Sprint 3 P0/P1 → spike Colyseus.** Razón:
el Sprint 2 valida el fun y genera contenido; P0/P1 se benefician de tener más
sistemas reales (build, minijuego) para probar la capa de systems contra casos
variados, no solo contra los 4 actuales.
