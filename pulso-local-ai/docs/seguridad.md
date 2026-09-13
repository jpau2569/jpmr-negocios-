# Decisiones de seguridad y cumplimiento

## Aislamiento entre negocios

Tres capas, y la de abajo es la que manda:

| Capa | Qué hace | Si falla |
| --- | --- | --- |
| Aplicación | `requerirSesionPanel()`, `requerirSuperadmin()`, comprobación de rol | Mensaje claro al usuario |
| **RLS** | Cada política exige `es_miembro(business_id)` | **Devuelve cero filas** |
| Privilegios | `anon` sin permisos sobre ninguna tabla | No hay consulta posible |

Las funciones de pertenencia (`es_miembro`, `rol_en_negocio`, `puede_escribir`,
`puede_administrar`) son `SECURITY DEFINER` con `search_path` fijado. Es
obligatorio: una política de `business_members` que consultara `business_members`
bajo RLS entraría en recursión infinita, y sin `search_path` fijo una función
definer es un vector de escalada de privilegios.

## Qué puede leer el público

`anon` tiene `USAGE` sobre el esquema y `SELECT` sobre ocho vistas. Nada más.

| Vista | Qué expone |
| --- | --- |
| `v_negocios_publicos` | Perfil del negocio |
| `v_inmuebles_publicos` | Inmuebles publicados, **sin `private_address`** |
| `v_media_publica`, `v_caracteristicas_publicas` | Fotos y características |
| `v_servicios_publicos`, `v_faqs_publicas` | Contenido publicado |
| `v_ajustes_publicos` | Textos y enlace de reseñas |
| `v_textos_legales_vigentes` | El texto de consentimiento vigente |

Todas filtran por `negocio_publicable()`. Lo que **nunca** sale: leads,
consentimientos, notas internas, visitas, opiniones, usuarios, analítica,
direcciones privadas ni nada sin publicar. Hay un test que recorre las vistas y
falla si alguna lee de una tabla prohibida.

## Escrituras públicas

`anon` no tiene `INSERT` en ninguna tabla. Todo formulario público pasa por
`manejarFormulario()`:

1. **Cupo por IP hasheada**, en la base de datos (`consumir_cupo`), no en memoria:
   en Vercel cada petición puede tocar una instancia distinta y un contador local
   se salta reintentando.
2. **Zod** en servidor. El navegador valida por cortesía; el servidor decide.
3. **Honeypot** (`companyWebsite`): si viene relleno se responde «ok» sin guardar
   nada. Devolver un error solo le diría al bot qué campo evitar.
4. **Negocio activo**: `negocioParaCaptacion()` verifica estado y `trial_ends_at`.
   Una demo vencida responde 410 y no guarda nada.
5. **Antiduplicados**: mismo teléfono, mismo tipo, diez minutos → no se duplica.
6. **Saneado**: se quitan etiquetas HTML y caracteres de control.

## Consentimiento (RGPD)

Cada lead guarda `consented_at` y `legal_text_version`, y además se crea una fila
en `consent_records` con la versión, el identificador del texto, la URL de origen
y **hashes con sal** de IP y user-agent.

Se guarda el hash y no la IP: basta para demostrar el consentimiento y para
limitar el abuso, y no crea un registro de visitantes. La sal (`SAL_CONSENTIMIENTO`)
vive solo en el servidor.

Los textos están versionados (`legal_text_versions.is_current`), así que si mañana
cambia el texto, los consentimientos antiguos siguen apuntando al que se aceptó.

> **Los textos legales incluidos son una plantilla técnica y deben ser revisados
> por un profesional legal antes de publicarse.** El aviso está en el propio
> texto, en el panel y en el seed.

## Analítica sin datos personales

- `session_id` es aleatorio y vive en `sessionStorage`: muere al cerrar la
  pestaña, no se comparte entre sitios y no identifica a nadie.
- `limpiarMetadata()` descarta cualquier clave que contenga nombre, teléfono,
  email, mensaje o comentario, y cualquier cadena de más de 80 caracteres.
- Los eventos de conversión (`*_submit`) solo los escribe el servidor.

## Reputación: lo que este producto no hace

- **No filtra** quién ve el enlace de Google según la nota. Se ofrece siempre.
- **No ofrece** regalos, descuentos ni sorteos a cambio de reseñas.
- **No redacta** reseñas ni las publica en nombre de nadie.
- **No esconde** las opiniones malas: las destaca para que alguien las atienda.

No es configurable a propósito: filtrar reseñas por puntuación incumple las
políticas de Google y, en España, puede ser una práctica desleal.

## El asistente

Solo responde con `ai_knowledge_entries` aprobadas y `faqs` publicadas. Antes de
buscar nada, `requiereProfesional()` intercepta cualquier pregunta sobre
impuestos, herencias, despidos, hipotecas, demandas o valoración concreta y
responde:

> «Para darte una respuesta precisa y adaptada a tu caso, el equipo de [negocio]
> debe revisarlo contigo. Puedes solicitar una cita o contactar por WhatsApp.»

Si no encuentra coincidencia suficiente, también deriva. Es mejor un «te
llamamos» que una respuesta aproximada sobre el dinero de alguien.

De las preguntas se guarda solo el texto (300 caracteres), si se resolvió y la
sesión anónima. Nunca datos de contacto.

## Comunicaciones: el MVP no envía nada solo

Ni WhatsApp, ni email, ni SMS, ni eventos de calendario. El CRM prepara el
borrador de WhatsApp y lo abre; envía una persona. Las campañas se guardan como
borradores. `visit_requests.calendar_event_id` existe pero está vacío.

Cualquier integración futura que envíe comunicaciones exigirá consentimiento del
destinatario **y** confirmación explícita del administrador.

## Otras medidas

- **Cabeceras**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy` (cámara y micrófono bloqueados).
- **`next/image`** solo acepta dominios declarados: no es un proxy abierto.
- **Login**: mensaje genérico en el error, para no revelar qué correos existen.
- **Storage**: bucket público de lectura, escritura solo para miembros y con la
  primera carpeta de la ruta forzada al `business_id`.
- **Superadministrador**: `REVOKE UPDATE (is_superadmin)` a `authenticated`.
  Solo se concede desde SQL o con service role.
- **Direcciones**: la dirección exacta de una vivienda es interna salvo que el
  administrador active explícitamente mostrarla, y el formulario lo advierte:
  publicar el portal de una vivienda habitada es un riesgo para quien vive dentro.

## Lo que estos tests NO cubren

`test/seguridad.test.mjs` lee el SQL y el código: detecta tablas sin RLS,
columnas privadas coladas en vistas y `import`s indebidos. **No ejecuta las
políticas.** Para eso está `docs/pruebas-rls.md`, que hay que pasar contra una
base de datos real antes de poner esto en producción con datos de clientes.
