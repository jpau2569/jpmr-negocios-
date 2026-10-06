package es.ilusionpantalla.cuenta

import kotlinx.serialization.json.*
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal class Respuesta(val codigo: Int, val cuerpo: String) {
    val json: JsonObject? get() = runCatching { Json.parseToJsonElement(cuerpo).jsonObject }.getOrNull()
    /** Código de error de Supabase Auth/Functions/PostgREST (`error_code`, `code` o `codigo`), en minúsculas. */
    val codigoError: String? get() = json?.let { j -> listOf("error_code", "codigo", "code").firstNotNullOfOrNull { j[it]?.jsonPrimitive?.contentOrNull } }?.lowercase()
}

/** Cliente HTTP mínimo. Lanza [IOException] solo si no hay red; cualquier respuesta HTTP se devuelve para interpretarla. */
internal class Http(baseUrl: String, private val claveAnonima: String, private val timeoutMs: Int = 15_000) {
    val base = baseUrl.trimEnd('/').also {
        require(it.startsWith("https://") || it.startsWith("http://localhost") || it.startsWith("http://127.0.0.1")) { "baseUrl debe ser https" }
    }
    fun enviar(metodo: String, ruta: String, cuerpo: JsonObject? = null, token: String? = null): Respuesta {
        val c = URL(base + ruta).openConnection() as HttpURLConnection
        try {
            c.requestMethod = metodo; c.connectTimeout = timeoutMs; c.readTimeout = timeoutMs
            c.setRequestProperty("apikey", claveAnonima); c.setRequestProperty("Authorization", "Bearer ${token ?: claveAnonima}"); c.setRequestProperty("Accept", "application/json")
            if (cuerpo != null) { c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(cuerpo.toString().toByteArray()) } }
            val codigo = c.responseCode
            return Respuesta(codigo, (if (codigo in 200..299) c.inputStream else c.errorStream)?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty())
        } finally { c.disconnect() }
    }
}
