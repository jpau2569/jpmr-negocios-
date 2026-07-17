# Castresana — Esquema de Firestore

Fuente de verdad de tipos: `src/types/models.ts` (+ `Lead`, `Property`,
`Message` en `src/types/index.ts`). Las fechas se guardan como **Timestamp**
y viajan por la app como **ISO string** (conversores en `lib/firebase/firestore.ts`).

## Colecciones

### `users` (id = uid de Auth)
| Campo | Tipo | Notas |
|---|---|---|
| uid | string | duplicado del id |
| email | string | |
| displayName | string | |
| agentId | string \| null | ref lógica → `agents` |
| role | `'admin' \| 'agente'` | |
| notificationPrefs | map | ver `NotificationPreferences` |
| createdAt | Timestamp | |

Subcolección **`users/{uid}/fcmTokens`** (id = token): `{ token, userAgent, updatedAt }`.
Un documento por dispositivo → revocación individual.

### `agents`
| Campo | Tipo | Notas |
|---|---|---|
| uid | string \| null | se rellena al activar la cuenta Auth |
| name, email, phone | string | |
| role | `'admin' \| 'agente'` | |
| active | boolean | baja lógica |
| createdAt | Timestamp | |

### `leads`
| Campo | Tipo | Notas |
|---|---|---|
| name, phone?, email? | string | |
| stage | `'nuevo'…'cerrado'` | embudo |
| intent | `'compra' \| 'alquiler' \| 'venta'` | |
| channel | `'whatsapp' \| 'email' \| 'portal' \| 'telefono' \| 'web'` | |
| zone | string | zona de interés |
| budgetMin?, budgetMax? | number | € |
| tags | string[] | |
| propertyId? | string | ref lógica → `properties` |
| agentId? | string | asignación (futuro) |
| unread | number | denormalizado para la lista |
| pinned? | boolean | |
| lastMessageAt, lastMessagePreview | Timestamp/string | denormalizados de la conversación |
| createdAt | Timestamp | |

### `conversations` + subcolección `messages`
Cabecera: `{ leadId, agentId, channel, subject?, lastMessageAt,
lastMessagePreview, unreadCount, createdAt }`.
**`conversations/{id}/messages`**: `{ leadId, direction: 'in'|'out', body, sentAt }`
— subcolección para paginar hilos largos; los mensajes son inmutables.

### `properties`
Todos los campos de `Property` (referencia, título, kind, zone, city, price,
habitaciones, baños, m², operation, status, tags, palette, photos, hasVideo,
featured, description, features, floor?, yearBuilt?, yieldPct?, publishedAt).
Los binarios NO van aquí: van a Storage (`properties/{id}/…`).

### `visits`
`{ leadId, propertyId, agentId, scheduledAt, status: 'propuesta'|'confirmada'|
'realizada'|'cancelada', notes?, feedback?, createdAt }`

### `tasks`
`{ agentId, leadId?, propertyId?, title, detail?, dueAt, done, createdAt }`

### `notifications`
`{ userId (uid destinatario), kind, title, body, link?, read, createdAt }`
Las crea el backend (Admin/Functions); el cliente solo lee y marca `read`.

### `matchSuggestions`
`{ leadId, propertyId, score 0-100, reason, status: 'nueva'|'enviada'|
'descartada', createdAt }` — las genera el motor (hoy regla, mañana IA);
el cliente solo lee y actualiza `status`.

### `analyticsDaily` (id = YYYY-MM-DD)
`{ date, newLeads, messagesIn, messagesOut, visitsScheduled, visitsDone,
offersActive, byStage }` — agregados que escribirá una Function programada.

## Relaciones (por id lógico, sin referencias duras)

```
users.agentId ──────► agents
leads.propertyId ───► properties        conversations.leadId ───► leads
visits.{leadId,propertyId,agentId}      tasks.{agentId,leadId?,propertyId?}
matchSuggestions.{leadId,propertyId}    notifications.userId ───► users(uid)
```

Denormalización deliberada: `leads.lastMessage*` y `conversations.unreadCount`
evitan N+1 en la bandeja. Se actualizan al escribir un mensaje (futuro:
Cloud Function `onMessageCreated`).

## Índices compuestos

Declarados en `firestore.indexes.json`:
leads(stage+lastMessageAt↓), leads(agentId+lastMessageAt↓),
properties(status+publishedAt↓), properties(city+price),
conversations(agentId+lastMessageAt↓), visits(agentId+scheduledAt),
visits(status+scheduledAt), tasks(agentId+done+dueAt),
notifications(userId+createdAt↓), matchSuggestions(leadId+score↓).

Despliegue: `firebase deploy --only firestore:rules,firestore:indexes`.

## Seguridad — qué endurecer después

Las reglas actuales (`firestore.rules`) asumen que **todo usuario autenticado
es empleado**. Antes de producción:

1. **Roles**: custom claims (`role`, `agentId`) en el token y validarlos en
   reglas, en vez de `isSignedIn()` para escribir.
2. **Validación de esquema** en `create/update` (tipos y campos obligatorios).
3. **Updates quirúrgicos**: limitar qué campos puede tocar el cliente
   (p. ej. en `leads` solo `stage`, `unread`, `pinned`, `tags`).
4. **Usuarios externos**: si entran propietarios/compradores, separar lo
   interno con `isEmployee()` y colecciones por audiencia.
5. **App Check** para cortar tráfico que no venga de la app.

## Storage (estructura convenida)

```
properties/{propertyId}/images/{file}   fotos
properties/{propertyId}/docs/{file}     dossier, nota simple, CEE
properties/{propertyId}/videos/{file}   tours, reels
leads/{leadId}/docs/{file}              documentación del lead
agents/{agentId}/avatar.jpg
```
Path builders en `lib/firebase/storage.ts`. Reglas de Storage: misma
filosofía (autenticado para leer; escrituras por rol) cuando se active.
