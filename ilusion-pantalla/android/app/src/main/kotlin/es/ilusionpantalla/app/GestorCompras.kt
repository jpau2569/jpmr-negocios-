package es.ilusionpantalla.app

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*
import es.ilusionpantalla.cuenta.ResultadoCompra
import es.ilusionpantalla.cuenta.idOfuscado
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlin.coroutines.resume

/** Un plan mostrable en el paywall: precio y periodo VIENEN DE GOOGLE PLAY (nunca escritos a mano). */
data class PlanPlay(val id: String, val anual: Boolean, val precio: String, val periodoIso: String, internal val detalles: ProductDetails, internal val oferta: String)

sealed interface EventoCompra {
    data class Verificada(val premium: Boolean) : EventoCompra
    data object Pendiente : EventoCompra                      // pago diferido (efectivo, etc.): aún no hay derecho
    data object Cancelada : EventoCompra
    data class Fallo(val mensaje: String) : EventoCompra
}

/**
 * Google Play Billing. Reglas de este flujo:
 *  - La compra se liga a la cuenta con setObfuscatedAccountId(idOfuscado(uid)): el servidor lo exige.
 *  - La app NUNCA concede Premium por sí sola: tras comprar, el servidor verifica con Google; solo su respuesta cuenta.
 *  - El reconocimiento (acknowledge) lo hace el servidor; si el servidor no está disponible la compra queda sin reconocer
 *    y se reintenta al restaurar (Play devuelve el dinero a los 3 días si nunca se reconoce).
 */
class GestorCompras(private val ctx: Context, private val c: Contenedor) {
    private val _eventos = MutableSharedFlow<EventoCompra>(extraBufferCapacity = 8)
    val eventos = _eventos.asSharedFlow()
    private val ambito = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val cliente: BillingClient = BillingClient.newBuilder(ctx)
        .setListener { r, compras -> alActualizar(r, compras) }
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).build()

    private suspend fun conectar(): Boolean = cliente.isReady || suspendCancellableCoroutine { k ->
        cliente.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(r: BillingResult) { if (k.isActive) k.resume(r.responseCode == BillingClient.BillingResponseCode.OK) }
            override fun onBillingServiceDisconnected() {}
        })
    }

    /** Planes con su precio real. Lista vacía si Play no está disponible (emulador sin Play, sin red…). */
    suspend fun planes(): List<PlanPlay> {
        if (!conectar()) return emptyList()
        val params = QueryProductDetailsParams.newBuilder().setProductList(Contenedor.PRODUCTOS.map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(BillingClient.ProductType.SUBS).build() }).build()
        val lista = suspendCancellableCoroutine { k -> cliente.queryProductDetailsAsync(params) { r, l -> if (k.isActive) k.resume(if (r.responseCode == BillingClient.BillingResponseCode.OK) l else emptyList()) } }
        return lista.mapNotNull { pd ->
            val oferta = pd.subscriptionOfferDetails?.firstOrNull() ?: return@mapNotNull null
            val fase = oferta.pricingPhases.pricingPhaseList.lastOrNull() ?: return@mapNotNull null   // la fase que se cobra de forma recurrente
            PlanPlay(pd.productId, anual = fase.billingPeriod == "P1Y", precio = fase.formattedPrice, periodoIso = fase.billingPeriod, detalles = pd, oferta = oferta.offerToken)
        }.sortedBy { it.anual }
    }

    /** Lanza la hoja de pago de Google. Exige sesión (si no, el servidor rechazaría la compra). */
    fun comprar(actividad: Activity, plan: PlanPlay): Boolean {
        val uid = c.sesion.actual?.usuarioId ?: return false
        val flujo = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(plan.detalles).setOfferToken(plan.oferta).build()))
            .setObfuscatedAccountId(idOfuscado(uid)).build()
        return cliente.launchBillingFlow(actividad, flujo).responseCode == BillingClient.BillingResponseCode.OK
    }

    /** «Restaurar compras»: reenvía al servidor cada suscripción que Play dice que tiene este usuario. */
    suspend fun restaurar(): EventoCompra {
        if (!conectar()) return EventoCompra.Fallo("Google Play no está disponible en este dispositivo.")
        val compras = suspendCancellableCoroutine { k ->
            cliente.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()) { r, l -> if (k.isActive) k.resume(if (r.responseCode == BillingClient.BillingResponseCode.OK) l else null) }
        } ?: return EventoCompra.Fallo("No se pudieron consultar tus compras. Inténtalo de nuevo.")
        if (compras.isEmpty()) return EventoCompra.Verificada(premium = false)
        var algunaPremium = false; var ultimoFallo: EventoCompra.Fallo? = null
        for (p in compras.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }) {
            when (val e = verificar(p)) { is EventoCompra.Verificada -> algunaPremium = algunaPremium || e.premium; is EventoCompra.Fallo -> ultimoFallo = e; else -> {} }
        }
        return if (algunaPremium) EventoCompra.Verificada(true) else ultimoFallo ?: EventoCompra.Verificada(false)
    }

    private fun alActualizar(r: BillingResult, compras: List<Purchase>?) {
        when (r.responseCode) {
            BillingClient.BillingResponseCode.OK -> compras.orEmpty().forEach { p -> ambito.launch {
                _eventos.emit(when (p.purchaseState) { Purchase.PurchaseState.PURCHASED -> verificar(p); Purchase.PurchaseState.PENDING -> EventoCompra.Pendiente; else -> EventoCompra.Fallo("Compra no válida.") })
            } }
            BillingClient.BillingResponseCode.USER_CANCELED -> _eventos.tryEmit(EventoCompra.Cancelada)
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> ambito.launch { _eventos.emit(restaurar()) }
            else -> _eventos.tryEmit(EventoCompra.Fallo("No se pudo completar el pago (${r.responseCode}). No se ha cobrado nada hasta que Google lo confirme."))
        }
    }

    private suspend fun verificar(p: Purchase): EventoCompra {
        val token = c.sesion.tokenValido() ?: return EventoCompra.Fallo("Inicia sesión para activar tu compra.")
        return when (val r = c.cuenta.verificarCompra(token, p.purchaseToken)) {
            is ResultadoCompra.Verificada -> { c.refrescarPlan(); EventoCompra.Verificada(r.premium) }
            ResultadoCompra.SinSesion -> EventoCompra.Fallo("Tu sesión ha caducado. Inicia sesión de nuevo.")
            ResultadoCompra.CompraDeOtraCuenta -> EventoCompra.Fallo("Esta compra pertenece a otra cuenta.")
            ResultadoCompra.CompraSinCuenta -> EventoCompra.Fallo("Esa compra se hizo sin sesión y no se puede asociar. Si te cobraron, escríbenos desde Ayuda.")
            ResultadoCompra.NoEncontrada -> EventoCompra.Fallo("Google aún no confirma la compra. Inténtalo en unos minutos con «Restaurar compras».")
            ResultadoCompra.NoDisponibleAhora, ResultadoCompra.SinConexion -> EventoCompra.Fallo("No se pudo verificar ahora. Tu compra está a salvo: usa «Restaurar compras» cuando haya conexión.")
            is ResultadoCompra.Otro -> EventoCompra.Fallo("Error al verificar la compra (${r.codigo}).")
        }
    }
    fun cerrar() { ambito.cancel(); if (cliente.isReady) cliente.endConnection() }
}
