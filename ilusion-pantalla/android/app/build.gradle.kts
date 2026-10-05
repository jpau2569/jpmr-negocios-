plugins { alias(libs.plugins.android.application); alias(libs.plugins.kotlin.android); alias(libs.plugins.kotlin.compose) }
android {
    namespace = "es.ilusionpantalla.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "es.ilusionpantalla.app"
        minSdk = 26; targetSdk = 35
        versionCode = 1; versionName = "0.1.0"
    }
    buildTypes {
        release { isMinifyEnabled = true; isShrinkResources = true; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
}
dependencies {
    implementation(project(":core:rendimiento"))
    implementation(project(":core:wallpaper"))
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
