plugins { alias(libs.plugins.android.application); alias(libs.plugins.kotlin.android); alias(libs.plugins.kotlin.compose) }
android {
    namespace = "es.ilusionpantalla.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "es.ilusionpantalla.app"
        minSdk = 26; targetSdk = 35
        versionCode = 1; versionName = "0.2.0"
        // Se leen de local.properties (no versionado) o de -P. La clave anónima es PÚBLICA por diseño; la de servicio NUNCA va aquí.
        val props = java.util.Properties().apply { rootProject.file("local.properties").takeIf { it.isFile }?.inputStream()?.use(::load) }
        fun cfg(k: String) = (props.getProperty(k) ?: (project.findProperty(k) as String?) ?: "").replace("\"", "")
        buildConfigField("String", "SUPABASE_URL", "\"${cfg("SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${cfg("SUPABASE_ANON_KEY")}\"")
    }
    buildTypes {
        release { isMinifyEnabled = true; isShrinkResources = true; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
}
dependencies {
    implementation(project(":core:rendimiento"))
    implementation(project(":core:wallpaper"))
    implementation(project(":core:catalogo"))
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.datastore)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui); implementation(libs.compose.material3); implementation(libs.compose.icons)
    implementation(libs.coil.compose)
    debugImplementation(libs.compose.tooling)
}
