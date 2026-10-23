package es.ilusionpantalla.catalogo

import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import java.io.File
import java.net.InetSocketAddress
import java.nio.file.Files
import java.time.LocalDate
import kotlin.test.*

private fun w(id: String, titulo: String, cat: String = "naturaleza-viva", premium: Boolean = false, dur: Double = 15.0, res: String = "1080x1920",
              color: String = "#3366FF", estilo: String = "natural", tags: List<String> = emptyList(), dest: Int? = null, fecha: String = "2026-01-01T00:00:00Z",
              m: Metricas = Metricas()) =
    Wallpaper(id = id, slug = id, titulo = titulo, categoriaSlug = cat, categoriaNombre = cat, esPremium = premium, duracionS = dur, resolucion = res,
        colorDominante = color, estilo = estilo, etiquetas = tags, destacadoOrden = dest, fechaPublicacion = fecha, metricas = m)

class CatalogoTest {
    private val cat = Catalogo(listOf(
        w("bosque-niebla", "Bosque de Niebla", tags = listOf("bosque", "niebla"), dest = 2, color = "#2E8B57"),
        w("aurora", "Aurora Boreal", "espacio-y-galaxias", premium = true, dur = 20.0, res = "2160x3840", color = "#7C3AED", estilo = "cinematico", dest = 1, m = Metricas(100, 10, 50)),
        w("atico", "Ático con vistas", "casas-de-lujo", premium = true, res = "1440x2560", color = "#C9A227", estilo = "lujo", tags = listOf("terraza", "vistas"), fecha = "2026-03-01T00:00:00Z", m = Metricas(300, 0, 0)),
        w("salon", "Salón minimalista", "arquitectura-e-interiores", dur = 10.0, color = "#EEEEEE", estilo = "minimal", tags = listOf("vistas"), fecha = "2026-02-01T00:00:00Z"),
        w("lluvia", "Lluvia en la ventana", "lluvia-y-calma", color = "#0B0D12", tags = listOf("lluvia")),
    ))

    @Test fun `busqueda ignora tildes y mayusculas y exige todas las palabras`() {
        assertEquals(listOf("atico"), cat.buscar(Filtros(texto = "ATICO")).map { it.id })
        assertEquals(listOf("bosque-niebla"), cat.buscar(Filtros(texto = "bosque niebla")).map { it.id })
        assertTrue(cat.buscar(Filtros(texto = "bosque aurora")).isEmpty())
        assertEquals(setOf("atico", "salon"), cat.buscar(Filtros(texto = "vistas")).map { it.id }.toSet())
    }

    @Test fun `filtros combinados`() {
        assertEquals(setOf("aurora", "atico"), cat.buscar(Filtros(acceso = Acceso.PREMIUM)).map { it.id }.toSet())
        assertEquals(setOf("salon"), cat.buscar(Filtros(duracionMaxS = 10.0)).map { it.id }.toSet())
        assertEquals(setOf("aurora", "atico"), cat.buscar(Filtros(ladoMinimo = 2560)).map { it.id }.toSet())
        assertEquals(setOf("atico"), cat.buscar(Filtros(estilos = setOf("Lujo"))).map { it.id }.toSet())
        assertEquals(setOf("casas-de-lujo"), cat.buscar(Filtros(categorias = setOf("casas-de-lujo"))).map { it.categoriaSlug }.toSet())
        assertEquals(setOf("aurora"), cat.buscar(Filtros(colores = setOf(FamiliaColor.VIOLETA))).map { it.id }.toSet())
        assertEquals(setOf("salon", "lluvia"), cat.buscar(Filtros(colores = setOf(FamiliaColor.NEUTRO))).map { it.id }.toSet())
    }

    @Test fun `familias de color`() {
        assertEquals(FamiliaColor.ROJO, familiaDeColor("#FF0000")); assertEquals(FamiliaColor.VERDE, familiaDeColor("#00FF00"))
        assertEquals(FamiliaColor.AZUL, familiaDeColor("#4D7CFE")); assertEquals(FamiliaColor.TURQUESA, familiaDeColor("#22D3EE"))
        assertEquals(FamiliaColor.NEUTRO, familiaDeColor("#808080")); assertNull(familiaDeColor("rojo")); assertNull(familiaDeColor(null))
    }

    @Test fun `fondo del dia es estable el mismo dia y rota entre destacados`() {
        val d = LocalDate.of(2026, 10, 5)
        assertEquals(cat.fondoDelDia(d), cat.fondoDelDia(d))
        assertNotEquals(cat.fondoDelDia(d)?.id, cat.fondoDelDia(d.plusDays(1))?.id)
        assertTrue(cat.fondoDelDia(d)!!.id in setOf("aurora", "bosque-niebla"))
        assertNull(Catalogo(emptyList()).fondoDelDia(d))
    }

    @Test fun `secciones de inicio`() {
        assertEquals("atico", cat.populares(1).single().id)                     // 300 > 100+20+150=270
        assertEquals(listOf("atico", "salon"), cat.nuevos(2).map { it.id })
        assertEquals(listOf("aurora", "atico"), cat.seleccionPremium().map { it.id })
        assertEquals(setOf("atico", "salon"), cat.arquitectura().map { it.id }.toSet())
    }

