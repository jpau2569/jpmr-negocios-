package es.ilusionpantalla.catalogo

import kotlinx.serialization.json.*
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Resultado de pedir una descarga a la Edge Function `wallpaper-url`. */
sealed interface RespuestaUrl {
    data class Lista(val url: String, val calidad: String, val codec: String, val fps: Int, val tamanoBytes: Long, val caducaEnS: Int) : RespuestaUrl
    data object PremiumRequerido : RespuestaUrl
    data object NoEncontrado : RespuestaUrl
    data object SesionNoValida : RespuestaUrl
    data class Fallo(val mensaje: String) : RespuestaUrl
}

class ErrorRed(mensaje: String, causa: Throwable? = null) : IOException(mensaje, causa)

/**
 * Cliente mínimo (HttpURLConnection, sin dependencias extra). Usa SOLO la clave anónima:
 * la clave de servicio no existe en el cliente. No escribe nunca el token en mensajes de error.
 */
class ClienteSupabase(
    baseUrl: String,
    private val claveAnonima: String,
    private val timeoutMs: Int = 15_000,
    private val json: Json = Json { ignoreUnknownKeys = true; coerceInputValues = true },
) {
    private val base = baseUrl.trimEnd('/').also {
        require(it.startsWith("https://") || it.startsWith("http://localhost") || it.startsWith("http://127.0.0.1")) { "baseUrl debe ser https" }
    }

    fun descargarCatalogo(): List<Wallpaper> {
        val (codigo, cuerpo) = peticion("GET", "$base/rest/v1/catalogo_publico?select=*&order=fecha_publicacion.desc&limit=1000", null, null)
        if (codigo != 200) throw ErrorRed("catálogo: HTTP $codigo")
        return try { json.decodeFromString(cuerpo) } catch (e: Exception) { throw ErrorRed("catálogo con formato inesperado", e) }
    }

    fun pedirUrl(wallpaperId: String, calidad: CalidadDescarga, hevc: Boolean, fps: Int, tokenUsuario: String?): RespuestaUrl {
        val cuerpo = buildJsonObject {
            put("wallpaper_id", wallpaperId); put("calidad", calidad.codigo); put("hevc", hevc); put("fps", fps)
        }.toString()
        return try {
            val (codigo, texto) = peticion("POST", "$base/functions/v1/wallpaper-url", cuerpo, tokenUsuario)
            when (codigo) {
                200 -> {
                    val o = json.parseToJsonElement(texto).jsonObject
                    RespuestaUrl.Lista(
                        o.getValue("url").jsonPrimitive.content, o.getValue("calidad").jsonPrimitive.content,
                        o.getValue("codec").jsonPrimitive.content, o.getValue("fps").jsonPrimitive.int,
                        o.getValue("tamano_bytes").jsonPrimitive.long, o["caduca_en_s"]?.jsonPrimitive?.int ?: 600,
                    )
                }
                402 -> RespuestaUrl.PremiumRequerido
                404 -> RespuestaUrl.NoEncontrado
                401 -> RespuestaUrl.SesionNoValida
                else -> RespuestaUrl.Fallo("HTTP $codigo")
            }
        } catch (e: IOException) { RespuestaUrl.Fallo("sin conexión") }
        catch (e: Exception) { RespuestaUrl.Fallo("respuesta inesperada") }
    }

    private fun peticion(metodo: String, url: String, cuerpo: String?, token: String?): Pair<Int, String> {
        val c = (URL(url).openConnection() as HttpURLConnection)
        try {
            c.requestMethod = metodo; c.connectTimeout = timeoutMs; c.readTimeout = timeoutMs
            c.setRequestProperty("apikey", claveAnonima)
            c.setRequestProperty("Authorization", "Bearer ${token ?: claveAnonima}")
            c.setRequestProperty("Accept", "application/json")
            if (cuerpo != null) { c.doOutput = true; c.setRequestProperty("Content-Type", "application/json"); c.outputStream.use { it.write(cuerpo.toByteArray()) } }
            val codigo = c.responseCode
            val texto = (if (codigo in 200..299) c.inputStream else c.errorStream)?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
            return codigo to texto
        } catch (e: IOException) { throw ErrorRed("sin conexión", e) } finally { c.disconnect() }
    }
}
