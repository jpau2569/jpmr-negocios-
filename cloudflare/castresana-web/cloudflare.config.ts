// ============================================================================
//  Configuración del Worker para el CLI oficial `cf` (1.0.0-beta.16).
// ----------------------------------------------------------------------------
//  Por qué este archivo y no `wrangler.jsonc`: `cf build` / `cf deploy`
//  delegan en Wrangler en modo «new config», que exige `cloudflare.config.ts`
//  (comprobado: con solo `wrangler.jsonc` falla con «cloudflare.config.ts is
//  required»). Este archivo tiene la misma forma que genera `cf migrate`.
//  La carpeta de recursos estáticos va en `wrangler.config.ts`.
//
//  Lo ÚNICO que Pau tiene que tocar aquí: el `id` de la base de datos D1,
//  que le da `cf d1 create` (paso 4 del README). Las claves NO van aquí:
//  van como secretos (PANEL_CLAVE, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//  TURNSTILE_SECRET).
// ============================================================================
import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "castresana-web",
		compatibilityDate: "2026-10-01",
		entrypoint: "src/index.js",
		assets: {
			// El Worker atiende todas las rutas y sirve /static/* desde la carpeta
			// `public/`, para poner las cabeceras de seguridad también ahí.
			runWorkerFirst: true,
		},
		env: {
			DB: bindings.d1({
				name: "castresana-web-db",
				// Sustituir por el id real que devuelve `cf d1 create`.
				// Este de relleno sirve para probar en local (`--local`).
				id: "00000000-0000-4000-8000-000000000000",
			}),
			ASSETS: bindings.assets(),

			// ---- Horario de visitas (hora de Madrid) -------------------------
			// Días: L M X J V S D. Rangos con guion y tramos separados por espacios.
			HORARIO: bindings.text("L-V 10:00-14:00 16:30-19:30; S 10:00-13:00"),
			BLOQUE_MINUTOS: bindings.text("30"),
			ANTELACION_HORAS: bindings.text("2"),
			DIAS_VISTA: bindings.text("30"),
			// Festivos sin visitas, separados por comas (AAAA-MM-DD). También se
			// pueden bloquear días desde el panel sin volver a publicar.
			FESTIVOS: bindings.text(""),

			// ---- Opcionales ---------------------------------------------------
			// Clave PÚBLICA de Turnstile (la secreta va como secreto
			// TURNSTILE_SECRET). Si falta cualquiera de las dos, no se usa.
			TURNSTILE_SITEKEY: bindings.text(""),
			// Teléfono del despacho para el botón «Escríbenos» cuando no hay
			// huecos (9 cifras). Vacío = no se enseña.
			TELEFONO_CONTACTO: bindings.text(""),
		},
	},
});
