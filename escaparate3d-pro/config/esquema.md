# Esquema de `negocio.json`

Lo único que hay que tocar para adaptar el producto a un cliente. Todo lo que no
se ponga coge el valor por defecto de `js/config.js` (`POR_DEFECTO`), así que un
JSON con cuatro claves ya funciona.

| Clave | Tipo | Para qué |
|---|---|---|
| `id` | texto | Identificador del despliegue (carpeta, documento de Firestore, origen de los leads) |
| `sector` | `"restaurante"` \| `"inmobiliaria"` | Decide qué módulos existen |
| `nombre`, `eslogan` | texto | Cabecera, título de la pestaña y mensajes |
| `logoUrl` | URL o `data:image/...` | El panel lo guarda reducido a 256 px dentro del propio JSON |
| `colores` | `{fondo, acento, acento2, texto}` | Hex. Tiñen el CSS y la escena 3D |
| `contacto` | `{telefono, telefonoTexto, whatsapp, email, direccion, horario, mapaLat, mapaLng}` | `whatsapp` solo cifras con prefijo (34…). Vacío = sin botones de WhatsApp |
| `redes` | `{web, instagram, facebook, tiktok, googleBusiness, tripadvisor}` | Cada URL rellenada es un botón; solo se admite http(s). En hostelería, Google y TripAdvisor son las que más confianza dan |
| `modulos` | booleanos | `pedidosDomicilio`, `reservas`, `qrMesas`, `catalogoInmuebles`, `valoracionGratis`, `pedirDemo` |
| `datos` | `{modo, api:{lead,pedido,reserva}, firebase:{...}}` | `local` \| `api` \| `firebase` |
| `demo` | `{activa, aviso}` | Con `activa: true` la web enseña que es una demo |
| `verificacion` | `{verificado, fuente, confirmado[], pendiente[]}` | Lo pendiente se pinta en el pie |
| `comercial` | `{marca, responsable, whatsapp, email, titulo, texto, plazo}` | A dónde van las peticiones de "quiero mi demo" (a quien vende, no al negocio) |

## Solo restaurante

| Clave | Para qué |
|---|---|
| `carta.categorias[]` | `{id, nombre, platos:[{id, nombre, descripcion, precio, foto, destacado, confirmado, alergenos[]}]}` |
| `carta.preciosEjemplo` | `true` marca los precios como de muestra en la web |
| `pedidos` | `{recogidaEnLocal, pedidoMinimo, zonasReparto:[{nombre,coste,minimo}], formasPago[], avisoLegal}` |
| `reservas` | `{maxComensales, antelacionDias, diasCerrado[] (0=domingo), turnos[], aviso}` |
| `qr` | `{mesas, prefijoMesa, destino: "carta"\|"pedido"}` |

## Solo inmobiliaria

| Clave | Para qué |
|---|---|
| `inmuebles.origenes[]` | URLs en cascada; gana la primera que devuelva inmuebles |
| `inmuebles.proxyFotos` | Prefijo para fotos de otro dominio (`/api/foto?u=`), que WebGL no puede pintar |
| `inmuebles.respaldo[]` | Cartera guardada para que el escaparate nunca salga vacío |
| `inmuebles.maxTarjetas3D`, `maxEnMensaje` | Cuántas van a la escena y cuántas caben en un WhatsApp |
| `valoracion` | `{titulo, texto, preguntarDireccion, preciosZona:[{zona,minM2,maxM2}]}` |

**`valoracion.preciosZona` es opcional a propósito**: sin esos datos de la
agencia, la valoración no inventa ninguna cifra — recoge el contacto y dice la
verdad, que el rango lo da la agencia tras ver la vivienda.
