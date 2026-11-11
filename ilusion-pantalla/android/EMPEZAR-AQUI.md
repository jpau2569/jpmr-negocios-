# Abrir la app en Android Studio (primera vez)

## 1. Instala Android Studio
Descárgalo de https://developer.android.com/studio (versión **Ladybug 2024.2.1 o más nueva**). Instálalo con las opciones por defecto; la primera vez descargará el Android SDK solo.

## 2. Consigue el código en tu ordenador
**Con GitHub Desktop (lo más fácil):** File → Clone repository → `jpau2569/jpmr-negocios-` → luego Branch → elige `claude/ilusion-pantalla-mvp-o9yu3j`.
**Sin instalar nada más:** en GitHub, entra en esa rama → botón verde *Code* → *Download ZIP* → descomprime.

## 3. Ábrelo
Android Studio → **Open** → elige la carpeta **`ilusion-pantalla/android`** (la que contiene `settings.gradle.kts`; NO la raíz del repositorio) → *Trust Project*.

## 4. Espera y sincroniza
- Abajo a la derecha verás barras de progreso. La primera vez tarda 5–15 min (descarga Gradle y librerías).
- Si pide **instalar SDK Platform 35** o **aceptar licencias**: pulsa el enlace azul *Install* / *Accept*.
- Si no arranca solo: menú **File → Sync Project with Gradle Files** (icono del elefante).

## 5. Copia los errores
1. Abre el panel **Build** (barra inferior, o menú *View → Tool Windows → Build*).
2. Pestaña **Sync** (errores de sincronización) o **Build Output** si has hecho *Build → Rebuild Project*.
3. Click derecho sobre el texto → **Copy**, y pégalo entero en el chat. Mejor texto que captura.

## 6. Para ejecutarla en tu móvil (después de que compile)
- En `android/local.properties` (lo crea Android Studio) añade:
  ```
  SUPABASE_URL=https://TU-PROYECTO.supabase.co
  SUPABASE_ANON_KEY=la clave anónima (pública), nunca la service_role
  ```
- Móvil: Ajustes → Acerca del teléfono → pulsa 7 veces *Número de compilación* → Opciones de desarrollador → activa *Depuración USB*. Conéctalo por cable y pulsa ▶.
- Sin esas claves la app arranca igual y muestra «Falta configurar el servidor».
