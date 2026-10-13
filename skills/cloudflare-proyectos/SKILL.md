---
name: cloudflare-proyectos
description: Preparar proyectos en Cloudflare para Pau (formulario «valora tu piso», reservas de visitas, links cortos con clics, lista de espera, resumen diario, link temporal para enseñar una demo) con el prompt exacto para Claude Code y el CLI cf, siempre con su permiso y dentro de su plan de 5 USD/mes.
---

# Skill: proyectos en Cloudflare

Basada en la guía «Crea tu web, formularios y bots con Cloudflare» de Santi Muñoz (@SantiMunozIA, 8 oct 2026), adaptada a Asesoría Castresana. Es una guía independiente, no oficial de Cloudflare: lo que dice de precios y límites se comprueba en la documentación oficial antes de dar una cifra.

## Cuándo usarla
- Pau quiere publicar algo en internet sin servidor propio: una página, un formulario, reservas, links cortos, una lista de espera o un bot.
- Pau pregunta «¿esto lo puedo hacer con Cloudflare?» o «prepárame el prompt para Cloudflare».

## Regla de oro (permanente, la puso Pau)
1. **Permiso para cada uso.** Antes de cualquier paso en Cloudflare, dile qué se va a hacer y espera su «sí».
2. **Solo lo incluido en su plan de 5 USD/mes.** Nada de compras, cambios de plan, dominios de pago ni nada que genere cargos extra. Si algo pudiera salirse de lo incluido, o no estás segura, para y avísale.
3. **Nunca claves en el chat.** El acceso se aprueba en el navegador (`cf auth login`) y las claves van como secretos (`cf` / Vercel), nunca en el código ni en un mensaje.
4. **Antes de aprobar un comando:** si lleva `delete` o `--force`, explica qué borra; pide primero un ensayo con `--dry-run`.

## Qué puedes hacer tú y qué no
- **Tú (Clara en el chat) no tienes conexión con Cloudflare.** No digas nunca que has publicado, creado o borrado algo allí.
- Lo que sí haces: elegir el proyecto, rellenar el prompt con los datos reales de Pau (sin inventar ninguno: lo que falte va como [PENDIENTE: …]) y entregárselo listo para pegar en **Claude Code** (abierto en su repositorio `jpmr-negocios-`; la primera vez hay que instalar el CLI `cf`, ver «Puesta en marcha»).
- `cf` es el CLI oficial de Cloudflare para agentes (paquete npm `cf`, en **beta**: los comandos pueden cambiar). Necesita Node.js 22.18 o superior.

## Puesta en marcha (una sola vez, en Claude Code)
Prompt para pegar:
> Quiero usar Cloudflare desde aquí. Explícame cada paso en palabras simples.
> 1. Revisa si tengo Node.js 22.18 o superior.
> 2. Instala el CLI de Cloudflare con `npm install --global cf`.
> 3. Corre `cf auth login` y avísame para aprobar el acceso en el navegador; después confirma con `cf auth whoami`.
> Regla: pídeme permiso antes de cada uso de Cloudflare y usa solo lo incluido en mi plan de 5 USD/mes; nada que cueste más, ni compras, ni cambios de plan. Antes de borrar algo, dime qué y haz un --dry-run.

## Proyectos adaptados a la inmobiliaria
Cada uno termina con la misma línea de seguridad: «Usa el CLI de Cloudflare (cf). Explícame cada paso en palabras simples y pídeme permiso antes de cada uso; solo lo incluido en mi plan de 5 USD/mes».

1. **«Valora tu piso» (captación).** Formulario: nombre, teléfono, dirección aproximada, tipo, m², habitaciones y comentario. Se guarda en una base de datos D1, con página privada con contraseña para verlos del más nuevo al más viejo, aviso por Telegram de cada uno y Turnstile contra bots. **No da precio automático** (la valoración la hace Pau).
2. **Reservas de visitas sin choques.** Elegir inmueble (por referencia), día y hora libre en bloques de [30 min] y en el horario de [PENDIENTE]. No deja reservar dos visitas a la misma hora. Página privada para ver y cancelar.
3. **Links cortos con clics.** Para anuncios y redes (por ejemplo `/pis0190` → la ficha en asesoriacastresana.com), con una página privada que cuenta clics por día. Usa KV y D1.
4. **Lista de espera de una promoción u obra nueva.** Cuenta regresiva hasta [fecha], sin correos repetidos, «Ya somos X en la lista», descarga en CSV y Turnstile.
5. **Resumen cada mañana.** Una tarea programada (Cron, en hora UTC: las 8:00 de Madrid son las 6:00 o las 7:00 UTC según el horario de verano) que lee los formularios del día anterior y manda el resumen por Telegram.
6. **Link temporal para enseñar una demo.** Quick Tunnel (`cloudflared tunnel --url http://localhost:[puerto]`) para que un cliente vea algo desde el móvil sin publicarlo. Sin cuenta ni dominio, solo para pruebas, y se apaga al cerrar el comando.
7. **Chatbot de preguntas frecuentes** con Workers AI, que responde SOLO con la información que dé Pau y, si no sabe, manda al WhatsApp del despacho. Avisa a Pau de que Clara y Oportunidades ya cubren parte de esto, para no duplicar.

## Límites y precios
- No los des de memoria. La guía cita los límites del plan gratis verificados el 8 oct 2026 (por ejemplo, 100.000 peticiones al día en Workers y 10.000 «neuronas» al día en Workers AI), pero Pau tiene el plan de pago, cuyos límites son otros: pide que se consulten en developers.cloudflare.com/workers/platform/pricing antes de afirmar nada.
- R2 (archivos) hay que activarlo en el panel y puede pedir un método de pago. No lo actives sin el permiso expreso de Pau.
- El correo a cualquier destinatario necesita dominio en Cloudflare: es un gasto aparte, así que no lo propongas como incluido.

## Entrega estándar
1. Qué proyecto recomiendas y por qué, en dos líneas.
2. El prompt completo, listo para pegar en Claude Code, con los datos de Pau y los [PENDIENTE: …].
3. Qué tiene que tener Pau a mano (cuenta, Telegram, fotos, horarios…).
4. Lo que podría costar fuera del plan, si hay algo, o «nada fuera del plan, según la documentación que hay que comprobar».
5. Un siguiente paso concreto.

## Norma
Nada inventado: ni datos del negocio, ni precios de Cloudflare, ni resultados. Si cf da un error, se copia tal cual y se pregunta.
