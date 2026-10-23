package es.ilusionpantalla.app.ui.pantallas

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import es.ilusionpantalla.app.contenedor

private const val SI_MIDE = "Qué fondos ves, descargas y activas · si buscas (cuántos resultados, nunca lo que escribes) · qué ajustes cambias · tu versión de Android y de la app."
private const val NO_MIDE = "Tu nombre, correo, contactos, ubicación, fotos, identificador publicitario ni nada que te identifique. Los datos van asociados a un código aleatorio de esta instalación."

/**
 * Pantalla de primer uso. Reglas de diseño (RGPD/LSSI y buenas prácticas):
 *  - Dos botones del MISMO peso: rechazar no cuesta más que aceptar.
 *  - La app funciona igual si se rechaza.
 *  - Texto claro de qué se mide y qué no, y cómo revocarlo.
 */
@Composable
fun PantallaConsentimiento(alAceptar: () -> Unit, alRechazar: () -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Spacer(Modifier.height(24.dp))
        Text("Ayúdanos a mejorar", style = MaterialTheme.typography.headlineMedium)
        Text("¿Nos dejas medir de forma anónima cómo se usa la app? Así sabemos qué fondos gustan y qué falla.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Qué medimos", style = MaterialTheme.typography.titleSmall); Text(SI_MIDE, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Qué NO medimos", style = MaterialTheme.typography.titleSmall); Text(NO_MIDE, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Puedes decir que no: la app funciona igual. Y cambiarlo cuando quieras en Perfil → Privacidad, donde también puedes borrar tus datos de analítica. Los conservamos como máximo 13 meses.",
            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(alRechazar, Modifier.weight(1f).heightIn(min = 52.dp)) { Text("Ahora no") }
            OutlinedButton(alAceptar, Modifier.weight(1f).heightIn(min = 52.dp)) { Text("Aceptar") }
        }
    }
}

@Composable
fun SeccionPrivacidad() {
    val c = LocalContext.current.contenedor
    var activa by remember { mutableStateOf(c.consentimiento.analiticaPermitida) }
    var confirmar by remember { mutableStateOf(false) }
    var borrado by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Privacidad", style = MaterialTheme.typography.titleMedium)
        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Estadísticas anónimas de uso", Modifier.weight(1f))
            Switch(activa, { on -> activa = on; borrado = false; c.privacidad { if (on) conceder() else denegar() } })
        }
        Text("Medimos: $SI_MIDE", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton({ confirmar = true }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) { Text("Borrar mis datos de analítica") }
        if (borrado) Text("Hecho. Dejamos de medir y pedimos borrar lo ya enviado.", color = MaterialTheme.colorScheme.tertiary)
    }
    if (confirmar) AlertDialog(
        onDismissRequest = { confirmar = false },
        title = { Text("¿Borrar tus datos de analítica?") },
        text = { Text("Dejaremos de medir y se eliminarán los datos anónimos enviados desde este móvil. Puedes volver a activarlo cuando quieras.") },
        confirmButton = { TextButton({ confirmar = false; activa = false; borrado = true; c.privacidad { revocarYBorrar() } }) { Text("Borrar") } },
        dismissButton = { TextButton({ confirmar = false }) { Text("Cancelar") } },
    )
}
