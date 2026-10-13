# Skills de Clara en formato SKILL.md

Cada skill es una carpeta con un archivo `SKILL.md`. Clara las carga solas: aparecen en su catálogo (`usar_skill`) con el origen `SKILL.md`.

```
skills/
└── nombre-de-la-skill/
    └── SKILL.md
```

## Formato del SKILL.md

```markdown
---
name: nombre-de-la-skill
description: Una frase que diga CUÁNDO usarla (Clara la lee para decidir).
---

# Skill: título

## Cuándo usarla
…

## Método
…

## Entrega estándar
…

## Norma
…
```

Reglas:
- `name`: minúsculas, números y guiones (2-60 caracteres). Debe coincidir con la carpeta.
- `description`: obligatoria. Si falta la cabecera o el nombre no es válido, la skill se ignora.
- No se puede usar el nombre de una skill base del código (`ebook-lead-magnet`, `app-movil-profesional`, `web-3d-profesional`, `crear-skills`).

## Tres formas de dar una skill nueva a Clara

1. **Carpeta aquí** (permanente, va con el código): crea `skills/<nombre>/SKILL.md`, súbelo a GitHub y Vercel la publica.
2. **Desde el chat** (con la nube activa): pídele *"Clara, créate una skill para…"* y la guarda en Supabase con `crear_skill`.
3. **Desde un enlace**: pásale la dirección de un `SKILL.md` público; Clara lo lee con `leer_web`, lo adapta y lo guarda con `crear_skill`.

## Skills propias (SKILL.md) y skills oficiales de Anthropic

Conviven dos cosas distintas con el mismo nombre:

- **Las de esta carpeta** (y las que Clara crea con `crear_skill`) son **manuales de texto**: Clara los lee con `usar_skill` y los sigue al escribir su respuesta. No ejecutan nada y no gastan más que la respuesta normal.
- **Las Agent Skills oficiales de Anthropic** (`docx`, `xlsx`, `pptx`, `pdf`) **crean archivos de verdad** ejecutando código en un contenedor de Anthropic. Clara no las carga con `usar_skill`: cuando Pau pide algo en Word, Excel, PowerPoint o PDF, usa la herramienta `preparar_archivo` y el chat le enseña una tarjeta para crearlo y descargarlo (`lib/archivos.js` + `/api/clara-archivo`, detalle en `CLARA.md`). Son beta y cuestan uso de API.

Se combinan así: la skill propia decide **qué** se escribe (por ejemplo, `documento-oficina` o `presupuesto-servicios`, con sus normas de no inventar y de BORRADOR) y, si Pau quiere el archivo de oficina, Clara pasa ese contenido completo a `preparar_archivo`. Si la creación de archivos no está activa, se queda la opción rápida de siempre: el HTML A4 y el bloque ```csv.

## Skills incluidas

| Skill | Para qué |
|---|---|
| `ficha-portal-inmobiliario` | Ficha y anuncio para portales a partir de los datos reales del piso. |
| `fotos-inmueble` | Revisar y ordenar las fotos de un inmueble para los portales (formato, duplicadas, datos personales visibles). |
| `mensajes-clientes` | Mensajes de WhatsApp y correo a clientes en el tono de la oficina. |
| `documento-oficina` | Cartas, informes y autorizaciones como HTML A4 con la marca (lo legal sale como BORRADOR). |
| `hoja-calculo-excel` | Tablas en un bloque ```csv; en el chat aparece el botón «⬇ Descargar Excel (CSV)». |
| `acta-y-tareas` | De una reunión, llamada, nota de voz o hilo de mensajes a acta con tareas, responsables y fechas. |
| `plan-semanal` | Organizar el día o la semana con prioridades reales y bloques de tiempo. |
| `presupuesto-servicios` | Presupuesto u hoja de encargo; nunca inventa precios y el IVA lo calcula con `calcular`. |
| `cloudflare-proyectos` | Prompts listos para Claude Code con el CLI `cf`: «valora tu piso», reservas de visitas, links cortos, lista de espera, resumen diario y link temporal. Siempre con permiso de Pau y dentro de su plan de 5 USD/mes. |
| `mejora-continua` | Detecta tareas que se repiten y propone crear o mejorar una skill (con `crear_skill`) o guardar una preferencia (con `recordar`). No cambia el código de Clara. |
