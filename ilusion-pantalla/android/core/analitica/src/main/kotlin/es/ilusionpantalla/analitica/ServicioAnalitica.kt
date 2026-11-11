package es.ilusionpantalla.analitica

/** Orquesta consentimiento, cola y envío. El resto de la app solo usa [registrar], [sincronizar] y las acciones de privacidad. */
class ServicioAnalitica(
    val consentimiento: GestorConsentimiento,
    private val cola: ColaEventos,
    private val cliente: ClienteAnalitica,
    private val tamanoLote: Int = 50,
) {
    fun registrar(e: Evento): Boolean = cola.registrar(e)

    // Estas tres solo cambian el estado LOCAL (instantáneo, seguro en el hilo principal). El aviso al servidor
    // se hace después con [sincronizar], que usa la red y por tanto debe llamarse fuera del hilo principal.
    fun conceder() = consentimiento.conceder()
    fun denegar() { consentimiento.denegar(); cola.vaciar() }
    /** «Borrar mis datos de analítica» (RGPD, supresión): revoca, vacía la cola local y deja pendiente borrar lo ya enviado. */
    fun revocarYBorrar() { consentimiento.revocarYBorrar(); cola.vaciar() }

    /**
     * Pone al día el servidor y vacía la cola mientras haya red. Llamar al abrir la app, al pasar a segundo plano
     * y desde WorkManager. Devuelve true si no quedó nada pendiente. Idempotente y seguro de llamar varias veces.
     */
    @Synchronized
    fun sincronizar(): Boolean {
        // 1) Obligaciones de privacidad primero (revocaciones y borrados), aunque ya no haya consentimiento.
        for (id in consentimiento.borradosPendientes) when (cliente.borrar(id)) {
            is ResultadoEnvio.Ok, is ResultadoEnvio.Permanente -> consentimiento.borradoEnviado(id)
            ResultadoEnvio.Transitorio -> return false
        }
        for (id in consentimiento.revocacionesPendientes) when (cliente.consentimiento(id, false, consentimiento.versionActual)) {
            is ResultadoEnvio.Ok, is ResultadoEnvio.Permanente -> consentimiento.revocacionEnviada(id)
            ResultadoEnvio.Transitorio -> return false
        }
        // 1b) Alta del consentimiento vigente (el servidor lo exige antes de aceptar eventos).
        if (consentimiento.pendienteAlta) {
            val id = consentimiento.instalacionId ?: return true
            when (cliente.consentimiento(id, true, consentimiento.versionActual)) {
                is ResultadoEnvio.Ok -> consentimiento.altaEnviada()
                is ResultadoEnvio.Permanente -> return false         // p. ej. 409: la app tiene un texto desactualizado; no enviar eventos
                ResultadoEnvio.Transitorio -> return false
            }
        }
        // 2) Sin consentimiento vigente la cola se descarta, nunca se envía.
        if (!consentimiento.analiticaPermitida) { cola.vaciar(); return true }
        val id = consentimiento.instalacionId ?: return true
        // 3) Vaciado por lotes.
        while (cola.tamano() > 0) {
            val lote = cola.siguienteLote(tamanoLote)
            when (val r = cliente.eventos(id, lote)) {
                is ResultadoEnvio.Ok -> {
                    if (r.motivo == "sin_consentimiento") {
                        // El servidor no conoce nuestro consentimiento (p. ej. falló el aviso): reenviarlo y reintentar una vez.
                        if (cliente.consentimiento(id, true, consentimiento.versionActual) !is ResultadoEnvio.Ok) return false
                        val r2 = cliente.eventos(id, lote)
                        if (r2 !is ResultadoEnvio.Ok || r2.motivo == "sin_consentimiento") return false
                    }
                    cola.confirmar(lote.size)
                }
                is ResultadoEnvio.Permanente -> cola.confirmar(lote.size)   // lote que el servidor nunca aceptará: descartarlo
                ResultadoEnvio.Transitorio -> return false
            }
        }
        return true
    }
}
