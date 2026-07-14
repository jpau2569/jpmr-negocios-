# 📌 CLARA — Estado del proyecto y cómo seguir

> Nota para Pau (y para Clara/Claude cuando retomemos). Última sesión guardada para continuar **desde el MacBook Pro** otro día.

---

## ✅ Lo que YA está hecho (y guardado en GitHub, rama `main`)

La app de **CLARA** está construida y fusionada en el repositorio `jpau2569/jpmr-negocios-`. Todo el código está subido; **no se ha perdido nada**.

- `clara.html` — La interfaz de chat de Clara (con selector de modos).
- `api/clara.js` — El "cerebro": función que habla con la API de Claude y busca en Internet con **Perplexity**. Las claves viven aquí de forma segura, nunca en el navegador.
- `clara_persona.md` — La personalidad completa de Clara (los cinco modos).
- `CLARA.md` — Documentación de configuración.
- `index.html` — La web de LimpiaFotos, con un enlace a Clara.
- `package.json`, `vercel.json` — Preparados para desplegar en Vercel.

**Modos de Clara:** 💼 Trabajo y empleo · 📚 Estudios y profesor · 🌱 Psicóloga y coach · 💻 Ingeniera de software · 📰 Noticias e investigación (con Perplexity).

---

## ⏳ Lo que FALTA (solo el último paso: publicarla)

El código está listo. Solo queda **desplegarlo en un servidor** y **pegar 2 claves**. Nada más.

### Las 2 claves que hay que poner (en el panel del servidor, NUNCA en el chat)
1. `ANTHROPIC_API_KEY` → el cerebro de Clara. Se saca en **platform.claude.com → API Keys** (empieza por `sk-ant-...`).
2. `PERPLEXITY_API_KEY` → las búsquedas. Se saca en **perplexity.ai/account/api** con la cuenta `jpaumoralejo@gmail.com` (empieza por `pplx-...`). Requiere crédito/Pro en Perplexity.

---

## 🚧 Dónde nos quedamos atascados (el bloqueo)

Intentamos publicar en **Vercel**, pero:
- Para entrar en Vercel hay que iniciar sesión con **GitHub**.
- Al entrar en GitHub, pide **verificación en dos pasos (2FA)** con una "llave/passkey" y **da error** desde este ordenador.

**La cuenta de Vercel de Pau existe y funciona** — equipo: `pau-ia-projectos-55s-projects`, con proyectos como `crm-inmobiliaria`, `constructor-pau-26`, etc. El único problema es el acceso por el 2FA de GitHub en este PC.

---

## 🔜 Cómo seguir mañana desde el MacBook Pro (3 caminos)

### 🅰️ Entrar en Vercel POR CORREO (evita GitHub) — probar esto primero
1. Ir a **vercel.com/login**.
2. NO pulsar "Continue with GitHub". Usar **"Continue with Email"**.
3. Escribir **`jpaumoralejo@gmail.com`** → llega un correo con un enlace para entrar (sin contraseña ni 2FA).
4. Al entrar, comprobar que aparece el equipo `pau-ia-projectos-55s-projects` y los proyectos de siempre.
5. Luego: **Add New → Project → importar `jpmr-negocios-` → Deploy**.
6. En **Settings → Environment Variables**, añadir las 2 claves de arriba y **Redeploy**.
7. Clara viva en: `https://jpmr-negocios.vercel.app/clara.html`

### 🅱️ Recuperar el 2FA de GitHub
Si el MacBook tiene la app de códigos (Google Authenticator/Authy), los códigos de recuperación, o la app de GitHub con sesión abierta, se usa eso para pasar la verificación. Si no, usar el enlace **"Inicia la recuperación de autenticación de dos factores"** (verifica por correo). Una vez dentro de GitHub, Vercel funciona normal.

### 🅲️ Alternativa: Hostinger
Si se prefiere Hostinger en vez de Vercel, hay que **reescribir el motor de Clara en PHP** (el actual es Node.js, para Vercel) y subir los archivos por el **Administrador de archivos de hPanel**. Es más laborioso pero posible. (Pedírselo a Clara cuando se retome.)

---

## 💬 Cómo retomar conmigo
Abrir este proyecto desde el MacBook y decirme, por ejemplo:
> "Clara, retomamos: entré en Vercel por correo, guíame para importar y poner las claves."

o

> "Clara, ayúdame a recuperar el 2FA de GitHub."

o

> "Clara, prepara la versión PHP para Hostinger."

## 🔒 Recordatorio de seguridad
**Nunca pegar las claves (`sk-ant-...`, `pplx-...`) en el chat.** Se ponen solo en el panel del servidor (Vercel o Hostinger). Son como la contraseña del dinero.

---

*Ánimo, Pau — está a un solo paso de funcionar. Mañana con calma lo dejamos listo. 💜 — Clara*
