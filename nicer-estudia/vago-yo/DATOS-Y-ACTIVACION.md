# Vago Yo — datos, permisos y activación del modo real

Este documento es la puerta de la fase 3. **El modo real (IA con el menor)
está bloqueado hasta que una persona lo revise y lo firme abajo.** Nada de lo
que hay aquí es asesoramiento legal: es la lista de lo que hay que comprobar.

## 1. Qué sale del dispositivo hoy (fase 1)

**Nada, salvo que alguien lo mande a mano.** El tutor funciona con `vagoyo.js` en el navegador:

| Dato | Dónde está | Sale | Se guarda |
|---|---|---|---|
| Lo que escribe o dicta en el tutor | memoria del navegador | no | no |
| Fotos | solo hay fotos de ejemplo dibujadas en el código | — | — |
| Audio | lo procesa el reconocimiento de voz **del navegador** (Chrome lo envía a Google para transcribir) | sí, si usa el dictado | no lo guarda la app |
| Registro de progreso (habilidad, con/sin ayuda, fallo típico, fecha) | `localStorage` del móvil | no | sí, en el móvil; se borra con «Borrar todo» |
| Resumen para Pau | se compone al pulsar | solo si alguien lo ve y pulsa «Mandar» (compartir / WhatsApp) | no |

Aviso honesto sobre el dictado: el `SpeechRecognition` de Chrome no es local.
Es el mismo que ya usa Clara en Nicer Estudia. Si se quiere evitar, basta con
escribir; la pantalla «Hablar» deja hacerlo siempre.

La prueba `test/vago-yo.ui.test.mjs` falla si el tutor hace cualquier
petición a `/api/`.

## 2. Qué saldría en la fase 3 (borrador para revisar)

| Para qué | Qué dato | Proveedor | Conservación | Borrado |
|---|---|---|---|---|
| Explicar y corregir con IA | el enunciado confirmado y sus pasos; nunca su nombre ni el colegio | API de Anthropic, **desde el servidor** (clave fuera del navegador) | [PENDIENTE: comprobar la política vigente de retención de la API] | [PENDIENTE] |
| Leer una foto o PDF | la imagen reducida en el móvil | API de Anthropic (visión) | ídem | ídem |
| Buscar en fuentes oficiales | **solo** una pregunta genérica («ecuaciones de primer grado 2.º ESO currículo Asturias»), sin nombre, centro, conversación ni documento | buscador configurado | [PENDIENTE] | [PENDIENTE] |

## 3. Antes de activar (lista de comprobación)

- [ ] Revisar los **requisitos vigentes del proveedor de IA para menores**
      (uso por menores a través de una app propia, verificación de edad,
      consentimiento parental). **No** usar una cuenta de consumo de Claude
      como interfaz del menor.
- [ ] Revisar la normativa aplicable (RGPD y LOPDGDD: en España, menores de
      14 años necesitan el consentimiento de los padres).
- [ ] Documentar retención y borrado reales de cada proveedor y no prometer
      un borrado que no se pueda comprobar.
- [ ] Protocolo revisado para mensajes de riesgo serio: no improvisar, no
      prometer secreto, no actuar como emergencias, recordar 024 y 116 111
      (el mismo criterio que ya tiene Clara en `api/_profe.js`) y no enviar
      el chat completo a nadie automáticamente.
- [ ] Permisos por usuario y recurso comprobados **en el servidor** (fase 2),
      con pruebas 3, 4 y 5 en verde.
- [ ] Sin publicidad ni rastreo.

## 4. Cómo está bloqueado

El código del tutor no tiene ninguna llamada de red ni interruptor para
encenderla. Activarlo exige un cambio de código revisado, probado y
versionado: el tutor no cambia su código, sus instrucciones, sus permisos ni
sus proveedores, no instala extensiones, no contacta con el colegio y no
publica nada por su cuenta.

## 5. Firma de la revisión

| Fecha | Quién revisa | Resultado |
|---|---|---|
| | | |
