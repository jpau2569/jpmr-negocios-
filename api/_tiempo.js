/* La función vive con su app, en `sol-niebla-agua/api/tiempo.js`, para que
   esa carpeta se pueda desplegar sola como proyecto propio (Root Directory
   = sol-niebla-agua). Este reenvío mantiene la ruta `/api/tiempo` también
   cuando se despliega el monorepo entero desde la raíz.                   */
export { default } from '../sol-niebla-agua/api/tiempo.js';
