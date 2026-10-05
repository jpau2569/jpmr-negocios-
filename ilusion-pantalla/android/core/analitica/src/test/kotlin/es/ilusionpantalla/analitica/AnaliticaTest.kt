package es.ilusionpantalla.analitica

import com.sun.net.httpserver.HttpServer
import kotlinx.serialization.json.*
import java.io.File
import java.net.InetSocketAddress
import java.nio.file.Files
import kotlin.test.*

private val SPEC: JsonObject = Json.parseToJsonElement(File("../../../supabase/functions/_shared/eventos.json").readText()).jsonObject
private val V = SPEC["consentimiento_version"]!!.jsonPrimitive.content

private fun tmp() = Files.createTempDirectory("an").toFile()
private fun gestor(d: File = tmp(), v: String = V) = GestorConsentimiento(File(d, "consent.json"), v)

class EsquemaTest {
    private val ejemplos: List<Evento> = listOf(
        Evento.AppAbierta("0.2.0", 34, true), Evento.WallpaperVisto("bosque-niebla", Origen.INICIO), Evento.Busqueda(7, false),
        Evento.FavoritoAlternado("aurora", true), Evento.DescargaIniciada("aurora", CalidadEv.Q1080), Evento.DescargaCompletada("aurora", CalidadEv.Q1440, 1234),
        Evento.DescargaFallida("aurora", MotivoDescarga.RED), Evento.WallpaperAplicado("aurora"), Evento.WallpaperActivado("aurora", PerfilEv.ULTRA), Evento.AjusteCambiado(AjusteEv.FPS),
    )
    private val tipos = SPEC["tipos"]!!.jsonObject
    private val eventos = SPEC["eventos"]!!.jsonObject

    @Test fun `cada evento del servidor tiene su clase Kotlin y viceversa`() =
        assertEquals(eventos.keys, ejemplos.map { it.nombre }.toSet())

    @Test fun `las propiedades de cada evento cumplen exactamente el esquema del servidor`() {
        for (e in ejemplos) {
            val def = eventos[e.nombre]!!.jsonObject
            assertEquals(def.keys, e.propiedades.keys, "claves de ${e.nombre}")        // ni faltan ni sobran
            for ((clave, valor) in e.propiedades) {
                val t = tipos[def[clave]!!.jsonArray[0].jsonPrimitive.content]!!.jsonObject
                when (t["tipo"]!!.jsonPrimitive.content) {
                    "bool" -> assertIs<Boolean>(valor)
                    "int" -> { assertIs<Int>(valor); assertTrue(valor in t["min"]!!.jsonPrimitive.int..t["max"]!!.jsonPrimitive.int, "$clave fuera de rango") }
                    "enum" -> assertTrue(valor in t["valores"]!!.jsonArray.map { it.jsonPrimitive.content }, "$clave=$valor no está en el enum")
                    "str" -> { val s = valor as String; assertTrue(s.length <= t["max"]!!.jsonPrimitive.int && Regex(t["patron"]!!.jsonPrimitive.content).matches(s), "$clave inválido: $s") }
                }
            }
        }
    }

    @Test fun `la version del texto legal coincide con la del servidor`() = assertEquals(V, TextoLegal.VERSION)

    @Test fun `los enums de Kotlin coinciden con los del servidor`() {
        fun valores(t: String) = tipos[t]!!.jsonObject["valores"]!!.jsonArray.map { it.jsonPrimitive.content }.toSet()
        assertEquals(valores("origen"), Origen.entries.map { it.codigo }.toSet())
        assertEquals(valores("calidad"), CalidadEv.entries.map { it.codigo }.toSet())
        assertEquals(valores("perfil"), PerfilEv.entries.map { it.codigo }.toSet())
        assertEquals(valores("motivo_descarga"), MotivoDescarga.entries.map { it.codigo }.toSet())
        assertEquals(valores("ajuste"), AjusteEv.entries.map { it.codigo }.toSet())
    }

    @Test fun `no existe ningun tipo de texto libre en el esquema`() {
        for ((nombre, t) in tipos) if (t.jsonObject["tipo"]!!.jsonPrimitive.content == "str")
            assertTrue(t.jsonObject.containsKey("patron"), "el tipo '$nombre' es texto libre sin patrón")
    }

