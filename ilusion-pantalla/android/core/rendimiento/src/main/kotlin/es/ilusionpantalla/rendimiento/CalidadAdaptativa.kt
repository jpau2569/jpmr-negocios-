package es.ilusionpantalla.rendimiento

/**
 * Baja el perfil si el reproductor pierde fotogramas y lo sube con cautela cuando todo va bien.
 * Histéresis: bajar es rápido (2 ventanas malas), subir es lento (5 ventanas buenas).
 * Nunca supera el perfil elegido por el usuario ni baja de AHORRO.
 */
class CalidadAdaptativa(private val techo: PerfilCalidad) {
    var actual: PerfilCalidad = techo
        private set
    private var malas = 0
    private var buenas = 0

    /** @param ratioPerdidos fotogramas perdidos / renderizados en la última ventana (0.0..1.0) */
    fun registrarVentana(ratioPerdidos: Double): PerfilCalidad {
        require(ratioPerdidos in 0.0..1.0) { "ratio fuera de rango" }
        when {
            ratioPerdidos > UMBRAL_MALO -> { malas++; buenas = 0 }
            ratioPerdidos < UMBRAL_BUENO -> { buenas++; malas = 0 }
            else -> { malas = 0; buenas = 0 }
        }
        if (malas >= VENTANAS_BAJAR && actual.ordinal > 0) {
            actual = PerfilCalidad.entries[actual.ordinal - 1]; malas = 0
        } else if (buenas >= VENTANAS_SUBIR && actual.ordinal < techo.ordinal) {
            actual = PerfilCalidad.entries[actual.ordinal + 1]; buenas = 0
        }
        return actual
    }

    private companion object {
        const val UMBRAL_MALO = 0.10
        const val UMBRAL_BUENO = 0.02
        const val VENTANAS_BAJAR = 2
        const val VENTANAS_SUBIR = 5
    }
}
