// ============================================================================
//  Configuración del Worker para el CLI oficial `cf` (1.0.0-beta.16).
// ----------------------------------------------------------------------------
//  Igual que castresana-web: `cf build` / `cf deploy` delegan en Wrangler en
//  modo «new config», que exige este archivo (con solo `wrangler.jsonc` falla
//  con «cloudflare.config.ts is required»). La carpeta de los archivos
//  estáticos va en `wrangler.config.ts`.
//
//  UNA COPIA POR INMOBILIARIA. Lo único que hay que tocar aquí:
//    · `name` del Worker (por ejemplo, "hojas-otra-inmobiliaria") si en la
//      misma cuenta de Cloudflare hay más de una inmobiliaria;
//    · el `name` y el `id` de SU base de datos D1 (te los da `cf d1 create`,
//      paso 4 del README).
//  La marca (nombre, logo, colores, datos legales) NO va aquí: se pone desde
//  la propia app, en Ajustes. Las claves tampoco: van como secretos
//  (PANEL_CLAVE y, opcionales, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, IP_SECRETO).
// ============================================================================
import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "hojas-firmadas",
		compatibilityDate: "2026-10-01",
		entrypoint: "src/index.js",
		assets: {
			// El Worker atiende todas las rutas (y sirve /static/* y /sw.js desde
			// public/) para poner las cabeceras de seguridad también ahí.
			runWorkerFirst: true,
		},
		env: {
			DB: bindings.d1({
				name: "hojas-firmadas-db",
				// Sustituir por el id real que devuelve `cf d1 create`.
				// Este de relleno sirve para probar en local (`--local`).
				id: "00000000-0000-4000-8000-000000000000",
			}),
			ASSETS: bindings.assets(),
		},
	},
});
