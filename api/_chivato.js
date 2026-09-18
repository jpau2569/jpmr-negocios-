/* La función vive con su app, en `chivato/api/chivato.js`, para que esa
   carpeta se pueda desplegar sola como proyecto propio (Root Directory =
   chivato). Este reenvío mantiene la ruta `/api/chivato` también cuando se
   despliega el monorepo entero desde la raíz.                             */
export { default } from '../chivato/api/chivato.js';
