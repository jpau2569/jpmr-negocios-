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

// Módulos Android: solo si hay SDK (ANDROID_HOME o local.properties con sdk.dir).
val hayAndroidSdk = System.getenv("ANDROID_HOME") != null || System.getenv("ANDROID_SDK_ROOT") != null || file("local.properties").exists()
if (hayAndroidSdk) {
    include(":app", ":core:wallpaper")
}
