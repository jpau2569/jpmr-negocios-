pluginManagement {
    repositories { gradlePluginPortal(); google(); mavenCentral() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "ilusion-pantalla"

// Lógica pura (JVM): se compila y testea en cualquier máquina, también en CI sin Android SDK.
include(":core:rendimiento", ":core:catalogo", ":core:analitica", ":core:cuenta")

// Módulos Android: se incluyen SIEMPRE (así Android Studio los sincroniza en la primera apertura),
// salvo que se pida solo lógica pura con -PsoloJvm (CI y máquinas sin Android SDK: ver verificar-todo.sh).
if (!providers.gradleProperty("soloJvm").isPresent) {
    include(":app", ":core:wallpaper")
}
