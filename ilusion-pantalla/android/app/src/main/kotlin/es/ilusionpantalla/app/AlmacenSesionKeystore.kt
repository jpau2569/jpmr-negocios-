package es.ilusionpantalla.app

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import es.ilusionpantalla.cuenta.AlmacenSesion
import es.ilusionpantalla.cuenta.Sesion
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Guarda la sesión cifrada con AES-256-GCM; la clave vive en Android Keystore y nunca sale del chip seguro.
 * Si el descifrado falla (clave invalidada, copia restaurada en otro móvil…) se trata como «sin sesión», nunca como error.
 */
class AlmacenSesionKeystore(private val archivo: File, private val json: Json = Json { ignoreUnknownKeys = true }) : AlmacenSesion {
    private fun clave(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        }.generateKey()
    }
    override fun guardar(s: Sesion) {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, clave()) }
        val cifrado = c.doFinal(json.encodeToString(s).toByteArray())
        archivo.parentFile?.mkdirs(); val tmp = File(archivo.path + ".tmp")
        tmp.writeBytes(byteArrayOf(c.iv.size.toByte()) + c.iv + cifrado)
        if (!tmp.renameTo(archivo)) { archivo.delete(); tmp.renameTo(archivo) }
    }
    override fun leer(): Sesion? = runCatching {
        val b = archivo.readBytes(); val n = b[0].toInt()
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, clave(), GCMParameterSpec(128, b, 1, n)) }
        json.decodeFromString<Sesion>(c.doFinal(b, 1 + n, b.size - 1 - n).toString(Charsets.UTF_8))
    }.getOrNull()
    override fun borrar() { archivo.delete() }
    private companion object { const val ALIAS = "ilusion_sesion_v1" }
}
