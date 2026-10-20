# OLVIDO DE PAU AGENDA

Agenda personal y profesional de Pau con CRM ligero: citas, tareas, clientes, inmuebles, notas y biblioteca de enlaces y vídeos en una sola app web instalable (PWA) para móvil, tableta y ordenador.

> **Estado: fase 1 terminada y probada.** Los datos viven **solo en el navegador del aparato** donde se usa. No hay cuenta, ni servidor, ni sincronización entre aparatos, ni Google Calendar, ni IA: todo eso aparece en la app como *pendiente* y está planificado abajo.

## Cómo se abre

- **En local:** desde la raíz del repo, `npx serve .` (o cualquier servidor estático) y abrir `http://localhost:3000/agenda/app.html`. Necesita HTTP: usa módulos ES y service worker (con `file://` no funciona).
- **Publicada:** al desplegar el monorepo en Vercel queda en `https://<dominio-del-proyecto>/agenda/app.html` (no necesita variables ni funciones de servidor). Hasta que se despliegue la rama principal, no hay enlace público.
- **Instalar en el móvil:** abrir el enlace en Chrome (Android) → menú ⋮ → «Instalar aplicación». En iPhone: Safari → Compartir → «Añadir a pantalla de inicio».

## Arquitectura (fase 1)

| Pieza | Qué es |
|---|---|
| `app.html`, `styles.css` | Estructura y estilos. Móvil primero con menú inferior; barra lateral desde 960 px; letra mayor desde 2200 px (4K). Tema claro/oscuro. |
| `app.js` | Estado, rutas por `#ancla`, eventos delegados, aviso de cambios sin guardar, menú, conexión. |
| `p-*.js` | Una pantalla por archivo. Exportan `pantallas`, `acciones` (`data-accion`, `data-cambio`, `data-teclear`) y `formularios` (`<form data-form>`). |
| `datos.js` | Modelo, catálogos, limpieza (`LIMPIA`), validación (`valida`), consultas, papelera, guardado en `localStorage`, copia de seguridad. |
| `captura.js` | Frase en español → propuesta editable (fecha, hora, tipo, cliente e inmueble candidatos, dudas). Sin IA. |
| `busqueda.js` | Buscador global agrupado. |
| `exportar.js` | CSV (clientes, tareas, inmuebles), `.ics` con `Europe/Madrid`, importación de clientes por CSV. |
| `recordatorios.js` | Avisos dentro de la app y notificaciones del navegador mientras está abierta. |
| `ui.js`, `comun.js`, `utiles.js` | Campos con etiqueta, diálogos `<dialog>`, avisos, escapes, fechas. |
| `service-worker.js` | Modo sin conexión (red primero con 3 s de margen, luego caché). |

Sin dependencias ni empaquetador, igual que Cerebro y Nicer Estudia.

## Diseño

Tema **oscuro futurista por defecto** (azul noche, dorado del logo JP y destellos azul eléctrico); claro y «como el sistema» en Ajustes. Profundidad con CSS 3D, sin librerías:
- fondo con auroras y suelo de rejilla en perspectiva (`.escena`);
- tarjetas con borde de luz dorado-azul y relieve; con ratón se inclinan hacia el puntero con un reflejo que lo sigue (`efectos3d.js`, clase `.inclina`);
- panel Mi día con el logo JP flotando en 3D, destello sobre el oro y reflejo, y contadores en relieve;
- botones dorados metálicos y botón ＋ como esfera dorada en un menú inferior flotante;
- pantalla de arranque con el logo;
- en Android el panel se inclina un poco al girar el móvil;
- medidas en `rem`: en 4K (≥ 3000 px) todo crece en proporción;
- con «reducir movimiento» se apaga toda animación. El texto va siempre sobre fondo opaco.

## Mapa de pantallas

`#hoy` Mi día (personalizable en `#hoy/personalizar`) · `#agenda/dia|semana|mes|lista/<fecha>` · `#evento/<id>` · `#tareas/hoy|semana|vencidas|sinfecha|hechas|todas|tablero` · `#tarea/<id>` · `#clientes` (lista y tablero) · `#cliente/<id>` · `#inmuebles` · `#inmueble/<id>` · `#notas` · `#nota/<id>` · `#biblioteca` · `#recurso/<id>` · `#asistente/<consulta>` · `#ajustes` · `#papelera` · `#importar`. Los formularios son `<id>/editar` o `nuevo`. Botón **＋ Añadir** (captura rápida) y buscador con **Ctrl+K** o «/».

## Esquema de datos

