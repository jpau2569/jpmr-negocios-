// ============================================================================
//  Escaparate 3D Pro — carrusel 3D genérico (Three.js)
// ----------------------------------------------------------------------------
//  La escena NO sabe si enseña pisos o platos: recibe "elementos" ya traducidos
//  ({ titulo, lineas, precio, etiqueta, foto }) y los monta como tarjetas en un
//  carrusel cilíndrico. Los colores salen de la paleta del CONFIG: el acento
//  tiñe el borde de la tarjeta, la luz de relleno y el resplandor del suelo.
//
//  Cada tarjeta es UNA textura de canvas (foto + textos pintados encima), así
//  que no hay tipografías 3D ni geometría de texto: entra en cualquier móvil.
// ============================================================================

import * as THREE from "three";

const RADIO_MIN = 6.2;      // radio mínimo del carrusel (pocas tarjetas)
const SEPARACION = 1.28;    // hueco entre tarjetas, en anchos de tarjeta
const ANCHO_TARJETA = 3.0;
const ALTO_TARJETA = 4.0;
const RESOLUCION = 512;     // píxeles del lado corto de la textura

/* --- Pintura de la tarjeta en 2D ------------------------------------------ */

function redondeado(ctx, x, y, an, al, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + an, y, x + an, y + al, r);
  ctx.arcTo(x + an, y + al, x, y + al, r);
  ctx.arcTo(x, y + al, x, y, r);
  ctx.arcTo(x, y, x + an, y, r);
  ctx.closePath();
}

function ajustaTexto(ctx, texto, ancho, maxLineas) {
  const palabras = String(texto || "").split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) break;
    } else {
      actual = prueba;
    }
  }
  if (lineas.length < maxLineas && actual) lineas.push(actual);
  if (lineas.length === maxLineas && palabras.length) {
    const ultima = lineas[maxLineas - 1];
    if (ctx.measureText(ultima).width > ancho) {
      let recorte = ultima;
      while (recorte.length > 3 && ctx.measureText(recorte + "…").width > ancho) recorte = recorte.slice(0, -1);
      lineas[maxLineas - 1] = recorte + "…";
    }
  }
  return lineas;
}

