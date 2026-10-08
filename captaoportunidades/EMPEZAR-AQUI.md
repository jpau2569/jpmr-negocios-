# CAPTAOPORTUNIDADES ASTURIAS — Empezar aquí

Tu CRM inmobiliario, **en tu ordenador**, sin cuotas y sin internet.

## 1. Lo único que necesitas

**Node.js 22.13 o superior** (gratis): <https://nodejs.org>. Se instala una vez, como cualquier programa. No hay nada más que instalar: no hace falta `npm install`.

## 2. Abrir el programa

| Sistema | Qué haces |
|---|---|
| **Windows** | Doble clic en `captaoportunidades\CAPTAO.bat` |
| **Mac / Linux** | Doble clic en `captaoportunidades/iniciar.command` (o `npm run captao`) |

Se abre una ventana negra y, a los pocos segundos, tu navegador con el CRM (`http://127.0.0.1:4380`). **No cierres la ventana negra mientras trabajas**; ciérrala al terminar.

> Si el navegador no se abre solo, copia la dirección que aparece en la ventana negra.

## 3. Tu primera sesión (10 minutos)

1. **Pulsa «Probar con datos de demostración»** (menú de la izquierda). Verás el CRM lleno de datos *ficticios* para curiosear. Una franja naranja te recuerda siempre dónde estás. Cuando quieras, «Volver a mis datos reales».
2. Ya en tus datos reales: **Nueva oportunidad**. Solo piden *fuente*, *tipo de inmueble* y *municipio*.
3. Cuando un propietario esté interesado: abre la oportunidad → **Cambiar estado**. Si el programa te dice que antes hay que *verificar el contacto*, es a propósito: anota cómo sabes que se puede contactar (por ejemplo, «me llamó él»).
4. Cuando firme el encargo: **Confirmar encargo**. Se crea el inmueble, se vincula al propietario y se guarda todo el historial. Si ya lo tenías en cartera, te avisa para no duplicarlo.
5. **Configuración → Copias de seguridad → Hacer una copia ahora.** Y guarda esa copia también en un pendrive o en la nube.

## 4. Dónde están tus datos

En la carpeta `.captaoportunidades` de tu usuario (en Windows: `C:\Users\TU-NOMBRE\.captaoportunidades`). La ruta exacta sale al abrir el programa y en *Configuración → Datos y privacidad*.

- `captao.sqlite` → tu base de datos (contactos, oportunidades, inmuebles…).
- `archivos/` → adjuntos y fotos (desde la Fase 2).
- `copias/` → tus copias de seguridad (ZIP que abre cualquier programa).
- `demo/` → la demostración, separada de lo real.

**No se guardan en el navegador**: si borras el historial del navegador, no pierdes nada.

## 5. Cosas importantes que debes saber

- **Es de una sola persona y sin contraseña.** Solo funciona en este ordenador. **No lo abras a internet ni a otra red** (para eso hace falta la Fase 4: contraseñas, HTTPS y más).
- **Desde el móvil real no se puede usar todavía**, a propósito. La pantalla sí se adapta a móvil (y está probada en tamaño móvil); el acceso remoto seguro llega en la Fase 4.
- **Los recordatorios solo avisan con la aplicación abierta.** No envían correos, SMS ni WhatsApp.
- **«No contactar» bloquea de verdad**: sus oportunidades pasan a «No contactar» y se cancelan sus llamadas y mensajes pendientes.
- **Las casillas de consentimiento no garantizan el cumplimiento legal.** Son un registro de la base y la evidencia de cada canal. Consúltalo con tu asesor.
- **El programa no rastrea portales ni extrae teléfonos.** Tú anotas lo que has visto. No hay mensajes ni llamadas automáticas.
- Cualquier plantilla de contrato es un **borrador pendiente de revisión profesional**.

## 6. ¿Algo no funciona?

| Síntoma | Solución |
|---|---|
| «Necesitas Node.js 22.13…» | Instala Node desde <https://nodejs.org> y vuelve a abrirlo |
| «No se puede contactar con el programa» | Se cerró la ventana negra: vuelve a abrir con `CAPTAO.bat` |
| «Dirección no permitida» | Abre solo `http://127.0.0.1:4380` o `http://localhost:4380` |
| El puerto está ocupado | El programa prueba solo los siguientes (4381…); mira la dirección en la ventana negra |
| Quiero volver a una copia | Configuración → Copias de seguridad → *Restaurar*. Antes se guarda una copia de lo actual |
