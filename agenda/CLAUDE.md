# Reglas de OLVIDO DE PAU AGENDA

- **No simular nada:** ni conexiones (Google, cuenta, IA), ni envíos (abrir WhatsApp o el correo no es enviar), ni interacciones que no haya apuntado Pau. Lo que no existe sale como «pendiente».
- **Todo texto** que se pinte pasa por `h()` (`ui.js`). Las URL pasan por `urlSegura` (solo http/https).
- **Datos:** la forma de cada registro vive en `LIMPIA` (`datos.js`) y sus reglas en `valida`. Un campo nuevo se añade ahí y en `esquema-fase2.sql`.
- **Privado vs. público** en inmuebles: `CAMPOS_PRIVADOS_INMUEBLE` nunca entra en `fichaCompartible`.
- **Destructivo = confirmación** (`confirma`). Borrar manda a la papelera; borrar definitivamente limpia referencias con `quitaReferencias`.
- **Botones:** todo `data-accion`, `data-cambio`, `data-teclear` y `data-form` debe estar registrado en algún `p-*.js`; el test de UI lo comprueba.
- **Service worker:** al añadir o renombrar un archivo, súmalo a `RECURSOS` y sube `VERSION`.
- **Pruebas:** `node test/agenda.test.mjs` y `node test/agenda.ui.test.mjs` en verde, sin desbordes a 360 px.
