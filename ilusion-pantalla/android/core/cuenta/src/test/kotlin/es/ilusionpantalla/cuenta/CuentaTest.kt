package es.ilusionpantalla.cuenta

import com.sun.net.httpserver.HttpServer
import kotlinx.serialization.json.*
import java.io.File
import java.net.InetSocketAddress
import java.nio.file.Files
import kotlin.test.*

class ServidorFalso {
    val srv: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    val peticiones = mutableListOf<Triple<String, String, String>>()   // ruta, authorization, cuerpo
    val rutas = mutableMapOf<String, (String) -> Pair<Int, String>>()
    init {
        srv.createContext("/") { x ->
            val cuerpo = x.requestBody.readBytes().toString(Charsets.UTF_8); val ruta = x.requestURI.toString()
            synchronized(peticiones) { peticiones += Triple(ruta, x.requestHeaders.getFirst("Authorization") ?: "", cuerpo) }
            val (c, t) = (rutas[ruta] ?: rutas[x.requestURI.path])?.invoke(cuerpo) ?: (404 to "{}")
            val b = t.toByteArray(); x.sendResponseHeaders(c, if (b.isEmpty()) -1 else b.size.toLong()); if (b.isNotEmpty()) x.responseBody.use { it.write(b) } else x.close()
        }
        srv.start()
    }
    val url get() = "http://127.0.0.1:${srv.address.port}"
    fun parar() = srv.stop(0)
}

private fun sesionJson(acceso: String = "ACC1", refresco: String = "REF1", expira: Long? = 2_000_000_000, id: String = "11111111-1111-4111-8111-111111111111") =
    """{"access_token":"$acceso","refresh_token":"$refresco","token_type":"bearer",${if (expira != null) "\"expires_at\":$expira," else "\"expires_in\":3600,"}"user":{"id":"$id","email":"ana@x.es"}}"""

class IdentidadTest {
    @Test fun `el identificador ofuscado coincide con el vector del servidor`() =
        assertEquals("9b67d432d4711014990e4577e54213747429e17e7091c1689bbd184b6c2bedb2", idOfuscado("11111111-1111-4111-8111-111111111111"))
    @Test fun `distinto usuario distinto identificador`() = assertNotEquals(idOfuscado("a"), idOfuscado("b"))
    @Test fun `la sesion no filtra tokens al imprimirse`() = assertFalse(Sesion("SECRETO", "OTRO", 1, "u", "e").toString().contains("SECRETO"))
}

class AuthTest {
    private val s = ServidorFalso(); @AfterTest fun parar() = s.parar()
    private val auth get() = ClienteAuth(s.url, "ANON", reloj = { 1_000 })

