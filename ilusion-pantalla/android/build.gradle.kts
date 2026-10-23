// Los plugins de Android se declaran en cada módulo Android (:app, :core:wallpaper), no aquí:
// así los módulos de lógica pura se construyen sin Android SDK ni descargas de Google (CI y máquinas sin SDK).
plugins {
    kotlin("jvm") version "2.0.21" apply false
    kotlin("plugin.serialization") version "2.0.21" apply false
}
