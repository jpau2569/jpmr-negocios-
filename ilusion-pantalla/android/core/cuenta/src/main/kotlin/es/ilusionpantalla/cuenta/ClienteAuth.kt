package es.ilusionpantalla.cuenta

import kotlinx.serialization.json.*
import java.io.IOException

sealed interface ResultadoAuth {
    data class Ok(val sesion: Sesion) : ResultadoAuth
    /** Registro correcto pero hay que confirmar el correo antes de entrar (no hay sesión todavía). */
    data object ConfirmarCorreo : ResultadoAuth
    data object CredencialesInvalidas : ResultadoAuth
    data object CorreoSinConfirmar : ResultadoAuth
    data object UsuarioYaExiste : ResultadoAuth
    data class ContrasenaDebil(val mensaje: String) : ResultadoAuth
    data object DemasiadosIntentos : ResultadoAuth
    data object SinConexion : ResultadoAuth
    data class Otro(val codigo: Int) : ResultadoAuth
}

/** Supabase Auth (GoTrue) por REST. Contraseña y correo; Google se añade con Credential Manager en la app. */
class ClienteAuth(baseUrl: String, claveAnonima: String, private val reloj: () -> Long = { System.currentTimeMillis() / 1000 }) {
    private val http = Http(baseUrl, claveAnonima)

    fun registrar(email: String, contrasena: String): ResultadoAuth = pedir("/auth/v1/signup", email, contrasena, registro = true)
    fun entrar(email: String, contrasena: String): ResultadoAuth = pedir("/auth/v1/token?grant_type=password", email, contrasena, registro = false)

    fun refrescar(refreshToken: String): ResultadoAuth = try {
        interpretar(http.enviar("POST", "/auth/v1/token?grant_type=refresh_token", buildJsonObject { put("refresh_token", refreshToken) }), registro = false)
    } catch (e: IOException) { ResultadoAuth.SinConexion }

    /** Cierra la sesión en el servidor. Devuelve false si no hubo red (el llamador igualmente borra la local). */
    fun salir(accessToken: String): Boolean = try { http.enviar("POST", "/auth/v1/logout", token = accessToken).codigo in 200..299 } catch (e: IOException) { false }

    fun recuperarContrasena(email: String): ResultadoAuth = try {
        val r = http.enviar("POST", "/auth/v1/recover", buildJsonObject { put("email", email.trim()) })
        // Siempre "Ok" visible: no se revela si el correo existe (evita enumerar usuarios).
        when { r.codigo in 200..299 -> ResultadoAuth.ConfirmarCorreo; r.codigo == 429 -> ResultadoAuth.DemasiadosIntentos; else -> ResultadoAuth.Otro(r.codigo) }
    } catch (e: IOException) { ResultadoAuth.SinConexion }

    private fun pedir(ruta: String, email: String, contrasena: String, registro: Boolean): ResultadoAuth = try {
        interpretar(http.enviar("POST", ruta, buildJsonObject { put("email", email.trim()); put("password", contrasena) }), registro)
    } catch (e: IOException) { ResultadoAuth.SinConexion }

    private fun interpretar(r: Respuesta, registro: Boolean): ResultadoAuth {
        if (r.codigo in 200..299) {
            val j = r.json ?: return ResultadoAuth.Otro(r.codigo)
            val acceso = j["access_token"]?.jsonPrimitive?.contentOrNull
            if (acceso == null) return if (registro) ResultadoAuth.ConfirmarCorreo else ResultadoAuth.Otro(r.codigo)
            val usuario = j["user"]?.jsonObject
            val id = usuario?.get("id")?.jsonPrimitive?.contentOrNull ?: return ResultadoAuth.Otro(r.codigo)
            val expiraEn = j["expires_at"]?.jsonPrimitive?.longOrNull ?: (reloj() + (j["expires_in"]?.jsonPrimitive?.longOrNull ?: 3600))
            return ResultadoAuth.Ok(Sesion(acceso, j["refresh_token"]?.jsonPrimitive?.contentOrNull ?: return ResultadoAuth.Otro(r.codigo), expiraEn, id, usuario["email"]?.jsonPrimitive?.contentOrNull))
        }
        return when {
            r.codigo == 429 || r.codigoError == "over_request_rate_limit" || r.codigoError == "over_email_send_rate_limit" -> ResultadoAuth.DemasiadosIntentos
            r.codigoError == "invalid_credentials" || r.codigoError == "invalid_grant" -> ResultadoAuth.CredencialesInvalidas
            r.codigoError == "email_not_confirmed" -> ResultadoAuth.CorreoSinConfirmar
            r.codigoError == "user_already_exists" || r.codigoError == "email_exists" -> ResultadoAuth.UsuarioYaExiste
            r.codigoError == "weak_password" -> ResultadoAuth.ContrasenaDebil(r.json?.get("msg")?.jsonPrimitive?.contentOrNull ?: "La contraseña es demasiado débil.")
            r.codigo == 400 && !registro -> ResultadoAuth.CredencialesInvalidas
            else -> ResultadoAuth.Otro(r.codigo)
        }
    }
}

/** Sesión viva: la devuelve renovada si le quedan menos de [margenS] s, y la borra si el servidor ya no la acepta. */
class GestorSesion(private val auth: ClienteAuth, private val almacen: AlmacenSesion, private val reloj: () -> Long = { System.currentTimeMillis() / 1000 }, private val margenS: Long = 60) {
    val actual: Sesion? @Synchronized get() = almacen.leer()

    @Synchronized fun iniciar(r: ResultadoAuth): Boolean { if (r is ResultadoAuth.Ok) { almacen.guardar(r.sesion); return true }; return false }

    /** Token listo para usar, o null si no hay sesión / no se pudo renovar. Los fallos de red NO cierran la sesión. */
    @Synchronized fun tokenValido(): String? {
        val s = almacen.leer() ?: return null
        if (s.expiraEnS - reloj() > margenS) return s.accessToken
        return when (val r = auth.refrescar(s.refreshToken)) {
            is ResultadoAuth.Ok -> { almacen.guardar(r.sesion); r.sesion.accessToken }
            ResultadoAuth.SinConexion, ResultadoAuth.DemasiadosIntentos, is ResultadoAuth.Otro -> s.accessToken.takeIf { s.expiraEnS > reloj() }   // aún válido: úsalo; si no, sin token pero sin perder la sesión
            else -> { almacen.borrar(); null }                                                                                               // el servidor la rechaza: sesión muerta
        }
    }

    @Synchronized fun cerrar() { almacen.leer()?.let { auth.salir(it.accessToken) }; almacen.borrar() }
    @Synchronized fun olvidar() = almacen.borrar()
}
