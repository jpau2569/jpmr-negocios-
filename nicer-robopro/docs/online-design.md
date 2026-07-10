# Diseño de integración online (Fase 4)

Documento de arquitectura para el multijugador con Colyseus. Nada de esto se
implementa todavía; define los contratos para que el código actual ya encaje.

## Principios

1. **Servidor autoritativo.** El cliente envía *intenciones* (input), el servidor
   simula y publica el estado. El cliente nunca es fuente de verdad de posición.
2. **El juego solo conoce `NetworkAdapter`** (`src/net/NetworkAdapter.ts`).
   Colyseus quedará encapsulado en un `ColyseusAdapter` que implementa esa
   interfaz; el resto del código no importa la librería.
3. **Estado plano y serializable.** `PlayerSnapshot` ya es JSON plano y mapea
   1:1 a un `Schema` de Colyseus.

## Modelo de room autoritativa

```
LobbyRoom (Colyseus Room)
├── state: LobbyState (Schema)
│   ├── players: MapSchema<PlayerState>   // id → {x,y,z,heading,anim,coins}
│   ├── coins: ArraySchema<CoinState>     // {id, collected}
│   └── phase: 'open'
├── onJoin/onLeave: alta/baja en players
├── onMessage('input', InputFrame)        // el cliente envía input, no posición
└── simulate(dt) a tick fijo (20 Hz)      // misma lógica que PlayerController
```

- La simulación del servidor reutiliza la lógica de movimiento actual: por eso
  `PlayerController` mantiene el paso físico determinista a timestep fijo y el
  tuning centralizado en `Config.ts` (compartible entre cliente y servidor).
- Las monedas se validan en servidor (distancia jugador-moneda en el tick) para
  evitar clientes tramposos; el evento `coin-collected` pasa a originarse en
  el snapshot del servidor.

## Input local vs input sincronizado

- **Hoy:** `InputManager → PlayerController.fixedUpdate` (aplicación directa).
- **Online:** el mismo `InputFrame` se aplica localmente (predicción) **y** se
  envía numerado al servidor. Al recibir el estado autoritativo, el cliente
  reconcilia: rebobina al último estado confirmado y re-aplica los inputs
  pendientes. `InputFrame` ya es un objeto plano numerable, listo para esto.
- Los avatares remotos no se predicen: se interpolan entre los dos últimos
  snapshots (~100 ms de retardo de interpolación).

## Estado serializable

- `PlayerSnapshot` (ya definido) para avatares.
- El progreso del jugador (`Inventory.SaveData`) es el embrión del perfil:
  mismo shape en localStorage hoy y en la base de datos del backend mañana.
- Regla: ningún estado replicable contiene objetos de Three.js/Rapier; solo
  primitivos. Los sistemas actuales ya cumplen esto.

## Flujo de login y perfiles

1. Pantalla de inicio pide/recuerda un nick (anónimo con token local primero).
2. `POST /auth/guest` → JWT efímero; upgrade posterior a cuenta persistente.
3. El JWT se pasa en `client.joinOrCreate('lobby', { token })`.
4. El servidor carga el perfil (monedas totales, trofeos, mejor tiempo) y lo
   incluye en el estado inicial del jugador.
5. `Inventory` pasa a ser una caché local del perfil remoto con escritura
   optimista y reconciliación al reconectar.

## Plan de migración por pasos

1. Extraer la simulación de movimiento a un módulo puro (sin Three) compartido.
2. Implementar `ColyseusAdapter` contra un `LobbyRoom` mínimo (solo posiciones).
3. Renderizar avatares remotos con interpolación (reutilizando `PlayerAvatar`).
4. Migrar monedas y misiones a validación en servidor.
5. Login invitado + persistencia de perfil en backend.
