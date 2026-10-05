package es.ilusionpantalla.rendimiento

import kotlin.test.*

class PoliticaRendimientoTest {
    private val ok = EstadoDispositivo(bateriaPct = 80, cargando = false, ahorroSistema = false)
    private fun pausa(e: EstadoDispositivo, a: Ajustes = Ajustes()) = (PoliticaRendimiento.decidir(e, a) as Decision.Pausar).motivo

    @Test fun `reproduce con perfil estandar a 30 fps`() =
        assertEquals(Decision.Reproducir(30, 1920), PoliticaRendimiento.decidir(ok, Ajustes()))

    @Test fun `ultra permite 60 pero el limite manual manda`() {
        assertEquals(Decision.Reproducir(60, 3840), PoliticaRendimiento.decidir(ok, Ajustes(perfil = PerfilCalidad.ULTRA)))
        assertEquals(Decision.Reproducir(24, 3840), PoliticaRendimiento.decidir(ok, Ajustes(perfil = PerfilCalidad.ULTRA, fpsLimite = 24)))
    }

    @Test fun `un limite manual no sube por encima del perfil`() =
        assertEquals(Decision.Reproducir(24, 1280), PoliticaRendimiento.decidir(ok, Ajustes(perfil = PerfilCalidad.AHORRO, fpsLimite = 60)))

    @Test fun `pausa si no es visible, pantalla apagada o bloqueada`() {
        assertEquals(MotivoPausa.NO_VISIBLE, pausa(ok.copy(wallpaperVisible = false)))
        assertEquals(MotivoPausa.PANTALLA_APAGADA, pausa(ok.copy(pantallaEncendida = false)))
        assertEquals(MotivoPausa.PANTALLA_BLOQUEADA, pausa(ok.copy(pantallaBloqueada = true)))
    }

    @Test fun `bateria baja pausa solo si no carga y respeta el umbral configurable`() {
        assertEquals(MotivoPausa.BATERIA_BAJA, pausa(ok.copy(bateriaPct = 15)))
        assertIs<Decision.Reproducir>(PoliticaRendimiento.decidir(ok.copy(bateriaPct = 15, cargando = true), Ajustes()))
        assertIs<Decision.Reproducir>(PoliticaRendimiento.decidir(ok.copy(bateriaPct = 5), Ajustes(pausarBateriaBajaPct = 0)))
        assertIs<Decision.Reproducir>(PoliticaRendimiento.decidir(ok.copy(bateriaPct = 16), Ajustes()))
    }

    @Test fun `ahorro del sistema pausa salvo que el usuario lo desactive`() {
        assertEquals(MotivoPausa.AHORRO_SISTEMA, pausa(ok.copy(ahorroSistema = true)))
        assertIs<Decision.Reproducir>(PoliticaRendimiento.decidir(ok.copy(ahorroSistema = true), Ajustes(pausarEnAhorroSistema = false)))
    }

    @Test fun `termico severo pausa y moderado limita`() {
        assertEquals(MotivoPausa.TERMICO_SEVERO, pausa(ok.copy(termico = Termico.SEVERO)))
        assertEquals(Decision.Reproducir(24, 1920), PoliticaRendimiento.decidir(ok.copy(termico = Termico.MODERADO), Ajustes(perfil = PerfilCalidad.ULTRA)))
    }

    @Test fun `juego o videollamada pausan`() = assertEquals(MotivoPausa.APP_EXIGENTE, pausa(ok.copy(appExigenteEnPrimerPlano = true)))

    @Test fun `entradas invalidas se rechazan`() {
        assertFailsWith<IllegalArgumentException> { Ajustes(fpsLimite = 45) }
        assertFailsWith<IllegalArgumentException> { EstadoDispositivo(101, false, false) }
    }
}

class CalidadAdaptativaTest {
    @Test fun `baja tras dos ventanas malas y nunca baja de ahorro`() {
        val c = CalidadAdaptativa(PerfilCalidad.ULTRA)
        c.registrarVentana(0.3); assertEquals(PerfilCalidad.ULTRA, c.actual)
        c.registrarVentana(0.3); assertEquals(PerfilCalidad.ALTA, c.actual)
        repeat(20) { c.registrarVentana(0.5) }
        assertEquals(PerfilCalidad.AHORRO, c.actual)
    }

    @Test fun `sube despacio y no supera el techo del usuario`() {
        val c = CalidadAdaptativa(PerfilCalidad.ALTA)
        repeat(2) { c.registrarVentana(0.5) }
        assertEquals(PerfilCalidad.ESTANDAR, c.actual)
        repeat(4) { c.registrarVentana(0.0) }; assertEquals(PerfilCalidad.ESTANDAR, c.actual)
        c.registrarVentana(0.0); assertEquals(PerfilCalidad.ALTA, c.actual)
        repeat(30) { c.registrarVentana(0.0) }; assertEquals(PerfilCalidad.ALTA, c.actual)
    }

    @Test fun `una ventana intermedia reinicia la racha`() {
        val c = CalidadAdaptativa(PerfilCalidad.ALTA)
        c.registrarVentana(0.3); c.registrarVentana(0.05); c.registrarVentana(0.3)
        assertEquals(PerfilCalidad.ALTA, c.actual)
    }
}

class SelectorArchivoTest {
    private val v720 = VarianteVideo(1280, Codec.H264, 30, 4_000_000)
    private val v1080 = VarianteVideo(1920, Codec.H264, 30, 9_000_000)
    private val v1080h = VarianteVideo(1920, Codec.HEVC, 30, 5_000_000)
    private val v4k = VarianteVideo(3840, Codec.HEVC, 60, 40_000_000)

    @Test fun `prefiere HEVC a igual resolucion si hay hardware`() =
        assertEquals(v1080h, SelectorArchivo.elegir(listOf(v720, v1080, v1080h), 1920, 30, true))

    @Test fun `sin hardware HEVC no lo usa`() =
        assertEquals(v1080, SelectorArchivo.elegir(listOf(v720, v1080, v1080h, v4k), 3840, 60, false))

    @Test fun `respeta techo de resolucion y fps`() =
        assertEquals(v1080h, SelectorArchivo.elegir(listOf(v720, v1080h, v4k), 1920, 30, true))

    @Test fun `si nada cabe devuelve la mas pequena`() =
        assertEquals(v720, SelectorArchivo.elegir(listOf(v1080, v720), 640, 24, true))

    @Test fun `sin variantes usables devuelve null`() {
        assertNull(SelectorArchivo.elegir(emptyList(), 1920, 30, true))
        assertNull(SelectorArchivo.elegir(listOf(v4k), 3840, 60, false))
    }
}
