// Parte de la configuración que lee Wrangler cuando `cf` le delega la
// construcción (misma forma que genera `cf migrate`): la carpeta de los
// recursos estáticos (logo, estilos y el JavaScript de las páginas).
import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig({
	assetsDirectory: "./public",
});
