package es.ilusionpantalla.app.ui.pantallas

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import es.ilusionpantalla.analitica.Evento
import es.ilusionpantalla.analitica.MotivoPaywall
import es.ilusionpantalla.analitica.PlanEv
import es.ilusionpantalla.app.*
import es.ilusionpantalla.cuenta.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private tailrec fun Context.actividad(): Activity? = when (this) { is Activity -> this; is ContextWrapper -> baseContext.actividad(); else -> null }
private const val URL_SUSCRIPCIONES = "https://play.google.com/store/account/subscriptions?package=es.ilusionpantalla.app"

@Composable
fun PantallaCuenta(alTerminar: () -> Unit) {
    val c = LocalContext.current.contenedor; val ambito = rememberCoroutineScope()
    var registro by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }; var clave by remember { mutableStateOf("") }
    var cargando by remember { mutableStateOf(false) }; var mensaje by remember { mutableStateOf<String?>(null) }

    fun enviar(accion: () -> ResultadoAuth) { cargando = true; mensaje = null
        ambito.launch {
            val r = withContext(Dispatchers.IO) { accion().also { if (it is ResultadoAuth.Ok) { c.sesion.iniciar(it); c.refrescarPlan() } } }
            cargando = false
            when (r) {
                is ResultadoAuth.Ok -> alTerminar()
                ResultadoAuth.ConfirmarCorreo -> mensaje = "Te hemos enviado un correo. Ábrelo para confirmar y vuelve para entrar."
                ResultadoAuth.CredencialesInvalidas -> mensaje = "Correo o contraseña incorrectos."
                ResultadoAuth.CorreoSinConfirmar -> mensaje = "Confirma tu correo (te lo enviamos al registrarte) y vuelve a entrar."
                ResultadoAuth.UsuarioYaExiste -> mensaje = "Ya existe una cuenta con ese correo. Prueba a entrar."
                is ResultadoAuth.ContrasenaDebil -> mensaje = "Elige una contraseña más larga (mínimo 8 caracteres)."
                ResultadoAuth.DemasiadosIntentos -> mensaje = "Demasiados intentos. Espera unos minutos."
                ResultadoAuth.SinConexion -> mensaje = "Sin conexión. Inténtalo de nuevo."
                is ResultadoAuth.Otro -> mensaje = "No se pudo completar (${r.codigo})."
            }
        } }

    val valido = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email.trim()) && clave.length >= 8
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(if (registro) "Crear cuenta" else "Iniciar sesión", style = MaterialTheme.typography.headlineMedium)
        Text("La cuenta es opcional: solo la necesitas para Premium, favoritos entre dispositivos y restaurar compras.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Correo electrónico") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
        OutlinedTextField(clave, { clave = it }, Modifier.fillMaxWidth(), label = { Text("Contraseña (mínimo 8)") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        mensaje?.let { Text(it, color = MaterialTheme.colorScheme.tertiary) }
        Button({ enviar { if (registro) c.auth.registrar(email, clave) else c.auth.entrar(email, clave) } }, Modifier.fillMaxWidth().heightIn(min = 52.dp), enabled = valido && !cargando) {
            if (cargando) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text(if (registro) "Crear cuenta" else "Entrar")
        }
        TextButton({ registro = !registro; mensaje = null }) { Text(if (registro) "Ya tengo cuenta" else "No tengo cuenta: crear una") }
        if (!registro) TextButton({ enviar { c.auth.recuperarContrasena(email) } }, enabled = email.contains("@") && !cargando) { Text("He olvidado mi contraseña") }
    }
}