Un objeto en `localStorage['olvido_pau_agenda_v1']`: `{ version, ajustes, clientes[], inmuebles[], eventos[], tareas[], notas[], recursos[] }`. Todos los registros llevan `id, creado, actualizado, borrado (papelera), demo`. Relaciones por id: `evento/tarea/nota/recurso.cliente|inmueble`, `cliente.inmuebles[]` (interesado), `inmueble.propietario`, `recurso.tarea|evento`. Los campos y sus topes están en `LIMPIA` (`datos.js`). El esquema relacional equivalente para la fase 2, con RLS, está en `esquema-fase2.sql` (**propuesta sin aplicar ni probar contra Supabase**).

## Qué funciona (fase 1)

- **Mi día:** saludo, próxima cita, agenda de hoy, 3 prioridades (autoguardado), tareas de hoy y vencidas, clientes a seguir, visitas próximas, notas y recursos recientes, acciones rápidas; bloques reordenables y ocultables.
- **Agenda:** día, semana, mes y próximos; 7 tipos de evento, día completo, varios días, ubicación (abre el mapa), cliente, inmueble, enlaces, color, recordatorios, estado de visita (realizada → se apunta en el historial del cliente, confirmándolo Pau), duplicar, `.ics` por cita.
- **Clientes:** ficha completa, búsqueda y filtros, etiquetas, lista y tablero por estados, historial de interacciones apuntado a mano, aviso de duplicados (teléfono, correo, nombre), llamar / WhatsApp / correo (abrir no es enviar), inmuebles vinculados y sugeridos con el motivo.
- **Inmuebles:** datos públicos y privados separados; «Copiar ficha para compartir» solo con los públicos; filtros por precio, zona, tipo, estado y característica; anuncios, vídeos, interesados, visitas pendientes y realizadas, posibles compradores; referencia única.
- **Tareas:** 7 vistas, prioridad, fecha y hora, subtareas, etiquetas, repetición (al completar se crea la siguiente), relaciones, enlaces.
- **Notas:** formato sencillo (listas, casillas, negrita, títulos, enlaces), autoguardado, fijar, etiquetas, relaciones, casillas → tareas con vista previa.
- **Biblioteca:** pegar y guardar, tipo detectado, duplicados (también el mismo vídeo con otra URL), carpetas, favoritos, estados, relaciones; YouTube/Vimeo incrustados **solo al pulsar** (YouTube por `youtube-nocookie`), el resto «Abrir el original».
- **Captura rápida:** «Llamar a Marta mañana a las 10 por el piso de Oviedo» → propuesta con la fecha escrita en palabras; con dudas de cliente o inmueble obliga a elegir.
- **Asistente:** la IA sale **pendiente**. Hay consultas calculadas en el aparato (resumen del día, clientes sin seguimiento, propuesta de tareas para mañana, plantilla para confirmar visita, inmuebles por presupuesto, nota → tareas), cada una con sus registros de origen y confirmación antes de crear.
- **Contactos del móvil (los de WhatsApp):** WhatsApp no deja leer sus contactos a ninguna app, pero son los de la agenda del teléfono. Se traen con el **selector de contactos** del navegador (Chrome en Android con la app en https: Pau marca cuáles) o con un **archivo .vcf** exportado de Contactos (Android o iPhone), leído en el aparato (`contactos.js`). Vista previa con duplicados (índices: miles al momento), entran como «Solo contacto» con la etiqueta `agenda-movil`, no cuentan para seguimientos, se ocultan de la lista normal salvo al buscarlos, y cada uno tiene su botón 💬 de WhatsApp (abre el chat, no envía nada).
- **Datos:** copia completa `.json` y restauración (enseña qué trae), CSV, `.ics`, importación de clientes CSV con columnas, vista previa, errores y duplicados; papelera de 30 días; borrar todo escribiendo BORRAR; datos de ejemplo marcados y removibles.
- **Uso:** PWA instalable, funciona sin conexión, aviso de «Sin conexión», aviso de cambios sin guardar, sincroniza entre pestañas del mismo navegador.

## Dónde se guardan los datos y sus límites

- `localStorage` del navegador: unos 5 MB por sitio (miles de registros caben; fotos no). La app pide almacenamiento persistente y avisa si se llena.
- Se pierden si se borran los datos del sitio, en incógnito o si se pierde el aparato **sin copia**. Por eso Ajustes recuerda la fecha de la última copia.
- Móvil y PC tienen **datos separados**. Para pasar de uno a otro: copia `.json` → restaurar.
- Nada sale del aparato salvo: enlaces que Pau abre, el mapa, WhatsApp o el correo que Pau abre, el vídeo que Pau decide reproducir y la miniatura pública de YouTube en la biblioteca.

