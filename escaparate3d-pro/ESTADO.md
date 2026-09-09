# Escaparate 3D Pro — estado y cómo seguir

> Nota para Pau (y para Clara/Claude cuando retomemos, desde el PC).
> Sesión del **9 de septiembre de 2026**. Rama: `claude/escaparate-3d-white-label-kohg1a`.
> Commit: `2a5a1cb`. **Todo está subido a GitHub: no se ha perdido nada.**

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
- **Dos demos reales**: Asesoría Castresana y Restaurante La Viña (Cenera).
- **`demos.html`** (hub comercial), **`admin/`** (panel del dueño) y
  **`admin/construir-total.html`** (de demo a app real: semáforo de 9 requisitos
  + descarga del paquete `.zip` del cliente).
- **Tests**: `test/escaparate3d-pro.test.mjs`, 103 comprobaciones en verde.
  `npm test` completo: 371 comprobaciones, 0 fallos.

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
3. **Desplegar y verlo en vivo.** Desde este entorno el proxy bloquea
   `asesoriacastresana.com` (403), así que la cartera real no se pudo descargar
   aquí; en Vercel sí funciona porque la lee `/api/escaparate`.
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