    @Test fun `los constructores rechazan slugs y versiones peligrosos`() {
        for (mal in listOf("Ana García", "<script>", "a".repeat(61), "", "con espacio", "x@y.es")) assertFailsWith<IllegalArgumentException> { Evento.WallpaperVisto(mal, Origen.INICIO) }
        assertFailsWith<IllegalArgumentException> { Evento.AppAbierta("versión con espacios", 34, true) }
        assertEquals(100_000, Evento.Busqueda(999_999, true).propiedades["resultados"])
    }
}

class ConsentimientoTest {
    @Test fun `estado inicial no permite nada y no crea identificador`() {
        val g = gestor(); assertEquals(EstadoConsentimiento.SIN_PREGUNTAR, g.estado)
        assertTrue(g.debePreguntar); assertFalse(g.analiticaPermitida); assertNull(g.instalacionId)
    }
    @Test fun `denegar la primera vez no deja rastro`() {
        val d = tmp(); val g = gestor(d); g.denegar()
        assertEquals(EstadoConsentimiento.DENEGADO, g.estado); assertFalse(g.debePreguntar); assertNull(g.instalacionId)
        assertTrue(g.revocacionesPendientes.isEmpty() && g.borradosPendientes.isEmpty(), "no hay nada que avisar al servidor")
        assertFalse(File(d, "consent.json").readText().contains("-4"), "ningún UUID guardado")
    }
    @Test fun `conceder crea un id estable que sobrevive al reinicio`() {
        val d = tmp(); val g = gestor(d); g.conceder()
        val id = g.instalacionId!!; assertTrue(Regex("^[0-9a-f-]{36}$").matches(id))
        val g2 = gestor(d); assertTrue(g2.analiticaPermitida); assertEquals(id, g2.instalacionId); assertTrue(g2.pendienteAlta)
    }
    @Test fun `un texto nuevo invalida el consentimiento hasta volver a aceptar`() {
        val d = tmp(); gestor(d, "v1").conceder()
        val g = gestor(d, "v2"); assertEquals(EstadoConsentimiento.TEXTO_NUEVO, g.estado)
        assertFalse(g.analiticaPermitida); assertTrue(g.debePreguntar); assertNull(g.instalacionId)
        g.conceder(); assertTrue(g.analiticaPermitida)
    }
    @Test fun `archivo corrupto equivale a no haber preguntado`() {
        val d = tmp(); File(d, "consent.json").writeText("{{ corrupto"); assertEquals(EstadoConsentimiento.SIN_PREGUNTAR, gestor(d).estado)
    }
    @Test fun `revocar retira el id activo y lo deja pendiente de avisar`() {
        val g = gestor(); g.conceder(); val id = g.instalacionId!!; g.denegar()
        assertNull(g.instalacionId); assertEquals(listOf(id), g.revocacionesPendientes)
    }
}

class ColaTest {
    @Test fun `sin consentimiento no se escribe nada`() {
        val d = tmp(); val c = ColaEventos(File(d, "cola.json"), gestor(d))
        assertFalse(c.registrar(Evento.WallpaperAplicado("a"))); assertEquals(0, c.tamano()); assertFalse(File(d, "cola.json").exists())
    }
    @Test fun `con consentimiento persiste y se recupera`() {
        val d = tmp(); val g = gestor(d); g.conceder()
        ColaEventos(File(d, "cola.json"), g).apply { registrar(Evento.WallpaperAplicado("a")); registrar(Evento.AjusteCambiado(AjusteEv.WIFI)) }
        assertEquals(2, ColaEventos(File(d, "cola.json"), g).tamano())
    }
    @Test fun `el limite descarta lo mas antiguo`() {
        val d = tmp(); val g = gestor(d); g.conceder(); val c = ColaEventos(File(d, "cola.json"), g, maximo = 3)
        repeat(5) { c.registrar(Evento.WallpaperAplicado("w$it")) }
        assertEquals(3, c.tamano()); assertEquals(listOf("w2", "w3", "w4"), c.siguienteLote(10).map { it.first.propiedades["wallpaper_slug"]!!.jsonPrimitive.content })
    }
    @Test fun `la antiguedad se calcula al enviar`() {
        val d = tmp(); val g = gestor(d); g.conceder(); var t = 1_000_000L
        val c = ColaEventos(File(d, "cola.json"), g, reloj = { t }); c.registrar(Evento.WallpaperAplicado("a")); t += 90_000
        assertEquals(90, c.siguienteLote(1).single().second)
    }
}