    @Test fun `relacionados no incluye el propio y prioriza categoria`() {
        val r = cat.relacionados(cat.items.first { it.id == "salon" })
        assertTrue(r.none { it.id == "salon" }); assertEquals("atico", r.first().id)
        assertTrue(cat.relacionados(w("solo", "Solo", cat = "x", estilo = "y")).isEmpty())
    }

    @Test fun `ids duplicados se descartan`() = assertEquals(1, Catalogo(listOf(w("a", "A"), w("a", "A2"))).items.size)
}

class RedTest {
    private lateinit var srv: HttpServer
    private val cuerpoVideo = ByteArray(300_000) { (it * 31).toByte() }
    @Volatile var cortarA: Int? = null           // simula corte de red a mitad
    @Volatile var ignorarRange = false
    val cabeceras = mutableListOf<Map<String, String>>()
    private val filaJson = """[{"id":"11111111-1111-1111-1111-111111111111","slug":"bosque","titulo":"Bosque","descripcion":null,"categoria_slug":"naturaleza-viva",
        "categoria_nombre":"Naturaleza viva","etiquetas":["bosque"],"tipo":"video","orientacion":"vertical","duracion_s":15.00,"resolucion":"1080x1920","fps_recomendado":30,
        "perfil_rendimiento":"estandar","tamano_archivo_bytes":9000000,"consumo_estimado":"medio","color_dominante":"#2E8B57","estilo":"natural","url_preview":null,
        "url_thumbnail":"https://img.x/t.webp","url_poster":null,"es_premium":false,"destacado_orden":null,"fecha_publicacion":"2026-01-01T00:00:00+00:00",
        "metricas":{"descargas":3,"aplicaciones":1,"favoritos":0},"campo_futuro":123}]"""

    @BeforeTest fun arrancar() {
        srv = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        srv.createContext("/rest/v1/catalogo_publico") { x -> registrar(x); responder(x, 200, filaJson) }
        srv.createContext("/functions/v1/wallpaper-url") { x ->
            registrar(x); val b = x.requestBody.readBytes().toString(Charsets.UTF_8)
            when {
                b.contains("premium-id") -> responder(x, 402, """{"codigo":"premium_requerido"}""")
                b.contains("fantasma") -> responder(x, 404, "{}")
                b.contains("roto") -> responder(x, 200, "no es json")
                else -> responder(x, 200, """{"url":"http://127.0.0.1:${srv.address.port}/video.mp4","calidad":"q1080","codec":"h264","fps":30,"tamano_bytes":${cuerpoVideo.size},"caduca_en_s":600}""")
            }
        }
        srv.createContext("/video.mp4") { x ->
            val rango = x.requestHeaders.getFirst("Range")
            var ini = 0; var codigo = 200
            if (rango != null && !ignorarRange) { ini = rango.removePrefix("bytes=").removeSuffix("-").toInt(); codigo = if (ini >= cuerpoVideo.size) 416 else 206 }
            if (codigo == 416) { x.sendResponseHeaders(416, -1); x.close(); return@createContext }
            val fin = cortarA?.also { cortarA = null } ?: cuerpoVideo.size
            x.sendResponseHeaders(codigo, (cuerpoVideo.size - ini).toLong())    // longitud anunciada completa
            x.responseBody.use { it.write(cuerpoVideo, ini, fin - ini) }
        }
        srv.start()
    }
    @AfterTest fun parar() = srv.stop(0)

    private fun registrar(x: HttpExchange) { cabeceras += x.requestHeaders.entries.associate { it.key.lowercase() to it.value.first() } }
    private fun responder(x: HttpExchange, c: Int, t: String) { val b = t.toByteArray(); x.sendResponseHeaders(c, b.size.toLong()); x.responseBody.use { it.write(b) } }
    private fun cliente() = ClienteSupabase("http://127.0.0.1:${srv.address.port}", "ANON")
    private fun tmp() = Files.createTempDirectory("ip").toFile()

    @Test fun `catalogo se parsea ignorando campos nuevos y usa solo la clave anonima`() {
        val l = cliente().descargarCatalogo()
        assertEquals("Bosque", l.single().titulo); assertEquals(1920, l.single().ladoMayor); assertEquals(3, l.single().metricas.descargas)
        assertEquals("ANON", cabeceras.last()["apikey"]); assertEquals("Bearer ANON", cabeceras.last()["authorization"])
    }

    @Test fun `url de descarga con sesion y casos 402 404 y respuesta rota`() {
        val c = cliente()
        val ok = c.pedirUrl("bosque", CalidadDescarga.Q1080, true, 30, "TOKEN_USUARIO")
        assertIs<RespuestaUrl.Lista>(ok); assertEquals(300_000, ok.tamanoBytes)
        assertEquals("Bearer TOKEN_USUARIO", cabeceras.last()["authorization"])
        assertEquals(RespuestaUrl.PremiumRequerido, c.pedirUrl("premium-id", CalidadDescarga.Q1080, true, 30, null))
        assertEquals(RespuestaUrl.NoEncontrado, c.pedirUrl("fantasma", CalidadDescarga.Q1080, true, 30, null))
        assertIs<RespuestaUrl.Fallo>(c.pedirUrl("roto", CalidadDescarga.Q1080, true, 30, null))
    }