// Dibuja la tarjeta completa. Se llama dos veces: una sin foto (inmediata) y
// otra cuando la imagen termina de cargar, para que nada quede en blanco.
export function pintarTarjeta(ctx, elemento, paleta, imagen) {
  const A = ctx.canvas.width, H = ctx.canvas.height;
  const p = A / 512; // escala respecto al diseño base

  ctx.clearRect(0, 0, A, H);
  ctx.fillStyle = paleta.tarjeta3d;
  redondeado(ctx, 0, 0, A, H, 28 * p);
  ctx.fill();
  ctx.save();
  ctx.clip();

  const altoFoto = H * 0.52;
  if (imagen) {
    // "cover": la foto llena el hueco sin deformarse.
    const escala = Math.max(A / imagen.width, altoFoto / imagen.height);
    const an = imagen.width * escala, al = imagen.height * escala;
    ctx.drawImage(imagen, (A - an) / 2, (altoFoto - al) / 2, an, al);
  } else {
    const grad = ctx.createLinearGradient(0, 0, A, altoFoto);
    grad.addColorStop(0, paleta.superficie2);
    grad.addColorStop(1, paleta.acento);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, A, altoFoto);
    ctx.globalAlpha = 1;
  }

  // Degradado para que el texto se lea siempre sobre la foto.
  const velo = ctx.createLinearGradient(0, altoFoto - 120 * p, 0, altoFoto + 40 * p);
  velo.addColorStop(0, "rgba(0,0,0,0)");
  velo.addColorStop(1, paleta.tarjeta3d);
  ctx.fillStyle = velo;
  ctx.fillRect(0, altoFoto - 120 * p, A, 160 * p);
  ctx.fillStyle = paleta.tarjeta3d;
  ctx.fillRect(0, altoFoto, A, H - altoFoto);

  // Etiqueta (operación, categoría…) sobre el color de acento.
  if (elemento.etiqueta) {
    ctx.font = `600 ${20 * p}px system-ui, sans-serif`;
    const an = ctx.measureText(elemento.etiqueta).width + 28 * p;
    ctx.fillStyle = paleta.acento;
    redondeado(ctx, 22 * p, 22 * p, an, 36 * p, 18 * p);
    ctx.fill();
    ctx.fillStyle = paleta.sobreAcento;
    ctx.textBaseline = "middle";
    ctx.fillText(elemento.etiqueta, 36 * p, 41 * p);
  }

  let y = altoFoto + 46 * p;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = paleta.texto;
  ctx.font = `700 ${30 * p}px system-ui, sans-serif`;
  for (const linea of ajustaTexto(ctx, elemento.titulo, A - 56 * p, 3)) {
    ctx.fillText(linea, 28 * p, y);
    y += 36 * p;
  }

  ctx.fillStyle = paleta.tenue;
  ctx.font = `400 ${23 * p}px system-ui, sans-serif`;
  for (const linea of (elemento.lineas || []).slice(0, 3)) {
    y += 6 * p;
    ctx.fillText(ajustaTexto(ctx, linea, A - 56 * p, 1)[0] || "", 28 * p, y);
    y += 26 * p;
  }

  if (elemento.precio) {
    ctx.fillStyle = paleta.acento;
    ctx.font = `800 ${38 * p}px system-ui, sans-serif`;
    ctx.fillText(elemento.precio, 28 * p, H - 34 * p);
  }

  ctx.restore();

  // Borde con el color de acento: el "rim light" que ata la marca a la escena.
  ctx.lineWidth = 5 * p;
  ctx.strokeStyle = paleta.acento;
  ctx.globalAlpha = elemento.destacado ? 0.95 : 0.4;
  redondeado(ctx, 2.5 * p, 2.5 * p, A - 5 * p, H - 5 * p, 28 * p);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* --- Escena --------------------------------------------------------------- */

