# 🎓 Curso Full Stack con IA — Asesoría Castresana

> Curso personal de Pau Moralejo, con Clara como profesora. **Plan aprobado por Pau** (diagnóstico de 15 preguntas completado). Ritmo real: **14 h/semana, tardes y fines de semana**. Duración: **18 semanas** — el calendario se adapta a la evidencia, no al revés.
>
> Matiz de Pau: profesor cercano, explicaciones fáciles, y todo lo que se construya debe ser **útil y aprovechable para Castresana desde el día 1**. La IA se usa como herramienta de aprendizaje, no como muleta.
>
> Para retomar en cualquier sesión: **"Clara, ¿por dónde íbamos del curso?"** — leer este archivo y el `docs/progress.md` del repo `curso-fullstack-castresana`.

---

## Mapa de competencias (del diagnóstico)

**Ya tiene (aprovechable):** entorno montado (macOS, VS Code, terminal, GitHub) · experiencia real con Firebase (Auth/Storage → suavizará Supabase) · ha llamado APIs de IA desde código · conoce su negocio y su flujo real de leads (WhatsApp, Instagram, TikTok, Inmoweb).

**A construir desde la base:** React y hooks (prioridad nº 1) · SQL y bases relacionales (solo conoce NoSQL) · TypeScript escrito por él · depuración metódica (hipótesis → evidencia, no "pruebo al azar").

**Se refuerza con práctica:** JavaScript (filter, map, funciones) · Git con ramas y PRs · consumo de APIs.

**Riesgos detectados y antídotos:**
1. Dependencia de la IA para resolver sin entender → cada sesión incluye un reto que Pau resuelve ANTES de ver la solución.
2. Abandono por frustración → sesiones cortas con resultado visible siempre.
3. Copiar código sin poder repararlo → la evidencia de verificación es obligatoria para avanzar.

**Regla de oro sobre la IA:** se pueden preguntar dudas de concepto ("¿qué hace filter?"), pero no pedir la solución entera. Esa diferencia es la diferencia entre aprender y copiar.

---

## Plan de 18 semanas (6 fases)

### Fase 1 — Fundamentos que faltan (semanas 1-3)
JavaScript/TypeScript real (funciones, arrays, tipos), Git con ramas y PRs, depuración metódica.
- **Entregable:** mini-app de consola en TS que filtra y ordena leads ficticios, con repo, ramas y commits correctos.
- **Criterio de cierre:** escribe la función de filtrado sin ayuda.

### Fase 2 — React y Next.js (semanas 4-6)
Componentes, useState, useEffect, formularios, Tailwind.
- **Entregable:** interfaz del CRM (lista de leads, filtros, formulario de alta) con datos en memoria, desplegada en Vercel por Pau.
- **Criterio de cierre:** añade un campo nuevo al formulario sin ayuda.

### Fase 3 — Base de datos y Supabase (semanas 7-9)
SQL desde cero, PostgreSQL, tablas relacionales, Supabase Auth y RLS.
- **Entregable:** el CRM con datos reales persistentes, login y permisos.
- **Criterio de cierre:** escribe un SELECT con JOIN y explica una política RLS.

### Fase 4 — CRM completo (semanas 10-12)
Inmuebles, clientes, tareas, estados, panel de métricas, primeros tests, README profesional.
- **Entregable:** **Proyecto 1** terminado y en uso real en Castresana. Hito de evaluación práctica.

### Fase 5 — Analizador documental con IA (semanas 13-15)
Subida segura de PDFs, extracción estructurada con validación Zod, revisión humana, control de costes.
- **Entregable:** **Proyecto 2** funcionando con documentos ficticios.

### Fase 6 — Asistente RAG + venta (semanas 16-18)
Embeddings, búsqueda semántica, citas, control de acceso. Además: landing, guion de demo de 3 minutos y propuesta comercial.
- **Entregable:** **Proyecto 3** + material de venta listo para el horizonte de 6-10 meses.

**Revisiones:** informe semanal cada domingo y evaluación práctica al cierre de cada fase. Si una fase necesita más tiempo, se estira sin culpa.

---

## Estado actual

- [x] Diagnóstico de 15 preguntas
- [x] Plan de 18 semanas aprobado por Pau
- [ ] **Sesión 1 (Fase 1) — EN CURSO**: crear repo `curso-fullstack-castresana` + primera función TypeScript tipada `filtrarPorPresupuesto` (filtrar leads por presupuesto mínimo). Verificación esperada: `npx tsx src/leads.ts` muestra solo María y Lucía. Commit sugerido: `feat: add lead filtering by minimum budget with typed Lead model`.
- [ ] Fase 1 completada
- [ ] Fase 2 completada
- [ ] Fase 3 completada
- [ ] Fase 4 completada (Proyecto 1: CRM en uso real)
- [ ] Fase 5 completada (Proyecto 2: Analizador documental)
- [ ] Fase 6 completada (Proyecto 3: RAG + venta)

**Próxima acción de la Sesión 1:** Pau ejecuta los comandos de arranque, escribe él la función (con pistas, sin solución), pega la salida de la terminal como evidencia, y registra la sesión en `docs/progress.md`.

*El progreso sesión a sesión vive en `curso-fullstack-castresana/docs/progress.md`; este archivo guarda el plan maestro y el estado por fases.*
