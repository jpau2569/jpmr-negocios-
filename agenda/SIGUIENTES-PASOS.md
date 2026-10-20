# OLVIDO DE PAU AGENDA — dónde lo dejamos y qué falta

Actualizado: 20/10/2026.

## Estado actual

- **Publicada y funcionando:** https://jpmr-negocios.vercel.app/agenda/app.html
  - PR [jpau2569/jpmr-negocios-#56](https://github.com/jpau2569/jpmr-negocios-/pull/56), fusionada en `main`. Vercel desplegó producción sin errores.
- **Fase 1 hecha:**
  - Mi día, agenda (día, semana, mes y lista), clientes, inmuebles, tareas, notas y biblioteca.
  - Captura rápida, buscador, copias de seguridad, CSV e `.ics`, papelera.
  - Logo JP dorado y diseño 3D futurista.
  - Contactos del móvil (`.vcf` o selector de Chrome en Android).
  - Tu WhatsApp (672 77 57 21) en la firma de los mensajes.
- **Tus datos se guardan solo en cada aparato.** El móvil y el MacBook no se sincronizan. Para pasar los datos de uno a otro: Ajustes → «Guardar copia completa» → en el otro aparato, «Restaurar una copia».

## Pendiente 1 — Tu dominio `agenda.jpaumoralejo.es` (lo haces tú, ~5 min)

La redirección ya está publicada en `vercel.json`. Faltan dos pasos que solo puedes hacer tú: Vercel no me dejó añadir el dominio (error 403 de permisos).

### Paso A — Vercel
1. Entra en https://vercel.com con tu cuenta.
2. Abre el proyecto **`jpmr-negocios-`** (el que **acaba en guion**, del equipo *pau-ia-projectos*).
   - No uses el proyecto `jpmr-negocios` (sin guion, de otra cuenta): ese no sirve `jpmr-negocios.vercel.app`.
3. **Settings → Domains** → escribe `agenda.jpaumoralejo.es` → **Add**.
4. Si te ofrece redirigir a `www` o algo parecido, elige **no**: solo `agenda.jpaumoralejo.es`.

### Paso B — Hostinger (gestiona el DNS de jpaumoralejo.es)
1. Entra en https://hpanel.hostinger.com.
   - Si no te deja entrar: usa «¿Has olvidado tu contraseña?» con tu correo. Si tienes la verificación en dos pasos activada, ten a mano el móvil.
2. **Dominios** → `jpaumoralejo.es` → **DNS / Nameservers** → **Gestionar registros DNS**.
3. Añade un registro nuevo:

   | Tipo  | Nombre | Apunta a              | TTL           |
   |-------|--------|-----------------------|---------------|
   | CNAME | agenda | cname.vercel-dns.com  | el de defecto |

4. Guarda. **No toques** los registros que ya existen: son los de tu web actual de jpaumoralejo.es.

### Paso C — Comprobar
- En Vercel → Domains, `agenda.jpaumoralejo.es` debe pasar a **Valid Configuration**. Suele tardar unos minutos y a veces hasta 1 hora. El https lo pone Vercel solo.
- Abre https://agenda.jpaumoralejo.es: tiene que abrirse la agenda.
- Si a las 24 h sigue en rojo, mira que el nombre sea solo `agenda`, sin `.jpaumoralejo.es` detrás. Hostinger lo añade solo.

## Pendiente 2 — Probar en tu móvil
1. Abre la agenda en Chrome → menú ⋮ → **Instalar aplicación**.
2. Ajustes → **Importar contactos del móvil o CSV**:
   - **Android:** «📇 Elegir contactos del móvil», o Contactos → Exportar → `.vcf`.
   - **iPhone:** Contactos → Listas → «Todos los contactos» → Exportar.
3. Apunta cuántos contactos entran y si alguno sale mal (nombre cortado, teléfono raro…).
4. Prueba el botón **＋** con 3 frases tuyas y apunta cuál interpreta mal.

## Pendiente 3 — Desde el MacBook
- Abre el mismo enlace en Chrome o Safari. Se puede instalar: Chrome → icono de instalar en la barra de direcciones; Safari → Archivo → «Añadir al Dock».
- Los datos del Mac empiezan vacíos. Para tener lo del móvil, haz una copia en el móvil y restáurala en el Mac.

## Lo que viene después (cuando quieras)
- **Fase 2 — cuenta y sincronización:** acceso que exige demostrar que controlas `jpaumoralejo@gmail.com`, datos en Supabase con RLS y el móvil y el Mac sincronizados. El plan está en `agenda/README.md` y el esquema propuesto (sin aplicar) en `agenda/esquema-fase2.sql`.
- **Fase 2 — Google Calendar de verdad:** necesita un proyecto en Google Cloud con la API de Calendar y su pantalla de consentimiento. Te guiaré paso a paso.
- **Fase 3 — Asistente con IA:** necesita la clave de Anthropic en Vercel.
- **Logo en 4K nítido:** si tienes el logo JP en más resolución o en vectorial, pásamelo. La imagen 4K actual es una ampliación.

## Para retomarlo con Claude
Escribe: «Sigo con la agenda: lee `agenda/SIGUIENTES-PASOS.md`». Y dime qué pendiente has hecho.
