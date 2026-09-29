/* ═══════════════════════════════════════════════════════════════════
   DOSIER DE VALORACIÓN 3D — skyline de precios (Three.js por CDN)
   Cada torre es un inmueble; su altura es el €/m². La torre sólida es el
   €/m² ya ajustado; el contorno fino, el €/m² sin ajustar (así el
   propietario ve cuánto se ha corregido). La franja dorada es el rango
   p25–p75. Las etiquetas son HTML proyectado: nítidas y accesibles.
   Si no hay WebGL o falla el CDN, `montarEscena` devuelve null y el
   llamador pinta las barras 2D de respaldo.
   ═══════════════════════════════════════════════════════════════════ */

const ESCALA = 480;          // €/m² por unidad de altura
const ANCHO_BASE = 1.5;      // lado de cada torre
const SEPARACION_BASE = 2.6;

export function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

const COLORES = {
  comparable: 0x5b6b7b,
  publicado: 0xd9a441,
  central: 0xf2d27a,
};

/** Textura de ventanas: se repite en vertical según la altura. */
function texturaVentanas(THREE, tono) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = tono; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = 6; y < 64; y += 16) for (let x = 8; x < 64; x += 28) g.fillRect(x, y, 14, 9);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {HTMLElement} cont   contenedor (position: relative)
 * @param {object} modelo      { torres, rango:{bajo,alto}, publicado }
 * @param {(id:string)=>void} alSeleccionar
 * @returns {Promise<null | {liberar():void, seleccionar(id):void}>}
 */
