package es.ilusionpantalla.analitica

import kotlinx.serialization.json.*
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

sealed interface ResultadoEnvio {
    data class Ok(val guardados: Int, val descartados: Int, val motivo: String?) : ResultadoEnvio
    /** El servidor rechazó el contenido (4xx): reintentar no lo arregla → se descarta para no bloquear la cola. */
    data class Permanente(val codigo: Int) : ResultadoEnvio
    /** Sin red, timeout o 5xx/429: se conserva y se reintenta más tarde. */
    data object Transitorio : ResultadoEnvio
}

class ClienteAnalitica(baseUrl: String, private val claveAnonima: String, private val timeoutMs: Int = 10_000) {
    private val base = baseUrl.trimEnd('/').also {
        require(it.startsWith("https://") || it.startsWith("http://localhost") || it.startsWith("http://127.0.0.1")) { "baseUrl debe ser https" }
    }
    fun consentimiento(instalacionId: String, concedido: Boolean, versionTexto: String) =
        enviar(buildJsonObject { put("accion", "consentimiento"); put("instalacion_id", instalacionId); put("concedido", concedido); put("version_texto", versionTexto) })
    fun borrar(instalacionId: String) = enviar(buildJsonObject { put("accion", "borrar"); put("instalacion_id", instalacionId) })
    internal fun eventos(instalacionId: String, lote: List<Pair<EventoGuardado, Int>>) = enviar(buildJsonObject {
        put("accion", "eventos"); put("instalacion_id", instalacionId)
        putJsonArray("eventos") { lote.forEach { (e, haceS) -> addJsonObject { put("evento", e.evento); put("propiedades", e.propiedades); put("hace_s", haceS) } } }
    })

    private fun enviar(cuerpo: JsonObject): ResultadoEnvio {
        val c = URL("$base/functions/v1/analitica").openConnection() as HttpURLConnection
        return try {
            c.requestMethod = "POST"; c.connectTimeout = timeoutMs; c.readTimeout = timeoutMs; c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("apikey", claveAnonima); c.setRequestProperty("Authorization", "Bearer $claveAnonima")
            c.outputStream.use { it.write(cuerpo.toString().toByteArray()) }
            val codigo = c.responseCode
            val texto = (if (codigo in 200..299) c.inputStream else c.errorStream)?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty()
            when {
                codigo in 200..299 -> {
                    val o = runCatching { Json.parseToJsonElement(texto).jsonObject }.getOrNull()
                    ResultadoEnvio.Ok(o?.get("guardados")?.jsonPrimitive?.intOrNull ?: 0, o?.get("descartados")?.jsonPrimitive?.intOrNull ?: 0, o?.get("motivo")?.jsonPrimitive?.contentOrNull)
                }
                codigo == 429 || codigo >= 500 -> ResultadoEnvio.Transitorio
                else -> ResultadoEnvio.Permanente(codigo)
            }
        } catch (e: IOException) { ResultadoEnvio.Transitorio } finally { c.disconnect() }
    }
}
