import { Game } from './core/Game';

/**
 * Punto de entrada: crea el juego sobre el canvas y arranca la inicialización
 * asíncrona (el WASM de Rapier se carga aquí, bajo la pantalla de "Cargando…").
 */
const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('No se encontró el canvas #game-canvas');
}

new Game(canvas).init().catch((err) => {
  console.error('Error inicializando Nicer RoboPro:', err);
  const loading = document.getElementById('screen-loading');
  if (loading) loading.innerHTML = '<div class="loading-text">Error al cargar :(</div>';
});
