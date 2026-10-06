package es.ilusionpantalla.cuenta

import kotlinx.serialization.json.*
import java.io.IOException

sealed interface ResultadoCompra {
    data class Verificada(val premium: Boolean, val estado: String, val expiracion: String?, val renueva: Boolean) : ResultadoCompra
    data object SinSesion : ResultadoCompra
    data object CompraDeOtraCuenta : ResultadoCompra
    /** La compra no estaba ligada a una cuenta (se hizo sin sesión): hay que volver a comprarla con sesión. */
    data object CompraSinCuenta : ResultadoCompra
    data object NoEncontrada : ResultadoCompra
    data object NoDisponibleAhora : ResultadoCompra
    data object SinConexion : ResultadoCompra
    data class Otro(val codigo: Int) : ResultadoCompra
}

data class PlanUsuario(val premium: Boolean, val estado: String)

sealed interface ResultadoBorrado { data object Borrada : ResultadoBorrado; data object SuscripcionActiva : ResultadoBorrado; data object SinSesion : ResultadoBorrado; data object SinConexion : ResultadoBorrado; data class Otro(val codigo: Int) : ResultadoBorrado }

class ClienteCuenta(baseUrl: String, claveAnonima: String) {
    private val http = Http(baseUrl, claveAnonima, timeoutMs = 25_000)

    fun verificarCompra(tokenSesion: String, purchaseToken: String): ResultadoCompra = try {
        val r = http.enviar("POST", "/functions/v1/verificar-compra", buildJsonObject { put("purchase_token", purchaseToken) }, tokenSesion)
        val j = r.json
        when {
            r.codigo == 200 && j != null -> ResultadoCompra.Verificada(
                j["premium"]?.jsonPrimitive?.booleanOrNull ?: false, j["estado"]?.jsonPrimitive?.contentOrNull ?: "ninguna",
                j["expiracion"]?.jsonPrimitive?.contentOrNull, j["renueva"]?.jsonPrimitive?.booleanOrNull ?: false)
            r.codigo == 401 -> ResultadoCompra.SinSesion
            r.codigoError == "compra_de_otra_cuenta" -> ResultadoCompra.CompraDeOtraCuenta
            r.codigoError == "compra_sin_cuenta" -> ResultadoCompra.CompraSinCuenta
            r.codigo == 404 -> ResultadoCompra.NoEncontrada
            r.codigo == 502 || r.codigo == 503 -> ResultadoCompra.NoDisponibleAhora
            else -> ResultadoCompra.Otro(r.codigo)
        }
    } catch (e: IOException) { ResultadoCompra.SinConexion }

    /** Plan actual del usuario (lo escribe solo el servidor tras verificar con Play). null si no se pudo leer: la app no asume nada. */
    fun leerPlan(tokenSesion: String): PlanUsuario? = try {
        val r = http.enviar("GET", "/rest/v1/perfiles?select=plan,estado_suscripcion&limit=1", token = tokenSesion)
        val fila = runCatching { Json.parseToJsonElement(r.cuerpo).jsonArray.firstOrNull()?.jsonObject }.getOrNull()
        if (r.codigo == 200 && fila != null) PlanUsuario(fila["plan"]?.jsonPrimitive?.contentOrNull == "premium", fila["estado_suscripcion"]?.jsonPrimitive?.contentOrNull ?: "ninguna") else null
    } catch (e: IOException) { null }

    /** Descarga de datos (RGPD art. 15/20): devuelve el JSON tal cual para guardarlo/compartirlo. null si falla. */
    fun exportarDatos(tokenSesion: String): String? = try {
        val r = http.enviar("POST", "/rest/v1/rpc/exportar_mis_datos", buildJsonObject {}, tokenSesion)
        r.cuerpo.takeIf { r.codigo == 200 && r.json != null }
    } catch (e: IOException) { null }

    fun borrarCuenta(tokenSesion: String, aceptoSuscripcionActiva: Boolean): ResultadoBorrado = try {
        val r = http.enviar("POST", "/functions/v1/borrar-cuenta", buildJsonObject { put("confirmar", true); put("acepto_suscripcion_activa", aceptoSuscripcionActiva) }, tokenSesion)
        when { r.codigo == 200 -> ResultadoBorrado.Borrada; r.codigo == 401 -> ResultadoBorrado.SinSesion; r.codigoError == "suscripcion_activa" -> ResultadoBorrado.SuscripcionActiva; else -> ResultadoBorrado.Otro(r.codigo) }
    } catch (e: IOException) { ResultadoBorrado.SinConexion }
}
