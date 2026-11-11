package es.ilusionpantalla.rendimiento

/**
 * Decide si el wallpaper debe reproducir y a qué FPS/resolución máxima.
 * Pura y determinista: sin Android, sin reloj. Orden de prioridad = orden de los `if`.
 */
object PoliticaRendimiento {

    fun decidir(estado: EstadoDispositivo, ajustes: Ajustes): Decision {
        if (!estado.wallpaperVisible) return Decision.Pausar(MotivoPausa.NO_VISIBLE)
        if (!estado.pantallaEncendida) return Decision.Pausar(MotivoPausa.PANTALLA_APAGADA)
        // Regla de producto: con el móvil bloqueado no se renderiza (ahorra batería).
        if (estado.pantallaBloqueada) return Decision.Pausar(MotivoPausa.PANTALLA_BLOQUEADA)
        if (estado.termico == Termico.SEVERO) return Decision.Pausar(MotivoPausa.TERMICO_SEVERO)
        if (ajustes.pausarEnAhorroSistema && estado.ahorroSistema) return Decision.Pausar(MotivoPausa.AHORRO_SISTEMA)
        if (ajustes.pausarBateriaBajaPct > 0 && !estado.cargando && estado.bateriaPct <= ajustes.pausarBateriaBajaPct)
            return Decision.Pausar(MotivoPausa.BATERIA_BAJA)
        if (estado.appExigenteEnPrimerPlano) return Decision.Pausar(MotivoPausa.APP_EXIGENTE)

        var fps = minOf(ajustes.perfil.fpsMax, ajustes.fpsLimite ?: Int.MAX_VALUE)
        var lado = ajustes.perfil.ladoMayorMax
        if (estado.termico == Termico.MODERADO) { fps = minOf(fps, 24); lado = minOf(lado, 1920) }
        return Decision.Reproducir(fps, lado)
    }
}
