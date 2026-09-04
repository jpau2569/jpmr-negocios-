# Fotos propias

Aquí viven las fotos de los inmuebles **en nuestro propio hosting**. Motivo:

1. Una foto enlazada desde un portal (pisos.com, Idealista, el CDN de Inmoweb)
   desaparece o se bloquea en cuanto caduca el anuncio, y el escaparate se queda
   con huecos.
2. El carrusel 3D pinta las fotos dentro de un `<canvas>` y **WebGL rechaza las
   imágenes de otro dominio** salvo que ese dominio autorice CORS. Con las fotos
   servidas desde aquí, la tarjeta 3D siempre se ve.

Nombres: `REFERENCIA-01.jpg`, `REFERENCIA-02.jpg`… (`PIS0160-01.jpg`).
Se descargan solas con `node escaparate3d/herramientas/sincronizar.mjs`, o se
copian a mano y se apuntan en `pisos.json` (`imagen` e `imagenes`).

Tamaño recomendado: **1600 px de lado máximo, WebP o JPG de calidad media**
(unos 150-250 KB por foto). Más grande no se nota en pantalla y ralentiza la
carga en el móvil.