export async function montarEscena(cont, modelo, alSeleccionar = () => {}) {
  if (!hayWebGL()) return null;
  let THREE, OrbitControls;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch { return null; }

  const torresDatos = modelo.torres || [];
  if (!torresDatos.length) return null;
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const oscuro = true;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  cont.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y';

  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(0x14161a, 16, 40);
  const camara = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  escena.add(new THREE.HemisphereLight(0xfff4e0, 0x1b1e24, oscuro ? 1.15 : 1));
  const sol = new THREE.DirectionalLight(0xffe6b8, 1.6);
  sol.position.set(6, 12, 8);
  escena.add(sol);

  // Suelo con cuadrícula suave.
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(20, 64), new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.95 }));
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  const rejilla = new THREE.GridHelper(30, 30, 0x3a3f48, 0x2a2e35);
  rejilla.position.y = 0.01;
  escena.add(rejilla);

  const n = torresDatos.length;
  // En pantallas estrechas las torres van más juntas para que quepan las seis.
  const estrecho = cont.clientWidth < 600;
  const ANCHO = estrecho ? 1.25 : ANCHO_BASE;
  const SEPARACION = estrecho ? 1.85 : SEPARACION_BASE;
  const x0 = -((n - 1) * SEPARACION) / 2;
  const grupo = new THREE.Group();
  escena.add(grupo);
  const objetos = [];   // { id, malla, etiqueta, xy }

  torresDatos.forEach((t, i) => {
    const altura = Math.max(0.3, t.eurM2 / ESCALA);
    const color = COLORES[t.tipo] || COLORES.comparable;
    const tex = texturaVentanas(THREE, '#' + color.toString(16).padStart(6, '0'));
    tex.repeat.set(1, Math.max(1, Math.round(altura * 1.6)));
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.55, metalness: t.tipo === 'comparable' ? 0.1 : 0.45,
      emissive: t.tipo === 'comparable' ? 0x000000 : color, emissiveIntensity: t.tipo === 'comparable' ? 0 : 0.18,
    });
    const malla = new THREE.Mesh(new THREE.BoxGeometry(ANCHO, altura, ANCHO), mat);
    malla.position.set(x0 + i * SEPARACION, altura / 2, 0);
    malla.userData.id = t.id;
    grupo.add(malla);

    // Contorno del €/m² sin ajustar, si se ha corregido.
    if (t.tipo === 'comparable' && t.ajuste) {
      const alturaOrig = Math.max(0.3, t.eurM2SinAjuste / ESCALA);
      const caja = new THREE.Mesh(new THREE.BoxGeometry(ANCHO * 1.06, alturaOrig, ANCHO * 1.06), new THREE.MeshBasicMaterial({ visible: false }));
      const aristas = new THREE.LineSegments(new THREE.EdgesGeometry(caja.geometry), new THREE.LineBasicMaterial({ color: 0xf2d27a, transparent: true, opacity: 0.85 }));
      aristas.position.copy(malla.position); aristas.position.y = alturaOrig / 2;
      grupo.add(aristas);
    }

    const etiqueta = document.createElement('button');
    etiqueta.type = 'button';
    etiqueta.className = 'tag3d' + (t.tipo !== 'comparable' ? ' tag3d--suyo' : '');
    etiqueta.innerHTML = `<b></b><span></span>`;
    etiqueta.firstChild.textContent = t.corta || t.etiqueta;
    etiqueta.lastChild.textContent = `${Math.round(t.eurM2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${estrecho ? '' : ' €/m²'}`;
    etiqueta.addEventListener('click', () => alSeleccionar(t.id));
    cont.appendChild(etiqueta);
    objetos.push({ id: t.id, malla, etiqueta, altura, x: malla.position.x, dy: estrecho && i % 2 ? 30 : 0 });
  });

  // Franja del rango p25–p75.
  if (modelo.rango) {
    const yBajo = modelo.rango.bajoM2 / ESCALA;
    const yAlto = modelo.rango.altoM2 / ESCALA;
    const ancho = n * SEPARACION + 1;
    const franja = new THREE.Mesh(
      new THREE.BoxGeometry(ancho, Math.max(0.05, yAlto - yBajo), ANCHO * 2.2),
      new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    franja.position.set(0, (yBajo + yAlto) / 2, 0);
    grupo.add(franja);
    const borde = new THREE.LineSegments(new THREE.EdgesGeometry(franja.geometry), new THREE.LineBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.55 }));
    borde.position.copy(franja.position);
    grupo.add(borde);
  }

  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true;
  controles.enablePan = false;
  controles.minPolarAngle = 0.5;
  controles.maxPolarAngle = Math.PI / 2 - 0.08;
  controles.autoRotate = !reducido;
  controles.autoRotateSpeed = 0.7;
  controles.target.set(0, 2.3, 0);
  controles.update();
  let encuadrada = false;
  // Aleja la cámara lo justo para que quepan todas las torres a lo ancho.
  function encuadra() {
    const mitad = (n * SEPARACION) / 2 + 0.9;
    const d = Math.max(12, mitad / (Math.tan((camara.fov * Math.PI) / 360) * camara.aspect));
    controles.minDistance = d * 0.6;
    controles.maxDistance = d * 1.45;
    if (!encuadrada) { camara.position.set(0, 2.3 + d * 0.34, d * 0.94); encuadrada = true; }
  }
  // Al tocar, deja de girar solo.
  controles.addEventListener('start', () => { controles.autoRotate = false; });

  // Selección por clic sobre la torre.
  const rayo = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let abajo = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { abajo = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', (e) => {
    if (!abajo || Math.hypot(e.clientX - abajo[0], e.clientY - abajo[1]) > 5) return;
    const r = el.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const toca = rayo.intersectObjects(objetos.map((o) => o.malla))[0];
    if (toca) alSeleccionar(toca.object.userData.id);
  });

  function ajusta() {
    const w = cont.clientWidth, h = cont.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    encuadra();
  }
  const ro = new ResizeObserver(ajusta);
  ro.observe(cont);
  ajusta();

  let seleccionado = null;
  const v = new THREE.Vector3();
  let vivo = true, visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
  io.observe(cont);

  function pinta() {
    if (!vivo) return;
    requestAnimationFrame(pinta);
    if (!visible) return;
    controles.update();
    renderer.render(escena, camara);
    const w = cont.clientWidth, h = cont.clientHeight;
    for (const o of objetos) {
      v.set(o.x, o.altura + 0.35, 0).project(camara);
      const oculto = v.z > 1;
      o.etiqueta.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h - o.dy}px)`;
      o.etiqueta.style.opacity = oculto ? '0' : '1';
      o.etiqueta.classList.toggle('tag3d--sel', o.id === seleccionado);
    }
  }
  pinta();

  return {
    seleccionar(id) { seleccionado = id; },
    liberar() {
      vivo = false; ro.disconnect(); io.disconnect(); controles.dispose();
      renderer.dispose(); renderer.domElement.remove();
      objetos.forEach((o) => o.etiqueta.remove());
    },
  };
}
