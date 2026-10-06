plugins { kotlin("jvm") }
dependencies { testImplementation(kotlin("test")) }
tasks.test { useJUnitPlatform() }

// La app Android compila a Java 17: los módulos puros deben generar el mismo nivel aunque se construyan con un JDK más nuevo.
java { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
