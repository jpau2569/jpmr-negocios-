package es.ilusionpantalla.app.ui.nav

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import es.ilusionpantalla.app.CatalogoViewModel
import es.ilusionpantalla.app.ui.pantallas.*

enum class Destino(val ruta: String, val titulo: String, val icono: ImageVector, val proxima: Boolean = false) {
    INICIO("inicio", "Inicio", Icons.Filled.Home),
    EXPLORAR("explorar", "Explorar", Icons.Filled.Search),
    CREAR("crear", "Crear", Icons.Filled.AddCircle, proxima = true),   // V1: creador básico local (Fase 2)
    FAVORITOS("favoritos", "Favoritos", Icons.Filled.Favorite),
    PERFIL("perfil", "Perfil", Icons.Filled.Person),
}

@Composable
fun Navegacion() {
    val nav = rememberNavController()
    val vm: CatalogoViewModel = viewModel()   // una sola instancia compartida: catálogo, filtros y favoritos
    val actual = nav.currentBackStackEntryAsState().value?.destination?.route
    Scaffold(
        bottomBar = {
            NavigationBar {
                Destino.entries.forEach { d ->
                    NavigationBarItem(
                        selected = actual == d.ruta,
                        onClick = { nav.navigate(d.ruta) { popUpTo(nav.graph.startDestinationId) { saveState = true }; launchSingleTop = true; restoreState = true } },
                        icon = { Icon(d.icono, contentDescription = d.titulo) },
                        label = { Text(d.titulo) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = Destino.INICIO.ruta, modifier = Modifier.padding(padding)) {
            composable(Destino.INICIO.ruta) { PantallaInicio(vm) { nav.navigate("detalle/$it") } }
            composable(Destino.EXPLORAR.ruta) { PantallaExplorar(vm) { nav.navigate("detalle/$it") } }
            composable(Destino.CREAR.ruta) { Marcador(Destino.CREAR) }
            composable(Destino.FAVORITOS.ruta) { PantallaFavoritos(vm) { nav.navigate("detalle/$it") } }
            composable(Destino.PERFIL.ruta) { PantallaPerfil() }
            composable("detalle/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { e ->
                PantallaDetalle(e.arguments?.getString("id").orEmpty(), vm, atras = { nav.popBackStack() }, abrir = { nav.navigate("detalle/$it") })
            }
        }
    }
}

/** Pantalla provisional de la Fase 1: demuestra navegación y tema. Las reales llegan en la Fase 2. */
@Composable
private fun Marcador(d: Destino) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(d.titulo, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(if (d.proxima) "Próximamente" else "Tu pantalla cobra vida.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