    @Test fun `entrar correcto devuelve la sesion`() {
        s.rutas["/auth/v1/token?grant_type=password"] = { 200 to sesionJson() }
        val r = auth.entrar(" ana@x.es ", "clave-larga-1")
        assertIs<ResultadoAuth.Ok>(r); assertEquals("ACC1", r.sesion.accessToken); assertEquals("11111111-1111-4111-8111-111111111111", r.sesion.usuarioId); assertEquals(2_000_000_000, r.sesion.expiraEnS)
        assertTrue(s.peticiones.last().third.contains("\"email\":\"ana@x.es\""), "recorta espacios"); assertEquals("Bearer ANON", s.peticiones.last().second)
    }
    @Test fun `expires_in se convierte en fecha absoluta con el reloj`() {
        s.rutas["/auth/v1/token?grant_type=password"] = { 200 to sesionJson(expira = null) }
        assertEquals(1_000 + 3600, (auth.entrar("a@x.es", "x") as ResultadoAuth.Ok).sesion.expiraEnS)
    }
    @Test fun `credenciales invalidas`() {
        s.rutas["/auth/v1/token?grant_type=password"] = { 400 to """{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}""" }
        assertEquals(ResultadoAuth.CredencialesInvalidas, auth.entrar("a@x.es", "mal"))
    }
    @Test fun `correo sin confirmar`() {
        s.rutas["/auth/v1/token?grant_type=password"] = { 400 to """{"error_code":"email_not_confirmed","msg":"Email not confirmed"}""" }
        assertEquals(ResultadoAuth.CorreoSinConfirmar, auth.entrar("a@x.es", "x"))
    }
    @Test fun `registro con confirmacion por correo no devuelve sesion`() {
        s.rutas["/auth/v1/signup"] = { 200 to """{"id":"u1","email":"ana@x.es","confirmation_sent_at":"2026-10-06T00:00:00Z"}""" }
        assertEquals(ResultadoAuth.ConfirmarCorreo, auth.registrar("ana@x.es", "clave-larga-1"))
    }
    @Test fun `registro con autoconfirmacion devuelve sesion`() {
        s.rutas["/auth/v1/signup"] = { 200 to sesionJson() }; assertIs<ResultadoAuth.Ok>(auth.registrar("ana@x.es", "clave-larga-1"))
    }
    @Test fun `registro duplicado y contrasena debil`() {
        s.rutas["/auth/v1/signup"] = { 422 to """{"error_code":"user_already_exists","msg":"User already registered"}""" }; assertEquals(ResultadoAuth.UsuarioYaExiste, auth.registrar("a@x.es", "x"))
        s.rutas["/auth/v1/signup"] = { 422 to """{"error_code":"weak_password","msg":"Password should be at least 8 characters"}""" }
        assertEquals(ResultadoAuth.ContrasenaDebil("Password should be at least 8 characters"), auth.registrar("a@x.es", "x"))
    }
    @Test fun `limite de intentos`() {
        s.rutas["/auth/v1/token?grant_type=password"] = { 429 to """{"error_code":"over_request_rate_limit"}""" }; assertEquals(ResultadoAuth.DemasiadosIntentos, auth.entrar("a@x.es", "x"))
    }
    @Test fun `sin red`() = assertEquals(ResultadoAuth.SinConexion, ClienteAuth("http://127.0.0.1:1", "A").entrar("a@x.es", "x"))
    @Test fun `recuperar contrasena no revela si el correo existe`() {
        s.rutas["/auth/v1/recover"] = { 200 to "{}" }; assertEquals(ResultadoAuth.ConfirmarCorreo, auth.recuperarContrasena("cualquiera@x.es"))
    }
    @Test fun `exige https salvo localhost`() { assertFailsWith<IllegalArgumentException> { ClienteAuth("http://evil.example", "k") } }
}

class GestorSesionTest {
    private val s = ServidorFalso(); @AfterTest fun parar() = s.parar()
    private var ahora = 1_000L
    private fun gestor(d: File = Files.createTempDirectory("se").toFile()) = GestorSesion(ClienteAuth(s.url, "ANON", { ahora }), AlmacenSesionArchivo(File(d, "s.json")), { ahora })
    private fun entrar(g: GestorSesion, expira: Long) { s.rutas["/auth/v1/token?grant_type=password"] = { 200 to sesionJson(expira = expira) }; assertTrue(g.iniciar(ClienteAuth(s.url, "A").entrar("a@x.es", "x"))) }

