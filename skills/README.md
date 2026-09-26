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