    @Test fun `sin conexion devuelve Fallo y el repositorio cae a la copia local`() {
        val dir = tmp(); val almacen = AlmacenCatalogo(File(dir, "c.json"))
        val vivo = RepositorioCatalogo(cliente(), almacen)
        assertIs<RepositorioCatalogo.Resultado.Fresco>(vivo.obtener())
        val muerto = ClienteSupabase("http://127.0.0.1:1", "ANON", timeoutMs = 500)
        assertIs<RespuestaUrl.Fallo>(muerto.pedirUrl("x", CalidadDescarga.Q720, false, 24, null))
        val r = RepositorioCatalogo(muerto, almacen).obtener()
        assertIs<RepositorioCatalogo.Resultado.DesdeCopia>(r); assertEquals("Bosque", r.catalogo.items.single().titulo)
        assertIs<RepositorioCatalogo.Resultado.SinDatos>(RepositorioCatalogo(muerto, AlmacenCatalogo(File(dir, "no-existe.json"))).obtener())
    }

    @Test fun `copia local corrupta se ignora`() {
        val f = File(tmp(), "c.json"); f.writeText("{{{ basura"); assertNull(AlmacenCatalogo(f).cargar())
    }

    @Test fun `descarga completa y no repite si ya existe`() {
        val d = Descargador(tmp()); val url = "http://127.0.0.1:${srv.address.port}/video.mp4"
        var ultimo = 0L
        val f = d.descargar(url, "bosque_q1080.mp4", 300_000L, progreso = { h, _ -> ultimo = h })
        assertContentEquals(cuerpoVideo, f.readBytes()); assertEquals(300_000L, ultimo); assertFalse(File(f.path + ".part").exists())
        val antes = cabeceras.size; d.descargar(url, "bosque_q1080.mp4", 300_000L); assertEquals(antes, cabeceras.size, "no debe volver a pedir")
    }

    @Test fun `reanuda tras un corte con Range`() {
        val d = Descargador(tmp()); val url = "http://127.0.0.1:${srv.address.port}/video.mp4"
        cortarA = 100_000
        assertFailsWith<java.io.IOException> { d.descargar(url, "v.mp4", 300_000L) }
        assertFalse(d.archivo("v.mp4").exists(), "nunca queda un archivo final a medias")
        assertEquals(100_000L, File(d.archivo("v.mp4").path + ".part").length())
        val f = d.descargar(url, "v.mp4", 300_000L)
        assertContentEquals(cuerpoVideo, f.readBytes())
    }

    @Test fun `si el servidor ignora Range reinicia sin corromper`() {
        val d = Descargador(tmp()); val url = "http://127.0.0.1:${srv.address.port}/video.mp4"
        cortarA = 50_000; assertFailsWith<java.io.IOException> { d.descargar(url, "v.mp4", 300_000L) }
        ignorarRange = true
        assertContentEquals(cuerpoVideo, d.descargar(url, "v.mp4", 300_000L).readBytes())
    }

    @Test fun `cancelar conserva el parcial y tamano distinto al esperado falla`() {
        val d = Descargador(tmp()); val url = "http://127.0.0.1:${srv.address.port}/video.mp4"
        assertFailsWith<DescargaCancelada> { d.descargar(url, "v.mp4", 300_000L, cancelada = { true }) }
        assertFailsWith<DescargaIncompleta> { d.descargar(url, "w.mp4", 999L) }
        assertFalse(d.archivo("w.mp4").exists())
    }

    @Test fun `rechaza nombres peligrosos y urls http remotas`() {
        val d = Descargador(tmp())
        for (n in listOf("../x.mp4", "a/b.mp4", "..", "")) assertFailsWith<IllegalArgumentException> { d.archivo(n) }
        assertFailsWith<IllegalArgumentException> { d.descargar("http://evil.example/v.mp4", "v.mp4", null) }
        assertFailsWith<IllegalArgumentException> { ClienteSupabase("http://evil.example", "k") }
    }
}

class PoliticaCacheTest {
    private val e = listOf(EntradaCache("a", 100, 1), EntradaCache("b", 100, 2), EntradaCache("c", 100, 3), EntradaCache("d", 100, 4))
    @Test fun `borra los menos usados hasta caber`() = assertEquals(listOf("a", "b"), PoliticaCache.aEliminar(e, 200, emptySet()))
    @Test fun `no borra nada si cabe`() = assertTrue(PoliticaCache.aEliminar(e, 400, emptySet()).isEmpty())
    @Test fun `los protegidos sobreviven aunque no se llegue al limite`() = assertEquals(listOf("b", "c", "d"), PoliticaCache.aEliminar(e, 0, setOf("a")))
    @Test fun `limite negativo se rechaza`() { assertFailsWith<IllegalArgumentException> { PoliticaCache.aEliminar(e, -1, emptySet()) } }
}