    @Test fun `sin sesion no hay token`() = assertNull(gestor().tokenValido())
    @Test fun `token vigente se devuelve sin tocar la red`() {
        val g = gestor(); entrar(g, expira = 5_000); s.peticiones.clear()
        assertEquals("ACC1", g.tokenValido()); assertTrue(s.peticiones.isEmpty())
    }
    @Test fun `token a punto de caducar se renueva y rota el refresh token`() {
        val g = gestor(); entrar(g, expira = 1_030)    // quedan 30 s < margen 60
        s.rutas["/auth/v1/token?grant_type=refresh_token"] = { 200 to sesionJson("ACC2", "REF2", 9_999) }
        assertEquals("ACC2", g.tokenValido()); assertEquals("REF2", g.actual!!.refreshToken)
        assertTrue(s.peticiones.last().third.contains("REF1"), "usó el refresh token antiguo")
    }
    @Test fun `si el servidor rechaza el refresh la sesion se borra`() {
        val g = gestor(); entrar(g, expira = 1_030)
        s.rutas["/auth/v1/token?grant_type=refresh_token"] = { 400 to """{"error":"invalid_grant","error_description":"Invalid Refresh Token"}""" }
        assertNull(g.tokenValido()); assertNull(g.actual)
    }
    @Test fun `sin red no se pierde la sesion y se usa el token si aun vale`() {
        val d = Files.createTempDirectory("se").toFile(); val g = gestor(d); entrar(g, expira = 1_030)
        val sinRed = GestorSesion(ClienteAuth("http://127.0.0.1:1", "A", { ahora }), AlmacenSesionArchivo(File(d, "s.json")), { ahora })
        assertEquals("ACC1", sinRed.tokenValido(), "30 s de margen: aún válido"); assertNotNull(sinRed.actual)
        ahora = 2_000; assertNull(sinRed.tokenValido(), "caducado y sin red: sin token…"); assertNotNull(sinRed.actual, "…pero la sesión sigue para reintentar")
    }
    @Test fun `cerrar sesion borra lo local aunque falle el servidor`() {
        val g = gestor(); entrar(g, expira = 5_000); s.rutas["/auth/v1/logout"] = { 500 to "{}" }
        g.cerrar(); assertNull(g.actual)
    }
    @Test fun `la sesion sobrevive al reinicio`() {
        val d = Files.createTempDirectory("se").toFile(); entrar(gestor(d), 5_000)
        assertEquals("11111111-1111-4111-8111-111111111111", gestor(d).actual!!.usuarioId)
    }
    @Test fun `un archivo corrupto equivale a no tener sesion`() {
        val d = Files.createTempDirectory("se").toFile(); File(d, "s.json").writeText("{{ basura"); assertNull(gestor(d).actual)
    }
}

class CuentaTest {
    private val s = ServidorFalso(); @AfterTest fun parar() = s.parar()
    private val c get() = ClienteCuenta(s.url, "ANON")

