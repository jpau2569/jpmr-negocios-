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

## Pendiente 1 — Tu dominio `agenda.jpaumoralejo.es` (casi hecho)

Hecho el 20/10:
- **Hostinger:** CNAME `agenda` → `cname.vercel-dns.com`. Funciona; Vercel lo ve bien.
- **Vercel:** el dominio está añadido en el proyecto **`jpmr-negocios`** (sin guion) de la cuenta **appsmovilpau**. Ese proyecto despliega este mismo repositorio, así que también tiene la agenda y sirve igual.

Falta: Vercel dice «Verification Required — This domain is linked to another Vercel account». Hay que demostrar que el dominio es tuyo con un registro TXT:

1. En Vercel → proyecto `jpmr-negocios` → Settings → **Domains** → `agenda.jpaumoralejo.es`. En la fila **TXT**, pulsa el **icono de copiar** del valor. Empieza por `vc-domain-verify=agenda.jpaumoralejo.es,…` y es largo: cópialo con el botón, no a mano.
2. En **Hostinger** → Dominios → `jpaumoralejo.es` → **DNS** → añade:

   | Tipo | Nombre  | Valor                                  | TTL           |
   |------|---------|----------------------------------------|---------------|
   | TXT  | _vercel | (lo que has copiado de Vercel, entero) | el de defecto |

3. Deja el CNAME `agenda` como está. `cname.vercel-dns.com` sigue valiendo, aunque Vercel recomiende otro valor.
4. Vuelve a Vercel y espera a que `agenda.jpaumoralejo.es` pase a **Valid Configuration** (unos minutos; si no, pulsa *Refresh*). Luego el https se crea solo.
5. **Ojo:** en esa pantalla hay una fila `jpmr-negocios-sepia.vercel.app` con «307 → agenda.jpaumoralejo.es». Mientras el dominio no esté verificado, esa dirección lleva a una web que no abre. Si usas `jpmr-negocios-sepia.vercel.app` para algo, pulsa **Edit** en esa fila y quita la redirección («No redirect»). Si no la usas, déjala.

Comprobar: https://agenda.jpaumoralejo.es tiene que abrir la agenda.

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
