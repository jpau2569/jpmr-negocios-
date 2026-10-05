package es.ilusionpantalla.rendimiento

/** Perfil elegido por el usuario. Define los techos de FPS y de resolución. */
enum class PerfilCalidad(val fpsMax: Int, val ladoMayorMax: Int) {
    AHORRO(24, 1280),
    ESTANDAR(30, 1920),
    ALTA(30, 2560),
    ULTRA(60, 3840);
}

enum class Termico { NORMAL, MODERADO, SEVERO }

/** Ajustes persistidos (DataStore). */
data class Ajustes(
    val perfil: PerfilCalidad = PerfilCalidad.ESTANDAR,
    /** Límite manual de FPS: 24, 30 o 60. null = lo decide el perfil. */
    val fpsLimite: Int? = null,
    val calidadAdaptativa: Boolean = true,
    /** Por debajo de este % (sin cargar) se pausa. 0 = nunca. */
    val pausarBateriaBajaPct: Int = 15,
    val pausarEnAhorroSistema: Boolean = true,
    val soloWifi: Boolean = true,
) {
    init {
        require(fpsLimite == null || fpsLimite in listOf(24, 30, 60)) { "fpsLimite debe ser 24, 30 o 60" }
        require(pausarBateriaBajaPct in 0..50) { "pausarBateriaBajaPct fuera de rango" }
    }
}

/** Foto del estado del dispositivo en el instante de decidir. */
data class EstadoDispositivo(
    val bateriaPct: Int,
    val cargando: Boolean,
    val ahorroSistema: Boolean,
    val termico: Termico = Termico.NORMAL,
    val pantallaEncendida: Boolean = true,
    val pantallaBloqueada: Boolean = false,
    val wallpaperVisible: Boolean = true,
    /** Juego o videollamada en primer plano (requiere permiso de uso; si no se tiene, siempre false). */
    val appExigenteEnPrimerPlano: Boolean = false,
) {
    init { require(bateriaPct in 0..100) { "bateriaPct fuera de rango" } }
}

enum class MotivoPausa {
    NO_VISIBLE, PANTALLA_APAGADA, PANTALLA_BLOQUEADA, BATERIA_BAJA, AHORRO_SISTEMA, TERMICO_SEVERO, APP_EXIGENTE
}

sealed interface Decision {
    data class Reproducir(val fps: Int, val ladoMayorMax: Int) : Decision
    data class Pausar(val motivo: MotivoPausa) : Decision
}