class ServicioTest {
    private lateinit var srv: HttpServer
    private val peticiones = mutableListOf<JsonObject>()
    @Volatile var responder: (JsonObject) -> Pair<Int, String> = { b -> 200 to if (b["accion"]!!.jsonPrimitive.content == "eventos") """{"guardados":${b["eventos"]!!.jsonArray.size},"descartados":0}""" else """{"ok":true}""" }
    private val acciones get() = peticiones.map { it["accion"]!!.jsonPrimitive.content }

    @BeforeTest fun arrancar() {
        srv = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        srv.createContext("/functions/v1/analitica") { x ->
            val b = Json.parseToJsonElement(x.requestBody.readBytes().toString(Charsets.UTF_8)).jsonObject; synchronized(peticiones) { peticiones += b }
            val (c, t) = responder(b); val bytes = t.toByteArray(); x.sendResponseHeaders(c, bytes.size.toLong()); x.responseBody.use { it.write(bytes) }
        }
        srv.start()
    }
    @AfterTest fun parar() = srv.stop(0)

    private fun servicio(d: File = tmp(), puerto: Int = srv.address.port, lote: Int = 50): Triple<ServicioAnalitica, GestorConsentimiento, ColaEventos> {
        val g = gestor(d); val c = ColaEventos(File(d, "cola.json"), g)
        return Triple(ServicioAnalitica(g, c, ClienteAnalitica("http://127.0.0.1:$puerto", "ANON", timeoutMs = 800), lote), g, c)
    }

    @Test fun `denegar la primera vez no hace ninguna peticion`() {
        val (s, _, c) = servicio(); s.denegar(); s.sincronizar(); assertFalse(s.registrar(Evento.WallpaperAplicado("a"))); s.sincronizar()
        assertTrue(peticiones.isEmpty()); assertEquals(0, c.tamano())
    }

    @Test fun `conceder envia primero el consentimiento y luego los eventos, sin datos personales`() {
        val (s, g, _) = servicio(); s.conceder(); s.registrar(Evento.WallpaperVisto("aurora", Origen.EXPLORAR)); s.registrar(Evento.Busqueda(4, true)); assertTrue(s.sincronizar())
        assertEquals(listOf("consentimiento", "eventos"), acciones)
        assertEquals(g.instalacionId, peticiones[1]["instalacion_id"]!!.jsonPrimitive.content)
        assertEquals(V, peticiones[0]["version_texto"]!!.jsonPrimitive.content); assertTrue(peticiones[0]["concedido"]!!.jsonPrimitive.boolean)
        val bruto = peticiones[1].toString()
        for (prohibido in listOf("email", "usuario", "nombre", "advertising", "imei", "texto", "query")) assertFalse(bruto.contains(prohibido), "el lote contiene '$prohibido'")
        assertEquals(setOf("evento", "propiedades", "hace_s"), peticiones[1]["eventos"]!!.jsonArray[0].jsonObject.keys)
    }

    @Test fun `sin red conserva la cola y la envia cuando vuelve`() {
        val d = tmp(); val (caido, g, c) = servicio(d, puerto = 1); caido.conceder(); caido.registrar(Evento.WallpaperAplicado("a"))
        assertFalse(caido.sincronizar()); assertEquals(1, c.tamano()); assertTrue(g.pendienteAlta)
        val (vivo, _, c2) = servicio(d); assertEquals(1, c2.tamano(), "la cola sobrevive al reinicio")
        assertTrue(vivo.sincronizar()); assertEquals(0, c2.tamano()); assertEquals(listOf("consentimiento", "eventos"), acciones)
    }

    @Test fun `120 eventos salen en lotes de 50`() {
        val (s, _, c) = servicio(); s.conceder(); repeat(120) { s.registrar(Evento.WallpaperAplicado("w")) }; assertTrue(s.sincronizar())
        assertEquals(listOf(50, 50, 20), peticiones.filter { it["accion"]!!.jsonPrimitive.content == "eventos" }.map { it["eventos"]!!.jsonArray.size }); assertEquals(0, c.tamano())
    }

