# El backend que se lleva cada cliente

Estos archivos son **copia exacta** de `api/` y `lib/` del monorepo. Están aquí
porque cada cliente se lleva la carpeta `escaparate3d-pro/` entera a su propio
despliegue: sin ellos, un cliente con `datos.modo: "api"` se quedaría sin
`/api/lead` (404) y la cartera no podría leerse.

- `escaparate.js` + `../lib/cartera.js` → lee la cartera publicada en la web
  oficial del cliente (plantillas Inmoweb). Solo hace falta en inmobiliarias.
- `foto.js` → proxy con lista blanca de dominios, porque WebGL no puede pintar
  fotos de otro dominio.
- `lead.js` + `../lib/memoria.js` → alta de leads en Supabase
  (`SUPABASE_URL` + `SUPABASE_ANON_KEY`). Sin esas variables devuelve 503 y la
  web cae sola a copia local + WhatsApp, que es justo lo que debe pasar.
- `health.js` → comprobación rápida de que el despliegue está vivo.

**Si tocas uno de los originales del monorepo, vuelve a copiarlo aquí.**
`test/escaparate3d-pro.test.mjs` falla si las dos copias se separan.
