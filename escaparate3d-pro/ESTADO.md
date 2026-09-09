# Escaparate 3D Pro — estado y cómo seguir

> Nota para Pau (y para Clara/Claude cuando retomemos, desde el PC).
> Sesión del **9 de septiembre de 2026**. Ya **fusionado en `main`** (`f4c83a7`).
> Rama de trabajo: `claude/escaparate-3d-white-label-kohg1a`.
> **Todo está subido a GitHub: no se ha perdido nada.** `npm test`: 382 en verde.

---

## ✅ Lo que YA está hecho

El producto **Escaparate 3D Pro** está construido entero y con tests en verde.
Es un mismo código que sirve a restaurantes e inmobiliarias cambiando solo
`config/negocio.json`.

- **Estructura white-label**: `config/`, `index.html`, `admin/`, `modules/`.
  Cero datos de negocio fuera del JSON.
- **Escena 3D genérica** (`js/escena.js`, Three.js por CDN) que monta platos o
  inmuebles según el sector. Sin WebGL o sin red, la lista 2D enseña lo mismo.
- **Tema** (`js/tema.js`): los 4 colores del JSON van a CSS custom properties
  **y** tiñen el 3D. El texto sobre el acento se elige por contraste WCAG.
- **Módulos que solo se cargan si están contratados**: carta, pedidos (carrito,
  zonas de reparto, recogida y pedido en mesa), reservas (turnos, aforo, días de
  cierre), QR por mesa (generador propio), cartera de inmuebles (cascada,
  favoritos, visita solo con los marcados), valoración gratis y el apartado
  comercial "quiero esto para mi negocio".
- **Capa de datos intercambiable**: `local` | `api` (`/api/lead`) | `firebase`
  (Firestore por REST, sin SDK). Siempre queda copia local + salida por WhatsApp.
- **Tres demos reales**: Asesoría Castresana, Restaurante La Viña (Cenera) y
  La Taberna · The White Bar (Mieres), esta última con su carta real y precios.
- **`demos.html`** (hub comercial), **`admin/`** (panel del dueño) y
  **`admin/construir-total.html`** (de demo a app real: semáforo de 9 requisitos
  + descarga del paquete `.zip` del cliente).
- **Backend propio** (`api/` + `lib/` dentro de la carpeta, copia exacta del
  monorepo vigilada por un test): la carpeta se despliega suelta por cliente.
- **Modo comercial**: tour "¿cómo funciona?" para que una demo mandada por
  WhatsApp se explique sola, precio (180 €) con lo que incluye, y "mandar esta
  demo" con enlace limpio, QR y mensaje ya redactado.
- **Tests**: `test/escaparate3d-pro.test.mjs`, 148 comprobaciones en verde.
  `npm test` completo: 382 comprobaciones, 0 fallos.

---

## ⏳ Lo que FALTA (por orden)

1. **Confirmar los datos de La Viña de Cenera.** Hoy están verificados solo:
   dirección (Ctra. de Cenera, 1 · 33615 Mieres), teléfono **985 42 66 90**, su
   página de Facebook y las especialidades citadas (lechazo al horno, cordero a
   la estaca, lacón con cachelos, callos, casadielles).
   **Pendiente y marcado como "de muestra" en el JSON y en la propia web**:
   carta completa y precios, horario exacto, correo y WhatsApp, zonas de
   reparto, turnos y aforo, fotos propias.
   Se arregla en 5 minutos desde `admin/` o desde `admin/construir-total.html`.
2. **Redes de Castresana**: faltan Instagram, Facebook y ficha de Google. Están
   vacíos a propósito, y por eso esos botones no se pintan.
3. **Desplegar y verlo en vivo — LO TIENE QUE HACER PAU.** Claude no puede:
   la conexión con Vercel lee la cuenta pero **no tiene permiso para crear
   proyectos** (403 forbidden). Y desde este entorno el proxy bloquea
   `asesoriacastresana.com`, así que la cartera real solo se puede comprobar ya
   desplegado. Pasos, 2 minutos y **sin ninguna clave**:

   1. Abrir `https://vercel.com/new/import?s=https://github.com/jpau2569/jpmr-negocios-`
   2. En **Root Directory** pulsar *Edit* y elegir **`escaparate3d-pro`**
      (importante: así se publica solo el producto, no el monorepo entero).
   3. Framework Preset: **Other**. Sin variables de entorno.
   4. **Deploy**. Quedan vivos `/demos.html`, `/index.html?negocio=castresana`,
      `/admin/` y `/api/escaparate`.

   Lo primero que hay que mirar al abrirlo: que la demo de Castresana enseñe
   **pisos de verdad** y no el respaldo de 7 inmuebles del JSON.
4. **Opcional**: enlazar `escaparate3d-pro/demos.html` desde el `index.html` de
   la web, para tenerlo a mano en las visitas comerciales.

---

## 🔜 Cómo retomar desde el PC

```bash
git fetch origin
git checkout claude/escaparate-3d-white-label-kohg1a
git pull
npm install                 # trae playwright y three (solo para los tests)
python3 -m http.server 8080 # desde la raíz del repositorio
```

Y abrir en el navegador:

| Dirección | Qué es |
|---|---|
| `http://localhost:8080/escaparate3d-pro/demos.html` | Hub comercial (empieza por aquí) |
| `…/escaparate3d-pro/index.html?negocio=la-vina` | Demo del restaurante |
| `…?negocio=la-vina&mesa=7#pedido` | Lo que ve el cliente al escanear el QR |
| `…/escaparate3d-pro/index.html?negocio=castresana` | Demo de la inmobiliaria |
| `…?auto=1` | Modo escaparate para la tele del local |
| `…/escaparate3d-pro/admin/` | Panel del dueño del negocio |
| `…/escaparate3d-pro/admin/construir-total.html` | **Construir Total** |

Comprobar que sigue todo bien:

```bash
node test/escaparate3d-pro.test.mjs     # 103 comprobaciones
npm test                                 # todo el monorepo
```

---

## 💬 Cómo retomarlo conmigo

> "Clara, retomamos el Escaparate 3D Pro: aquí van los datos reales de La Viña."

> "Clara, prepara el escaparate para [cliente nuevo] con Construir Total."

> "Clara, despliega la rama del escaparate en Vercel y revisa que la cartera de
> Castresana carga en vivo."

---

## ⚠️ Lo que NO hay que olvidar

- El apartado "quiero esto para mi negocio" va al **contacto comercial de Pau**
  (`config.comercial`), **no** al del negocio de la demo. No mezclar.
- Mientras `demo.activa` sea `true` o queden cosas en `verificacion.pendiente`,
  la web **avisa** de que hay datos sin confirmar. Es a propósito: no se enseña
  como cerrado algo que el cliente no ha confirmado.
- El semáforo de `admin/construir-total.html` manda: mientras quede un requisito
  sin marcar, eso sigue siendo una demo, por bonita que se vea.
