# Vago Yo — datos, permisos y activación de la IA

Nada de lo que hay aquí es asesoramiento legal: es lo comprobado y lo que
queda por revisar. Fuentes al final, consultadas el 18/11/2026.

## 1. Qué sale del dispositivo

| Dato | Dónde está | Sale | Se guarda |
|---|---|---|---|
| Lo que escribe o dicta en el tutor | memoria del navegador | no | no |
| **Foto de un ejercicio** (solo si Pau activó «Leer fotos» y Nicer la hace) | se reduce en el móvil (≤ 1600 px, JPEG) | **sí**: a `/api/vagoyo` (Vercel) → API de Anthropic | la app no la guarda; Anthropic, ver §2 |
| Asignatura elegida (`mates`, `lengua`…) | va con la foto | sí, la misma ruta | no |
| Nombre, curso, colegio | **no se envían** a `/api/vagoyo` (lo vigila la prueba) | no | — |
| Audio del dictado | lo procesa el reconocimiento de voz **del navegador** (Chrome lo envía a Google) | sí, si usa el dictado | la app no lo guarda |
| Registro de progreso (habilidad, con/sin ayuda, fallo típico, fecha) | `localStorage` (`nicer-estudia:vagoyo`) | no | sí, en el móvil; «Borrar todo» lo borra |
| Ajustes de Pau (leer fotos sí/no, huella SHA-256 del PIN, fecha) | `localStorage` (`nicer-estudia:vagoyo-ajustes`) | no | sí, en el móvil |
| Resumen para Pau | se compone al pulsar | solo si alguien lo ve y pulsa «Mandar» | no |
| Enunciado que se pasa a Clara | lo escribe la app en la caja de Clara | solo si Nicer pulsa enviar en Clara (texto, **sin la foto**) | como cualquier mensaje a Clara |

`test/vago-yo.ui.test.mjs` comprueba que con «Leer fotos» apagado el tutor no
hace **ninguna** petición de red, y que con él encendido la única es a
`/api/vagoyo` y solo lleva `imagen` y `asignatura`.

## 2. Proveedor y conservación (comprobado)

| Para qué | Qué dato | Proveedor | Conservación |
|---|---|---|---|
| Copiar el enunciado de la foto (no lo resuelve) | la imagen reducida | API de Anthropic (Claude), llamada **desde el servidor**; la clave nunca está en el móvil | Anthropic borra entradas y salidas de la API en un plazo de **30 días**. Excepciones: contenido señalado por infringir su política de uso (más tiempo) y obligaciones legales. La API **no entrena** con estos datos por defecto. |

No prometemos un borrado más rápido que ese: no lo podemos comprobar.

## 3. Requisitos de Anthropic para productos con menores (comprobado)

Las cuentas de consumo de Claude (claude.ai) son solo para mayores de 18:
**Nicer no usa ninguna**; usa la app, que llama a la API. Para productos
con menores construidos sobre la API, Anthropic pide (artículo 9307344):

| Requisito | Cómo se cumple aquí |
|---|---|
| Medidas técnicas propias (control de acceso, moderación, supervisión, guía de uso) | La IA **solo transcribe**, con herramienta forzada (nunca texto libre); el servidor valida y recorta lo que devuelve; el móvil lo enseña escapado; activar exige el PIN de Pau; un solo usuario (su hijo), en su móvil; apagado de emergencia `VAGOYO_FOTOS=no`. |
| Cumplir la normativa de protección de datos de menores | España: RGPD + LOPDGDD (art. 7: por debajo de 14 años consiente el titular de la patria potestad). **Pau lo activa como padre** tras leer qué sale y adónde; queda la fecha en el móvil. |
| Decir que es una IA | En «Subir ejercicio», en la confirmación («leída por IA · puede equivocarse») y en el aviso del inicio. |

## 4. Lista de comprobación

- [x] Requisitos vigentes del proveedor para menores (§3).
- [x] Conservación y borrado reales del proveedor (§2).
- [x] Consentimiento del padre: activación con PIN, explicada antes (§3).
- [x] Datos mínimos: solo foto + asignatura; nombres visibles se tapan con [nombre].
- [x] El texto de la foto no da órdenes (regla del prompt + aviso en pantalla).
- [x] Sin publicidad ni rastreo.
- [ ] Protocolo de riesgo serio dentro del tutor: hoy el tutor no conversa
      (solo transcribe); las dudas libres van a Clara, que ya tiene el suyo
      (024 y 116 111) en `api/_profe.js`. Si el tutor llega a conversar con
      IA, hay que añadirlo antes.
- [ ] Cuentas y permisos en servidor (fase 2): no aplica mientras todo esté en
      un solo móvil sin cuentas.

## 5. Interruptores

- **Pau, en su panel:** «Activar (con PIN)» / «Apagar» (apagar no pide PIN).
- **Servidor:** variable `VAGOYO_FOTOS=no` en Vercel → `/api/vagoyo` responde
  503 y el móvil ofrece escribir el enunciado.
- Sin `ANTHROPIC_API_KEY` → 503 con el mismo mensaje.

Límite honesto: el PIN vive en el móvil de Nicer. Frena un toque sin querer,
no a alguien que borre los datos del navegador.

El tutor no cambia su código, sus instrucciones, sus permisos ni sus
proveedores, no instala nada, no contacta con el colegio y no publica nada
por su cuenta.

## 6. Activación

| Fecha | Quién | Qué |
|---|---|---|
| 18/11/2026 | Pau (lo pidió en la sesión de trabajo) | Lectura de fotos con IA publicada **apagada**; se enciende desde el Panel de Pau con su PIN. |

## Fuentes

- Anthropic, *Responsible Use of Anthropic's Models: Guidelines for Organizations Serving Minors* — support.claude.com/en/articles/9307344
- Anthropic, *Child safety guidance for developers* — support.claude.com/en/articles/15591275
- Anthropic, *How long do you store my organization's data?* — privacy.claude.com/en/articles/7996866
- Ley Orgánica 3/2018 (LOPDGDD), art. 7 — consentimiento de menores.