    @Test fun `si el servidor dice sin_consentimiento reenvia el consentimiento y reintenta`() {
        var primera = true
        responder = { b -> when (b["accion"]!!.jsonPrimitive.content) {
            "eventos" -> if (primera) { primera = false; 200 to """{"guardados":0,"descartados":1,"motivo":"sin_consentimiento"}""" } else 200 to """{"guardados":1,"descartados":0}"""
            else -> 200 to """{"ok":true}""" } }
        val (s, _, c) = servicio(); s.conceder(); s.registrar(Evento.WallpaperAplicado("a")); assertTrue(s.sincronizar())
        assertEquals(listOf("consentimiento", "eventos", "consentimiento", "eventos"), acciones); assertEquals(0, c.tamano())
    }

    @Test fun `un lote rechazado con 400 se descarta y no bloquea la cola`() {
        responder = { b -> if (b["accion"]!!.jsonPrimitive.content == "eventos") 400 to """{"error":"x"}""" else 200 to "{}" }
        val (s, _, c) = servicio(); s.conceder(); s.registrar(Evento.WallpaperAplicado("a")); assertTrue(s.sincronizar()); assertEquals(0, c.tamano())
    }

    @Test fun `un 500 conserva el lote para reintentar`() {
        responder = { b -> if (b["accion"]!!.jsonPrimitive.content == "eventos") 500 to "{}" else 200 to "{}" }
        val (s, _, c) = servicio(); s.conceder(); s.registrar(Evento.WallpaperAplicado("a")); assertFalse(s.sincronizar()); assertEquals(1, c.tamano())
    }

    @Test fun `revocar vacia la cola, avisa y deja de registrar`() {
        val (s, g, c) = servicio(); s.conceder(); s.sincronizar(); s.registrar(Evento.WallpaperAplicado("a"))
        val id = g.instalacionId!!; peticiones.clear(); s.denegar(); s.sincronizar()
        assertEquals(0, c.tamano()); assertFalse(s.registrar(Evento.WallpaperAplicado("b")))
        assertEquals(listOf("consentimiento"), acciones); assertFalse(peticiones[0]["concedido"]!!.jsonPrimitive.boolean); assertEquals(id, peticiones[0]["instalacion_id"]!!.jsonPrimitive.content)
        assertTrue(g.revocacionesPendientes.isEmpty())
    }

    @Test fun `borrar mis datos pide el borrado y limpia el estado`() {
        val (s, g, _) = servicio(); s.conceder(); s.sincronizar(); val id = g.instalacionId!!; peticiones.clear()
        s.revocarYBorrar(); s.sincronizar(); assertEquals(listOf("borrar"), acciones); assertEquals(id, peticiones[0]["instalacion_id"]!!.jsonPrimitive.content)
        assertTrue(g.borradosPendientes.isEmpty() && g.revocacionesPendientes.isEmpty()); assertNull(g.instalacionId)
    }

    @Test fun `borrado pendiente sin red nunca puede alcanzar los datos del nuevo consentimiento`() {
        val d = tmp(); val (caido, g1, _) = servicio(d, puerto = 1)
        caido.conceder(); val viejo = g1.instalacionId!!; caido.revocarYBorrar(); caido.sincronizar()        // sin red: queda pendiente
        assertEquals(listOf(viejo), g1.borradosPendientes)
        val (vivo, g2, _) = servicio(d); vivo.conceder(); val nuevo = g2.instalacionId!!
        assertNotEquals(viejo, nuevo, "tras revocar, aceptar crea un identificador nuevo")
        vivo.registrar(Evento.WallpaperAplicado("a")); assertTrue(vivo.sincronizar())
        val borrados = peticiones.filter { it["accion"]!!.jsonPrimitive.content == "borrar" }.map { it["instalacion_id"]!!.jsonPrimitive.content }
        assertEquals(listOf(viejo), borrados, "solo se borra el id viejo; jamás el nuevo")
        assertEquals(listOf("borrar", "consentimiento", "eventos"), acciones)
    }

    @Test fun `texto nuevo no registra ni envia hasta aceptar`() {
        val d = tmp(); gestor(d, "v1").conceder()
        val g = gestor(d, "v2"); val c = ColaEventos(File(d, "cola.json"), g); val s = ServicioAnalitica(g, c, ClienteAnalitica("http://127.0.0.1:${srv.address.port}", "A"))
        assertFalse(s.registrar(Evento.WallpaperAplicado("a"))); s.sincronizar(); assertTrue(peticiones.isEmpty())
    }
}
