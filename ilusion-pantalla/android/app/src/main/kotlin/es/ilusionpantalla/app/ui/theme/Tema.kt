package es.ilusionpantalla.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Tokens de marca. Fuente única: design/tokens.json (el test de diseño comprueba que coinciden). */
object Marca {
    val Grafito = Color(0xFF0B0D12)
    val SuperficieGrafito = Color(0xFF141824)
    val AzulElectrico = Color(0xFF4D7CFE)
    val VioletaProfundo = Color(0xFF7C3AED)
    val Turquesa = Color(0xFF22D3EE)
    val BlancoSuave = Color(0xFFF8FAFC)
    val GrisTexto = Color(0xFFA7B0C0)   // contraste 8.9:1 sobre Grafito (AA/AAA)
}

private val Oscuro = darkColorScheme(
    primary = Marca.AzulElectrico, onPrimary = Marca.Grafito,
    secondary = Marca.VioletaProfundo, onSecondary = Marca.BlancoSuave,
    tertiary = Marca.Turquesa, onTertiary = Marca.Grafito,
    background = Marca.Grafito, onBackground = Marca.BlancoSuave,
    surface = Marca.SuperficieGrafito, onSurface = Marca.BlancoSuave, onSurfaceVariant = Marca.GrisTexto,
)

// Oscuro por defecto y también si el sistema es claro: la identidad es oscura. (Modo claro: Fase 2.)
@Composable
fun IlusionTema(contenido: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Oscuro, content = contenido)
}