    @Test fun `compra verificada`() {
        s.rutas["/functions/v1/verificar-compra"] = { 200 to """{"premium":true,"estado":"activa","expiracion":"2026-11-01T10:00:00.000Z","producto":"ilusion_premium_mensual","renueva":true}""" }
        val r = c.verificarCompra("JWT", "tok-de-compra-1234"); assertIs<ResultadoCompra.Verificada>(r)
        assertTrue(r.premium); assertEquals("activa", r.estado); assertTrue(r.renueva)
        assertEquals("Bearer JWT", s.peticiones.last().second); assertTrue(s.peticiones.last().third.contains("tok-de-compra-1234"))
    }
    @Test fun `cancelada con tiempo pagado sigue siendo premium`() {
        s.rutas["/functions/v1/verificar-compra"] = { 200 to """{"premium":true,"estado":"cancelada","expiracion":"2026-11-01T10:00:00.000Z","renueva":false}""" }
        val r = c.verificarCompra("J", "t") as ResultadoCompra.Verificada; assertTrue(r.premium); assertFalse(r.renueva)
    }
    @Test fun `errores de compra se distinguen`() {
        fun con(codigo: Int, cuerpo: String): ResultadoCompra { s.rutas["/functions/v1/verificar-compra"] = { codigo to cuerpo }; return c.verificarCompra("J", "t") }
        assertEquals(ResultadoCompra.SinSesion, con(401, """{"codigo":"sin_sesion"}"""))
        assertEquals(ResultadoCompra.CompraDeOtraCuenta, con(409, """{"codigo":"compra_de_otra_cuenta"}"""))
        assertEquals(ResultadoCompra.CompraSinCuenta, con(400, """{"codigo":"compra_sin_cuenta"}"""))
        assertEquals(ResultadoCompra.NoEncontrada, con(404, """{"codigo":"compra_no_encontrada"}"""))
        assertEquals(ResultadoCompra.NoDisponibleAhora, con(502, """{"codigo":"play_no_disponible"}"""))
        assertEquals(ResultadoCompra.NoDisponibleAhora, con(503, """{"error":"servicio no disponible"}"""))
        assertEquals(ResultadoCompra.Otro(500), con(500, """{"error":"error interno"}"""))
        assertEquals(ResultadoCompra.SinConexion, ClienteCuenta("http://127.0.0.1:1", "A").verificarCompra("J", "t"))
    }
    @Test fun `una respuesta 200 corrupta no concede premium`() {
        s.rutas["/functions/v1/verificar-compra"] = { 200 to "no es json" }; assertEquals(ResultadoCompra.Otro(200), c.verificarCompra("J", "t"))
    }
    @Test fun `exportar datos devuelve el json y falla limpio`() {
        s.rutas["/rest/v1/rpc/exportar_mis_datos"] = { 200 to """{"perfil":{"email":"ana@x.es"},"favoritos":[]}""" }
        assertTrue(c.exportarDatos("JWT")!!.contains("ana@x.es"))
        s.rutas["/rest/v1/rpc/exportar_mis_datos"] = { 401 to """{"message":"JWT expired"}""" }; assertNull(c.exportarDatos("JWT"))
        assertNull(ClienteCuenta("http://127.0.0.1:1", "A").exportarDatos("J"))
    }
    @Test fun `leer plan`() {
        s.rutas["/rest/v1/perfiles?select=plan,estado_suscripcion&limit=1"] = { 200 to """[{"plan":"premium","estado_suscripcion":"cancelada"}]""" }
        assertEquals(PlanUsuario(true, "cancelada"), c.leerPlan("JWT")); assertEquals("Bearer JWT", s.peticiones.last().second)
        s.rutas["/rest/v1/perfiles?select=plan,estado_suscripcion&limit=1"] = { 200 to "[]" }; assertNull(c.leerPlan("JWT"), "sin fila: no se asume nada")
        s.rutas["/rest/v1/perfiles?select=plan,estado_suscripcion&limit=1"] = { 401 to "{}" }; assertNull(c.leerPlan("JWT"))
        s.rutas["/rest/v1/perfiles?select=plan,estado_suscripcion&limit=1"] = { 200 to "[{\"plan\":\"gratis\",\"estado_suscripcion\":\"ninguna\"}]" }; assertEquals(PlanUsuario(false, "ninguna"), c.leerPlan("JWT"))
        assertNull(ClienteCuenta("http://127.0.0.1:1", "A").leerPlan("J"))
    }

    @Test fun `borrar cuenta`() {
        s.rutas["/functions/v1/borrar-cuenta"] = { 200 to """{"ok":true}""" }; assertEquals(ResultadoBorrado.Borrada, c.borrarCuenta("J", false))
        assertTrue(s.peticiones.last().third.contains("\"confirmar\":true")); assertTrue(s.peticiones.last().third.contains("\"acepto_suscripcion_activa\":false"))
        s.rutas["/functions/v1/borrar-cuenta"] = { 409 to """{"codigo":"suscripcion_activa"}""" }; assertEquals(ResultadoBorrado.SuscripcionActiva, c.borrarCuenta("J", false))
        s.rutas["/functions/v1/borrar-cuenta"] = { 401 to "{}" }; assertEquals(ResultadoBorrado.SinSesion, c.borrarCuenta("J", true))
        assertEquals(ResultadoBorrado.SinConexion, ClienteCuenta("http://127.0.0.1:1", "A").borrarCuenta("J", true))
    }
}
