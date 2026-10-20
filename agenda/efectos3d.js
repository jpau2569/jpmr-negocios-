/* ═══════════════════════════════════════════════════════════════════
   OLVIDO DE PAU AGENDA — efectos 3D
   · Las tarjetas con .inclina se inclinan hacia el puntero y una luz
     sigue al ratón (solo con ratón: en el móvil no estorba al deslizar).
   · En el móvil, el panel de bienvenida se inclina un poco con el giro
     del teléfono si el navegador lo permite sin pedir permiso (Android).
   · Nada de esto se activa con «reducir movimiento».
   ═══════════════════════════════════════════════════════════════════ */

const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const conRaton = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const MAX_X = 7; // grados
const MAX_Y = 9;

let actual = null;
let pendiente = null;

function aplica() {
  pendiente = null;
  if (!actual) return;
  const { el, x, y } = actual;
  el.style.transform = `perspective(1000px) rotateX(${(-(y - 0.5) * MAX_X).toFixed(2)}deg) rotateY(${((x - 0.5) * MAX_Y).toFixed(2)}deg) translateZ(0)`;
  el.style.setProperty('--luz-x', `${(x * 100).toFixed(1)}%`);
  el.style.setProperty('--luz-y', `${(y * 100).toFixed(1)}%`);
}

function suelta(el) {
  el.classList.remove('activa');
  el.style.transform = '';
}

export function arrancaEfectos3d() {
  // Pantalla de arranque: se va en cuanto la app ha pintado.
  const arranque = document.getElementById('arranque');
  if (arranque) setTimeout(() => { arranque.classList.add('fuera'); setTimeout(() => arranque.remove(), 600); }, quieto() ? 0 : 650);

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || quieto() || !conRaton()) return;
    const el = e.target.closest?.('.inclina');
    if (actual && actual.el !== el) suelta(actual.el);
    if (!el) { actual = null; return; }
    const r = el.getBoundingClientRect();
    actual = { el, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    el.classList.add('activa');
    pendiente ??= requestAnimationFrame(aplica);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (actual) { suelta(actual.el); actual = null; } });

  // Giro del móvil (Android; en iPhone haría falta pedir permiso y no se pide).
  if (!conRaton() && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let ultimo = 0;
    addEventListener('deviceorientation', (e) => {
      if (quieto() || e.beta == null || Date.now() - ultimo < 50) return;
      ultimo = Date.now();
      const el = document.querySelector('.saludo.inclina');
      if (!el) return;
      const rx = Math.max(-5, Math.min(5, (e.beta - 45) / 6));
      const ry = Math.max(-6, Math.min(6, e.gamma / 6));
      el.style.transform = `perspective(1000px) rotateX(${(-rx).toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    }, { passive: true });
  }
}