export function crearEscena({ lienzo, paleta, alPulsar = () => {}, alCambiar = () => {} }) {
  const renderizador = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: false });
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(paleta.fondo);
  escena.fog = new THREE.Fog(paleta.fondoNiebla, 9, 26);   // se reajusta en montar()

  //  El radio CRECE con el número de tarjetas. Si no, una carta de 40 platos
  //  las apila en una empalizada ilegible: hay que repartirlas por un círculo
  //  más grande y alejar la cámara lo mismo, para que la de delante se vea
  //  siempre igual de grande tenga el negocio 6 platos o 40.
  let radio = RADIO_MIN;
  const radioPara = (n) => Math.max(RADIO_MIN, (ANCHO_TARJETA * SEPARACION * Math.max(1, n)) / (2 * Math.PI));

  const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camara.position.set(0, 1, radio + 7.8);
  camara.lookAt(0, -0.7, radio);

  escena.add(new THREE.AmbientLight(0xffffff, 0.75));
  const focal = new THREE.DirectionalLight(0xffffff, 0.85);
  focal.position.set(3, 6, 8);
  escena.add(focal);
  const luzAcento = new THREE.PointLight(new THREE.Color(paleta.acento), 26, 30);
  luzAcento.position.set(0, 1.5, 6);
  escena.add(luzAcento);

  // Suelo con el resplandor del acento, para que la marca "moje" toda la escena.
  const suelo = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(paleta.superficie), transparent: true, opacity: 0.55 })
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -ALTO_TARJETA / 2 - 0.35;
  escena.add(suelo);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(radio - 0.5, radio + 0.5, 96),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(paleta.acento), transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = suelo.position.y + 0.01;
  escena.add(halo);

  const grupo = new THREE.Group();
  escena.add(grupo);

  const estado = {
    elementos: [],
    tarjetas: [],
    anguloObjetivo: 0,
    angulo: 0,
    indice: 0,
    auto: false,
    vivo: true,
    arrastrando: false,
  };

  function texturaDe(elemento) {
    const canvas = document.createElement("canvas");
    canvas.width = RESOLUCION;
    canvas.height = Math.round(RESOLUCION * (ALTO_TARJETA / ANCHO_TARJETA));
    const ctx = canvas.getContext("2d");
    pintarTarjeta(ctx, elemento, paleta, null);
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = renderizador.capabilities.getMaxAnisotropy?.() || 1;

    if (elemento.foto) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        pintarTarjeta(ctx, elemento, paleta, img);
        textura.needsUpdate = true;
      };
      img.onerror = () => { /* sin foto se queda el degradado: la tarjeta nunca sale rota */ };
      img.src = elemento.foto;
    }
    return textura;
  }

  function limpiar() {
    for (const tarjeta of estado.tarjetas) {
      grupo.remove(tarjeta);
      tarjeta.material.map?.dispose();
      tarjeta.material.dispose();
      tarjeta.geometry.dispose();
    }
    estado.tarjetas = [];
  }

  function montar(elementos) {
    limpiar();
    estado.elementos = elementos.slice(0, 40);
    const total = estado.elementos.length || 1;
    radio = radioPara(total);
    halo.geometry.dispose();
    halo.geometry = new THREE.RingGeometry(radio - 0.5, radio + 0.5, 96);
    escena.fog.near = radio + 2;
    escena.fog.far = radio * 2 + 14;
    medir();
    const geometria = new THREE.PlaneGeometry(ANCHO_TARJETA, ALTO_TARJETA, 1, 1);
    estado.elementos.forEach((elemento, i) => {
      const material = new THREE.MeshBasicMaterial({ map: texturaDe(elemento), transparent: true });
      const malla = new THREE.Mesh(geometria.clone(), material);
      const a = (i / total) * Math.PI * 2;
      malla.position.set(Math.sin(a) * radio, 0, Math.cos(a) * radio);
      malla.rotation.y = a;
      malla.userData = { indice: i, elemento };
      grupo.add(malla);
      estado.tarjetas.push(malla);
    });
    geometria.dispose();
    estado.indice = 0;
    estado.anguloObjetivo = 0;
    alCambiar(estado.elementos[0] || null, 0, estado.elementos.length);
  }

  function irA(indice) {
    const total = estado.elementos.length;
    if (!total) return;
    const paso = (Math.PI * 2) / total;
    // Camino más corto: nos movemos en vueltas relativas, no absolutas.
    const actual = estado.anguloObjetivo;
    const deseado = -indice * paso;
    let delta = (deseado - actual) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    estado.anguloObjetivo = actual + delta;
    estado.indice = ((indice % total) + total) % total;
    alCambiar(estado.elementos[estado.indice], estado.indice, total);
  }

  const mover = (n) => irA(estado.indice + n);

  /* --- Interacción --------------------------------------------------------- */
  const puntero = new THREE.Vector2();
  const rayo = new THREE.Raycaster();
  let inicioX = 0, inicioAngulo = 0, movido = 0, pulsado = false;

  function coordenadas(ev) {
    const r = lienzo.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, ancho: r.width, alto: r.height };
  }

  function alBajar(ev) {
    pulsado = true;
    movido = 0;
    inicioX = ev.clientX;
    inicioAngulo = estado.anguloObjetivo;
    estado.arrastrando = true;
    estado.auto = false;
    lienzo.setPointerCapture?.(ev.pointerId);
  }

  function alMover(ev) {
    if (!pulsado) return;
    const delta = ev.clientX - inicioX;
    movido = Math.max(movido, Math.abs(delta));
    // Un dedo recorre siempre las mismas tarjetas, haya 6 o 40.
    const porTarjeta = (Math.PI * 2) / Math.max(1, estado.elementos.length);
    estado.anguloObjetivo = inicioAngulo + delta * porTarjeta * 0.012;
  }

  function alSoltar(ev) {
    if (!pulsado) return;
    pulsado = false;
    estado.arrastrando = false;
    const total = estado.elementos.length;
    if (!total) return;
    if (movido < 8) {
      // Ha sido un clic: miramos qué tarjeta hay debajo del dedo.
      const c = coordenadas(ev);
      puntero.set((c.x / c.ancho) * 2 - 1, -(c.y / c.alto) * 2 + 1);
      rayo.setFromCamera(puntero, camara);
      const tocadas = rayo.intersectObjects(estado.tarjetas, false);
      if (tocadas.length) {
        const { indice, elemento } = tocadas[0].object.userData;
        if (indice === estado.indice) alPulsar(elemento, indice);
        else irA(indice);
        return;
      }
    }
    // Al soltar, la tarjeta más cercana se coloca de frente.
    const paso = (Math.PI * 2) / total;
    irA(Math.round(-estado.anguloObjetivo / paso));
  }

  lienzo.addEventListener("pointerdown", alBajar);
  lienzo.addEventListener("pointermove", alMover);
  lienzo.addEventListener("pointerup", alSoltar);
  lienzo.addEventListener("pointercancel", () => { pulsado = false; estado.arrastrando = false; });
  lienzo.addEventListener("wheel", (ev) => {
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
    ev.preventDefault();
    estado.auto = false;
    mover(ev.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  function medir() {
    const ancho = lienzo.clientWidth || 1, alto = lienzo.clientHeight || 1;
    renderizador.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    // En vertical (móvil o la TV del local) hay que echar la cámara atrás.
    // La tarjeta de delante tiene que caber entera POR ENCIMA de la ficha de
    // datos, que va flotando abajo: por eso la cámara se echa atrás y mira un
    // poco alto. En vertical (móvil y la tele del local) hace falta más aire.
    const vertical = alto > ancho;
    // La cámara se separa lo mismo que crezca el círculo: la tarjeta de delante
    // queda siempre a la misma distancia y se ve igual de grande, tenga el
    // negocio 6 platos o 45. Y mira a la PROPIA TARJETA, no a un punto fijo del
    // suelo: si no, al agrandarse el círculo las tarjetas se hunden en la
    // pantalla. El desvío hacia abajo es el hueco que deja para la ficha.
    camara.position.set(0, vertical ? 1.1 : 1, radio + (vertical ? 7.6 : 7.8));
    camara.fov = vertical ? 46 : 42;
    camara.lookAt(0, -0.7, radio);
    camara.updateProjectionMatrix();
  }

  const observador = new ResizeObserver(medir);
  observador.observe(lienzo);
  medir();

  let ultimo = performance.now();
  function bucle(ahora) {
    if (!estado.vivo) return;
    requestAnimationFrame(bucle);
    const dt = Math.min((ahora - ultimo) / 1000, 0.1);
    ultimo = ahora;
    if (document.hidden) return; // pestaña en segundo plano: no gastamos batería

    if (estado.auto && !estado.arrastrando) estado.anguloObjetivo += dt * 0.28;
    estado.angulo += (estado.anguloObjetivo - estado.angulo) * Math.min(1, dt * 6);
    grupo.rotation.y = estado.angulo;

    // La tarjeta de frente crece un poco y las demás se apagan: guía la vista.
    for (const tarjeta of estado.tarjetas) {
      const mundo = new THREE.Vector3();
      tarjeta.getWorldPosition(mundo);
      const cerca = THREE.MathUtils.clamp((mundo.z + radio) / (radio * 2), 0, 1);
      const escala = 0.8 + cerca * 0.22;
      tarjeta.scale.setScalar(escala);
      tarjeta.material.opacity = 0.35 + cerca * 0.65;
      tarjeta.position.y = Math.sin(cerca * Math.PI) * 0.12;
    }
    halo.material.opacity = 0.16 + Math.sin(ahora / 900) * 0.05;
    renderizador.render(escena, camara);
  }
  requestAnimationFrame(bucle);

  return {
    montar,
    irA,
    siguiente: () => mover(1),
    anterior: () => mover(-1),
    indice: () => estado.indice,
    elementoActual: () => estado.elementos[estado.indice] || null,
    auto: (encendido) => { estado.auto = Boolean(encendido); },
    estaAuto: () => estado.auto,
    destruir: () => {
      estado.vivo = false;
      observador.disconnect();
      limpiar();
      renderizador.dispose();
    },
  };
}
