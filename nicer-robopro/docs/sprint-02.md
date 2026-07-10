# Sprint 2 — Construcción, inventario de piezas y minijuego

Planificación del siguiente sprint (Fase 2 del roadmap general). El sprint 1
cerró el MVP completo (Bloques 1–6 del plan de tareas). Objetivo de este sprint:
convertir el lobby en un sandbox con algo que *hacer* además de coleccionar.

## Objetivo del sprint

Que el jugador pueda **colocar y quitar bloques** en el lobby, gestionar una
**barra de piezas**, y jugar un **minijuego de plataformas contrarreloj** con
su propio flujo de inicio/fin y récord.

## Tareas

### 1. Sistema de construcción básica
- [ ] `BuildSystem` en `src/systems/`: colocar/quitar bloques de 1×1×1 alineados a rejilla
- [ ] Previsualización fantasma (mesh translúcido) siguiendo un raycast desde la cámara
- [ ] Clic izquierdo coloca, clic derecho (o tecla X) quita; límite de alcance ~6 m
- [ ] Cada bloque colocado registra collider estático en Rapier y se elimina con él
- [ ] Los bloques NO se colocan dentro del jugador ni de otros colliders

**Criterio de aceptación:** puedo construir una escalera de bloques, subirme a
ella, quitar un bloque y ver desaparecer su colisión. Sin errores de consola.

**Notas técnicas:** reutilizar `matte()` para materiales; un `InstancedMesh` por
color si pasamos de ~100 bloques; empezar con meshes individuales y medir.

### 2. Inventario de piezas (extensión del Inventory actual)
- [ ] Barra inferior (hotbar) con 3–4 tipos de bloque y contador de unidades
- [ ] Teclas 1–4 seleccionan pieza; la rueda del ratón NO cambia (reservada al zoom)
- [ ] Las monedas recogidas dan piezas (ej. 1 moneda = 2 bloques) — economía mínima
- [ ] Persistir piezas restantes en el save existente (`nicer-robopro:save-v1` → v2 con migración)

**Criterio de aceptación:** el contador baja al construir, sube al recoger
monedas, y sobrevive a recargar la página.

### 3. Minijuego: contrarreloj de plataformas
- [ ] Zona de inicio marcada en el lobby (arco o portal en una esquina)
- [ ] Al entrar: countdown 3-2-1, cronómetro dedicado, checkpoints (3–4 anillos)
- [ ] Meta al final del recorrido de la torre teal; al llegar: tiempo final + récord persistido
- [ ] Abandonar la zona o pulsar Esc cancela la carrera y limpia el estado
- [ ] Nuevo estado de juego `'racing'` en la máquina de estados (o sub-estado de `playing`)

**Criterio de aceptación:** puedo correr la carrera dos veces; el récord se
guarda y se muestra; cancelar a mitad no deja HUD ni estado sucio.

### 4. Deuda técnica (si sobra tiempo)
- [ ] Code-splitting: `manualChunks` para separar three/rapier del código del juego
      (bundle actual ~890 KB gzip)
- [ ] Controles táctiles: joystick virtual + botón de salto (media consulta `pointer: coarse`)

## Fuera de alcance de este sprint

- Multijugador (es el sprint 3; ver `docs/online-design.md`)
- Editor de mapas completo, guardado de construcciones en servidor
- Más de un minijuego

## Riesgos conocidos

- El raycast de construcción debe excluir al jugador y al bloque fantasma
  (usar el patrón de `excludeCollider` ya presente en `CameraRig`).
- El minijuego toca la máquina de estados: mantener los eventos en
  `types/GameEvents` y no acoplar UI ↔ juego directamente.
- Migración del save: versionar la clave o migrar campos con defaults (patrón
  ya usado en `Inventory.load()`).
