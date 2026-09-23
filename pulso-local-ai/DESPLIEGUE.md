# Subir Pulso Local AI a Vercel

Pasos exactos. Tarda unos minutos y no hace falta tocar código.

> **Por qué lo haces tú y no Claude:** el conector de Vercel de la sesión puede
> leer proyectos y desplegar, pero **no crear proyectos nuevos** (devuelve 403
> `forbidden · create · project`). Una vez creado el proyecto, los despliegues
> siguientes van solos con cada push.

---

## 1. Crear el proyecto (2 minutos)

1. Entra en [vercel.com/new](https://vercel.com/new).
2. Busca el repositorio **`jpau2569/jpmr-negocios-`**.
   - Si no aparece, pulsa **Adjust GitHub App Permissions** y dale acceso a ese
     repositorio. Es lo que está faltando.
3. En **Root Directory**, pulsa *Edit* y elige **`pulso-local-ai`**. Esto es
   imprescindible: el repositorio es un monorepo y sin esto Vercel intenta
   construir la raíz.
4. Framework: **Next.js** (se detecta solo).
5. **No despliegues todavía**: primero las variables del paso 2.

## 2. Variables de entorno

En *Settings → Environment Variables*. Las dos primeras son obligatorias; sin
ellas **el panel se queda cerrado a propósito** (lo cual es correcto, pero no
podrás entrar).

| Variable | Valor | Para qué |
|---|---|---|
| `PANEL_CLAVE` | la que generes abajo | Lo que tecleas para entrar en `/dashboard` |
| `PANEL_SECRETO` | el que generes abajo | Firma la cookie de sesión. **No se teclea nunca** |
| `NEXT_PUBLIC_SITE_URL` | la URL que te dé Vercel | Con esto se construyen los QR |
| `NEXT_PUBLIC_PULSO_WHATSAPP` | tu móvil, solo cifras con 34 | CTA de «reactivar mi espacio» |

Genera las claves en tu ordenador (no reutilices ninguna que haya pasado por un
chat):

```bash
node -e 'const c=require("node:crypto");
const p=["sidra","cachopo","pizarra","mostaza","taberna","cenera","mieres","parrilla","brasa","llagar"];
console.log("PANEL_CLAVE   =", Array.from({length:4},()=>p[c.randomInt(p.length)]).join("-")+"-"+c.randomInt(1000,9999));
console.log("PANEL_SECRETO =", c.randomBytes(32).toString("base64url"));'
```

La clave debe tener **12 caracteres o más** y el secreto **32 o más**: si no, el
panel se niega a abrir y te dice por qué.

### Supabase (opcional de momento)

Sin Supabase la web **funciona igual**: sirve la carta desde el respaldo y los
formularios avisan de que no guardan nada. Cuando lo montes:

| Variable | Dónde | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Pública por diseño |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ídem | Pública: lo que protege es RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | ídem | **Secreta.** Nunca con `NEXT_PUBLIC_` |

Y lanza en su editor SQL, **en este orden**: `sql/01_esquema.sql`,
`sql/02_rls.sql`, `sql/03_seed.sql`.

## 3. Desplegar

Pulsa **Deploy**. Tarda un par de minutos.

Si es la primera vez, Vercel despliega la rama de producción (`main`), donde
todavía no está este proyecto. Para desplegar el trabajo actual:

- **Rápido**: en *Deployments*, elige la rama `claude/bold-dirac-rdwjqa` →
  *Redeploy*. Sale una URL de vista previa que ya sirve para enseñar.
- **Definitivo**: fusiona esa rama en `main` y cada push desplegará solo.

## 4. Comprobar que está bien (importante)

En cuanto tengas la URL, **estas cuatro**:

```
✓ /                          el hub con las dos demos
✓ /b/thewhitebar-mieres      la carta con sus 44 platos
✓ /b/la-vina-cenera          La Viña, con grupos
✗ /dashboard                 DEBE pedirte la clave
```

La cuarta es la que importa: si `/dashboard` se abre sin pedir nada, **para y
avisa**. Dentro hay teléfonos y reservas de clientes.

## 5. Antes de imprimir los QR

Cambia `NEXT_PUBLIC_SITE_URL` a la URL definitiva **antes** de generar los
carteles en `/dashboard/qr`. Un QR impreso con la dirección vieja no se
arregla: hay que reimprimir.

Y escanea uno con el móvil antes de mandar cien a imprenta.

## 6. El dominio

`pulsolocal.ai` **no existe todavía**. Hay que comprarlo y apuntarlo en
*Settings → Domains*. Mientras tanto la URL de Vercel funciona igual para
enseñar las demos por WhatsApp.

---

## Si algo falla

**El build falla nada más empezar** → casi seguro que falta el *Root Directory*
= `pulso-local-ai`.

**`/dashboard` dice «El panel está cerrado»** → falta `PANEL_CLAVE` o
`PANEL_SECRETO`, o son demasiado cortas. La propia página te dice cuál.

**Los QR llevan `localhost`** → falta `NEXT_PUBLIC_SITE_URL`. Ponla y
**redespliega**: las variables no se aplican a un build ya hecho.

**La carta sale vacía** → no debería pasar nunca: hay un respaldo embebido. Si
pasa, mira los *Runtime Logs* del despliegue.