@Composable
fun SeccionCuenta(irCuenta: () -> Unit, irPaywall: () -> Unit) {
    val ctx = LocalContext.current; val c = ctx.contenedor; val ambito = rememberCoroutineScope()
    var sesion by remember { mutableStateOf(c.sesion.actual) }
    val plan by c.plan.collectAsState()
    var aviso by remember { mutableStateOf<String?>(null) }
    var confirmarBorrado by remember { mutableStateOf(false) }; var borradoConSuscripcion by remember { mutableStateOf(false) }
    LaunchedEffect(sesion) { if (sesion != null) withContext(Dispatchers.IO) { c.refrescarPlan() } }

    val exportar = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        ambito.launch {
            val json = withContext(Dispatchers.IO) { c.sesion.tokenValido()?.let { c.cuenta.exportarDatos(it) } }
            aviso = if (json == null) "No se pudieron descargar tus datos. Inténtalo de nuevo." else {
                withContext(Dispatchers.IO) { ctx.contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) } }; "Datos guardados."
            }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Cuenta", style = MaterialTheme.typography.titleMedium)
        if (sesion == null) {
            Button(irCuenta, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Iniciar sesión o crear cuenta") }
            return@Column
        }
        Text(sesion?.email ?: "Sesión iniciada")
        Text(when (val p = plan) { null -> "Plan: comprobando…"; else -> if (p.premium) "Plan: Premium" + if (p.estado == "cancelada") " (no se renovará)" else "" else "Plan: gratis" }, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (plan?.premium == true) OutlinedButton({ ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(URL_SUSCRIPCIONES)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Gestionar o cancelar suscripción") }
        else Button(irPaywall, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Hazte Premium") }
        OutlinedButton({ ambito.launch { aviso = "Restaurando…"; val r = withContext(Dispatchers.IO) { c.compras.restaurar() }
            aviso = when (r) { is EventoCompra.Verificada -> if (r.premium) "¡Premium restaurado!" else "No encontramos suscripciones activas."; is EventoCompra.Fallo -> r.mensaje; else -> null } } }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Restaurar compras") }
        OutlinedButton({ exportar.launch("ilusion-pantalla-mis-datos.json") }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Descargar mis datos") }
        OutlinedButton({ ambito.launch { withContext(Dispatchers.IO) { c.sesion.cerrar() }; c.plan.value = null; sesion = null } }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Cerrar sesión") }
        TextButton({ confirmarBorrado = true }, Modifier.heightIn(min = 48.dp)) { Text("Borrar mi cuenta", color = MaterialTheme.colorScheme.error) }
        aviso?.let { Text(it, color = MaterialTheme.colorScheme.tertiary) }
    }
    if (confirmarBorrado) AlertDialog(
        onDismissRequest = { confirmarBorrado = false },
        title = { Text(if (borradoConSuscripcion) "Tienes una suscripción activa" else "¿Borrar tu cuenta?") },
        text = { Text(if (borradoConSuscripcion) "Borrar la cuenta NO cancela el cobro en Google Play. Cancélala antes en Play Store → Pagos y suscripciones. ¿Borrar la cuenta igualmente?"
            else "Se eliminarán tu cuenta, favoritos, historial y suscripción asociada. No se puede deshacer.") },
        confirmButton = { TextButton({
            ambito.launch {
                val token = withContext(Dispatchers.IO) { c.sesion.tokenValido() }
                if (token == null) { aviso = "Tu sesión ha caducado. Inicia sesión de nuevo."; confirmarBorrado = false; return@launch }
                when (val r = withContext(Dispatchers.IO) { c.cuenta.borrarCuenta(token, aceptoSuscripcionActiva = borradoConSuscripcion) }) {
                    ResultadoBorrado.Borrada -> { c.sesion.olvidar(); c.plan.value = null; sesion = null; confirmarBorrado = false; borradoConSuscripcion = false; aviso = "Cuenta borrada." }
                    ResultadoBorrado.SuscripcionActiva -> borradoConSuscripcion = true      // vuelve a preguntar con el aviso de Play
                    ResultadoBorrado.SinSesion -> { aviso = "Tu sesión ha caducado."; confirmarBorrado = false }
                    ResultadoBorrado.SinConexion -> { aviso = "Sin conexión. No se ha borrado nada."; confirmarBorrado = false }
                    is ResultadoBorrado.Otro -> { aviso = "No se pudo borrar (${r.codigo}). No se ha borrado nada."; confirmarBorrado = false }
                }
            } }) { Text(if (borradoConSuscripcion) "Borrar igualmente" else "Borrar", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton({ confirmarBorrado = false; borradoConSuscripcion = false }) { Text("Cancelar") } },
    )
}

/** Paywall: precios y periodos reales de Google Play, condiciones a la vista y salida igual de fácil que la entrada. */
@Composable
fun PantallaPaywall(motivo: MotivoPaywall, irCuenta: () -> Unit, cerrar: () -> Unit) {
    val ctx = LocalContext.current; val c = ctx.contenedor; val ambito = rememberCoroutineScope()
    val sesion = c.sesion.actual
    var planes by remember { mutableStateOf<List<PlanPlay>?>(null) }
    var elegido by remember { mutableStateOf<PlanPlay?>(null) }
    var mensaje by remember { mutableStateOf<String?>(null) }; var exito by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { c.evento(Evento.PaywallVisto(motivo)); planes = withContext(Dispatchers.IO) { c.compras.planes() }; elegido = planes?.firstOrNull { it.anual } ?: planes?.firstOrNull() }
    LaunchedEffect(Unit) { c.compras.eventos.collect { e ->
        when (e) {
            is EventoCompra.Verificada -> { exito = e.premium; mensaje = if (e.premium) "¡Ya eres Premium! Gracias." else "No encontramos una suscripción activa."
                if (e.premium) c.evento(Evento.CompraCompletada(if (elegido?.anual == true) PlanEv.ANUAL else PlanEv.MENSUAL)) }
            EventoCompra.Pendiente -> mensaje = "Tu pago está pendiente. Te avisaremos cuando Google lo confirme; no se activa nada hasta entonces."
            EventoCompra.Cancelada -> mensaje = null
            is EventoCompra.Fallo -> mensaje = e.mensaje
        } } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Ilusión Pantalla Premium", style = MaterialTheme.typography.headlineMedium)
        Text("Toda la colección Premium: arquitectura, casas de lujo, calidad hasta 4K y los nuevos fondos cada semana.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        when {
            exito -> { Text(mensaje ?: "", color = MaterialTheme.colorScheme.tertiary); Button(cerrar, Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Continuar") } }
            planes == null -> CircularProgressIndicator()
            planes!!.isEmpty() -> Text("No pudimos cargar los planes. Comprueba que Google Play está disponible y tu conexión, e inténtalo de nuevo.", color = MaterialTheme.colorScheme.tertiary)
            else -> {
                planes!!.forEach { p ->
                    val sel = elegido?.id == p.id
                    OutlinedCard({ elegido = p }, Modifier.fillMaxWidth().heightIn(min = 72.dp), border = CardDefaults.outlinedCardBorder().let { if (sel) androidx.compose.foundation.BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else it }) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(sel, { elegido = p })
                            Column(Modifier.weight(1f)) { Text(if (p.anual) "Anual" else "Mensual", style = MaterialTheme.typography.titleMedium); Text("${p.precio} / ${if (p.anual) "año" else "mes"}", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                }
                if (sesion == null) { Button(irCuenta, Modifier.fillMaxWidth().heightIn(min = 52.dp)) { Text("Inicia sesión para suscribirte") }; Text("Necesitamos tu cuenta para asociar la compra y poder restaurarla.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                else Button({ val p = elegido ?: return@Button; c.evento(Evento.CompraIniciada(if (p.anual) PlanEv.ANUAL else PlanEv.MENSUAL)); if (!c.compras.comprar(ctx.actividad() ?: return@Button, p)) mensaje = "No se pudo abrir el pago de Google Play." }, Modifier.fillMaxWidth().heightIn(min = 52.dp), enabled = elegido != null) { Text("Suscribirme") }
                mensaje?.let { Text(it, color = MaterialTheme.colorScheme.tertiary) }
                Text("La suscripción se renueva automáticamente al final de cada periodo hasta que la canceles. Puedes cancelar cuando quieras en Google Play → Pagos y suscripciones; mantendrás el acceso hasta el final del periodo ya pagado. El cobro lo gestiona Google.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton({
                    if (sesion == null) irCuenta()
                    else ambito.launch {
                        mensaje = "Restaurando…"
                        when (val r = withContext(Dispatchers.IO) { c.compras.restaurar() }) {
                            is EventoCompra.Verificada -> { exito = r.premium; mensaje = if (r.premium) "¡Premium restaurado!" else "No encontramos suscripciones activas en tu cuenta de Google." }
                            is EventoCompra.Fallo -> mensaje = r.mensaje
                            else -> mensaje = null
                        }
                    }
                }, Modifier.heightIn(min = 48.dp)) { Text("Restaurar compras") }
            }
        }
        if (!exito) TextButton(cerrar, Modifier.heightIn(min = 48.dp)) { Text("Ahora no") }
    }
}
