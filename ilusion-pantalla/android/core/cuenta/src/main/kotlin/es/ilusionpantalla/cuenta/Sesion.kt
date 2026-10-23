package es.ilusionpantalla.cuenta

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.MessageDigest

@Serializable
data class Sesion(val accessToken: String, val refreshToken: String, val expiraEnS: Long, val usuarioId: String, val email: String?) {
    // Que no se filtren tokens por logs/excepciones/toString.
    override fun toString() = "Sesion(usuarioId=$usuarioId, email=$email, tokens=***)"
}

/** Dónde se guarda la sesión. En Android: implementación cifrada con Android Keystore. Aquí, archivo (pruebas/JVM). */
interface AlmacenSesion { fun leer(): Sesion?; fun guardar(s: Sesion); fun borrar() }

class AlmacenSesionArchivo(private val archivo: File, private val json: Json = Json { ignoreUnknownKeys = true }) : AlmacenSesion {
    override fun leer(): Sesion? = runCatching { json.decodeFromString<Sesion>(archivo.readText()) }.getOrNull()
    override fun guardar(s: Sesion) {
        archivo.parentFile?.mkdirs(); val tmp = File(archivo.path + ".tmp"); tmp.writeText(json.encodeToString(s))
        if (!tmp.renameTo(archivo)) { archivo.delete(); tmp.renameTo(archivo) }
    }
    override fun borrar() { archivo.delete() }
}

/**
 * Identificador que se pasa a Google Play (`setObfuscatedAccountId`) para ligar la compra a la cuenta.
 * DEBE ser idéntico al del servidor (`idOfuscado` en play.ts): SHA-256 hex de "ilusion:<uid>". Un test fija el vector.
 */
fun idOfuscado(usuarioId: String): String =
    MessageDigest.getInstance("SHA-256").digest("ilusion:$usuarioId".toByteArray()).joinToString("") { "%02x".format(it) }
