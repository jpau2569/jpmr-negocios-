package es.ilusionpantalla.rendimiento

enum class Codec { H264, HEVC }

/** Variante de vídeo disponible en el servidor para un wallpaper. */
data class VarianteVideo(val lado: Int, val codec: Codec, val fps: Int, val bytes: Long)

object SelectorArchivo {
    /**
     * Elige la mejor variante que quepa en [ladoMayorMax] y [fps].
     * - Sin soporte HEVC por hardware se descartan las HEVC (evita decodificar por software).
     * - Entre las que caben gana la de mayor lado; a igualdad, HEVC (menos bytes) y luego menor tamaño.
     * - Si ninguna cabe, devuelve la más pequeña disponible (mejor reproducir peor que no reproducir).
     */
    fun elegir(variantes: List<VarianteVideo>, ladoMayorMax: Int, fpsMax: Int, hevcPorHardware: Boolean): VarianteVideo? {
        val usables = variantes.filter { hevcPorHardware || it.codec != Codec.HEVC }
        if (usables.isEmpty()) return null
        val caben = usables.filter { it.lado <= ladoMayorMax && it.fps <= fpsMax }
        return if (caben.isNotEmpty())
            caben.maxWith(compareBy<VarianteVideo> { it.lado }.thenBy { it.codec == Codec.HEVC }.thenByDescending { it.bytes })
        else usables.minWith(compareBy<VarianteVideo> { it.lado }.thenBy { it.fps }.thenBy { it.bytes })
    }
}