## Avisos: tres canales distintos

1. **Dentro de la app:** franja a la hora del recordatorio. Sin permisos. Solo con la app abierta.
2. **Notificación del navegador:** con permiso. Con la app abierta o en segundo plano; sin servidor de *push*, una web no puede despertar al móvil cerrado.
3. **Calendario:** `.ics` por cita o de todo el calendario (avisa con la app cerrada). Con Google Calendar (fase 2), automático.

## Pruebas

- `node test/agenda.test.mjs` — lógica (fechas, validación, duplicados, captura, búsqueda, CSV, ICS, recordatorios, copia).
- `node test/agenda.ui.test.mjs` — Chromium real: criterios de aceptación de la fase 1, 360 y 1366 px, cada botón con acción registrada, etiquetas de los campos, sin conexión.
- Imágenes: `node agenda/herramientas/generar-imagenes.mjs` (Python + Pillow) saca de `logo-jp-original.webp` (el logo JP de Pau, 1672×941) los iconos con el monograma, `logo-jp.webp` para la app y `presentacion-4k.png` (3840×2160). La 4K es una **ampliación**: no tiene más detalle que el original; para una 4K nativa hace falta el logo a esa resolución o en vectorial.

## Fase 2 (pendiente): cuenta, Google Calendar, archivos

1. **Cuenta (Supabase Auth):** acceso con enlace mágico o «Iniciar sesión con Google». Escribir `jpaumoralejo@gmail.com` en un formulario **no** da acceso: hay que demostrar que se controla el correo. Desactivar el registro abierto y dar de alta solo a Pau.
2. **Base de datos:** `esquema-fase2.sql` (RLS por `owner_id = auth.uid()` en todas las tablas). Migración: un botón que sube la copia local a la cuenta, enseñando antes qué sube.
3. **Sin conexión con cuenta:** cola de cambios en IndexedDB; al volver la red se suben por orden; conflicto = gana el `actualizado` más reciente y se avisa del perdedor (se guarda en la papelera para recuperarlo).
4. **Google Calendar** (`api/_agenda-google.js` en el enrutador `api/[ruta].js`):
   - OAuth 2.0 *authorization code* en el servidor, `access_type=offline`, alcance mínimo `https://www.googleapis.com/auth/calendar.events` (+ `calendar.calendarlist.readonly` para elegir calendario). El *refresh token* se guarda cifrado en `agenda_google_conexiones` y **nunca** llega al navegador.
   - Elegir calendario; crear/editar/borrar (con confirmación) envía a Google y guarda `google_event_id` + `etag` para no duplicar.
   - Lectura incremental con `syncToken`; si Google responde 410, sincronización completa. Conflictos: si el evento cambió en los dos lados desde la última sincronización, gana el más reciente y se avisa a Pau con las dos versiones.
   - Fechas como hora de pared + `Europe/Madrid` (los cambios de hora no mueven citas).
   - Sin invitaciones automáticas: `sendUpdates=none` salvo que Pau marque «avisar a los invitados».
   - Panel de estado: conectado/desconectado, última sincronización, último error; «Desconectar» revoca el token en Google y borra la fila.
   - No hay sincronización instantánea: se sincroniza al abrir la app, al guardar y con un botón (las notificaciones *push* de Google exigen un dominio verificado; se valorará después).
5. **Archivos privados:** bucket `agenda-archivos` (privado, carpeta por usuario) con URL firmadas de corta duración; fotos de inmuebles y adjuntos de notas.

## Fase 3 (pendiente): asistente con IA

Función de servidor con `ANTHROPIC_API_KEY` (nunca en el navegador), interruptor `AGENDA_IA`. Solo recibe los registros que la consulta necesita (no toda la base de clientes), devuelve propuestas con los ids de origen, y cualquier cambio pasa por la vista previa y la confirmación que ya usan las consultas locales.

## Antes de usarla con datos reales de clientes

- Fase 1: los datos de clientes quedan en el navegador del aparato. Bloquea el móvil con código y no la uses en un ordenador compartido.
- No usar datos reales en demostraciones: para enseñar la app, «Probar con datos de ejemplo».
- Tener cuenta y servidor (fase 2) **no** convierte la app en conforme al RGPD por sí solo: hay que revisar con un profesional el registro de actividades, la base legal, la información a los clientes, los plazos de conservación y el encargo de tratamiento con los proveedores (Supabase, Vercel, Google).
