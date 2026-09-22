/* ==========================================================================
   OPORTUNIDADES ÚNICAS — logo en 3D
   --------------------------------------------------------------------------
   La marca: una casa dorada con una gema tallada dentro. La casa es el
   inmueble; la gema, que sea una oportunidad única. Todo es geometría hecha
   aquí (sin modelos ni fuentes que descargar) con Three.js.

   Dos usos:
   - montarLogo(contenedor)  → la insignia viva de la pantalla de acceso
     (flota, la gema gira y se inclina hacia el dedo o el ratón).
   - montarLogo(contenedor, { modo: "icono", tamano }) → fondo azul a sangre y
     plano fijo, para fotografiar los iconos de la app
     (herramientas/generar-iconos.mjs).

   Si el navegador no tiene WebGL, devuelve null y la pantalla sigue con la
   sigla «OU» de siempre.
   ========================================================================== */

const AZUL = 0x0b3b60;
const ORO = 0xd9b75f;

export async function montarLogo(contenedor, opciones = {}) {
  const { modo = "insignia", tamano = null, animar = true } = opciones;
  let THREE, RoomEnvironment;
  try {
    THREE = await import("three");
    ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js"));
  } catch {
    return null;
  }

  const lado = tamano || contenedor.clientWidth || 160;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: modo !== "icono", preserveDrawingBuffer: modo === "icono" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(tamano ? 1 : Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(lado, lado);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const escena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  if (modo === "icono") {
    // Fondo con un halo más claro detrás de la casa: da profundidad al icono.
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(256, 230, 20, 256, 256, 360);
    g.addColorStop(0, "#1A5C8F");
    g.addColorStop(0.55, "#0B3B60");
    g.addColorStop(1, "#062740");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const fondo = new THREE.CanvasTexture(c);
    fondo.colorSpace = THREE.SRGBColorSpace;
    escena.background = fondo;
  }

  const camara = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camara.position.set(0, 0.15, modo === "icono" ? 9.2 : 10.4);
  camara.lookAt(0, 0.05, 0);

  // ---- Luces: clave cálida, contraluz frío que recorta el oro ----
  escena.add(new THREE.AmbientLight(0xffffff, 0.35));
  const clave = new THREE.DirectionalLight(0xfff1d6, 2.4);
  clave.position.set(3, 5, 6);
  escena.add(clave);
  const contra = new THREE.DirectionalLight(0x9cc6ff, 1.6);
  contra.position.set(-5, 2, -4);
  escena.add(contra);

  const grupo = new THREE.Group();
  escena.add(grupo);

  // ---- La loseta azul (solo en la insignia; el icono ya es azul) ----
  if (modo !== "icono") {
    const loseta = rectanguloRedondeado(THREE, 4.6, 4.6, 1.05);
    const geoLoseta = new THREE.ExtrudeGeometry(loseta, {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 6, curveSegments: 24,
    });
    geoLoseta.center();
    const matLoseta = new THREE.MeshPhysicalMaterial({
      color: AZUL, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12,
    });
    const mLoseta = new THREE.Mesh(geoLoseta, matLoseta);
    mLoseta.position.z = -0.55;
    grupo.add(mLoseta);

    // Filo dorado alrededor de la loseta
    const filo = new THREE.Mesh(
      new THREE.ExtrudeGeometry(anillo(THREE, 4.72, 4.72, 1.1, 0.07), { depth: 0.08, bevelEnabled: false, curveSegments: 24 }),
      new THREE.MeshPhysicalMaterial({ color: ORO, metalness: 1, roughness: 0.22 })
    );
    filo.geometry.center();
    filo.position.z = -0.2;
    grupo.add(filo);
  }

  // ---- La casa: contorno dorado biselado ----
  const casa = contornoCasa(THREE);
  const geoCasa = new THREE.ExtrudeGeometry(casa, {
    depth: 0.34, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 5, curveSegments: 8,
  });
  geoCasa.center();
  const oro = new THREE.MeshPhysicalMaterial({
    color: ORO, metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  const mCasa = new THREE.Mesh(geoCasa, oro);
  mCasa.position.set(0, 0.02, 0.05);
  grupo.add(mCasa);

  // ---- La gema: talla brillante (corona + pabellón), caras planas ----
  const gema = new THREE.Group();
  const perfil = [
    new THREE.Vector2(0.0001, -0.62), // culata
    new THREE.Vector2(0.56, -0.02),   // cintura
    new THREE.Vector2(0.58, 0.02),
    new THREE.Vector2(0.38, 0.24),    // corona
    new THREE.Vector2(0.0001, 0.26),  // tabla
  ];
  const geoGema = new THREE.LatheGeometry(perfil, 10);
  // Metal claro y muy pulido con caras planas: cada faceta refleja una parte
  // distinta del entorno y la gema «centellea» al girar.
  const matGema = new THREE.MeshPhysicalMaterial({
    color: 0xffe9b0, metalness: 0.85, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0,
    flatShading: true, envMapIntensity: 2.6,
    iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 700],
    emissive: 0x4a3508, emissiveIntensity: 0.18,
  });
  gema.add(new THREE.Mesh(geoGema, matGema));
  gema.position.set(0, -0.28, 0.42);
  gema.scale.setScalar(1.05);
  grupo.add(gema);

  // Destello: un punto de luz que acompaña a la gema
  const destello = new THREE.PointLight(0xfff0c0, 6, 2.2, 2);
  destello.position.set(0.25, -0.05, 1.3);
  grupo.add(destello);

  grupo.rotation.set(-0.08, modo === "icono" ? -0.22 : -0.3, 0);
  gema.rotation.set(0.35, 0.4, 0);
  contenedor.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = lado + "px";
  renderer.domElement.style.height = lado + "px";

  const pintarUna = () => renderer.render(escena, camara);
  pintarUna();

  const quieto = modo === "icono" || !animar ||
    (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (quieto) return { canvas: renderer.domElement, parar() {} };

  // ---- Movimiento: flota, la gema gira, y se inclina hacia el puntero ----
  let objetivoX = 0, objetivoY = 0, vivo = true;
  const alMover = (ev) => {
    const p = ev.touches ? ev.touches[0] : ev;
    objetivoY = (p.clientX / innerWidth - 0.5) * 0.7;
    objetivoX = (p.clientY / innerHeight - 0.5) * 0.4;
  };
  addEventListener("pointermove", alMover, { passive: true });
  addEventListener("touchmove", alMover, { passive: true });

  const inicio = performance.now();
  (function bucle(ahora) {
    if (!vivo) return;
    const t = (ahora - inicio) / 1000;
    grupo.position.y = Math.sin(t * 1.3) * 0.07;
    grupo.rotation.y += ((-0.3 + objetivoY + Math.sin(t * 0.5) * 0.18) - grupo.rotation.y) * 0.05;
    grupo.rotation.x += ((-0.08 + objetivoX) - grupo.rotation.x) * 0.05;
    gema.rotation.y = t * 0.9;
    destello.intensity = 5 + Math.sin(t * 2.2) * 2.5;
    pintarUna();
    requestAnimationFrame(bucle);
  })(inicio);

  return {
    canvas: renderer.domElement,
    parar() {
      vivo = false;
      removeEventListener("pointermove", alMover);
      removeEventListener("touchmove", alMover);
      renderer.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
//  Formas 2D que luego se extruyen
// ---------------------------------------------------------------------------
function rectanguloRedondeado(THREE, ancho, alto, radio) {
  const s = new THREE.Shape();
  const x = -ancho / 2, y = -alto / 2;
  s.moveTo(x + radio, y);
  s.lineTo(x + ancho - radio, y);
  s.quadraticCurveTo(x + ancho, y, x + ancho, y + radio);
  s.lineTo(x + ancho, y + alto - radio);
  s.quadraticCurveTo(x + ancho, y + alto, x + ancho - radio, y + alto);
  s.lineTo(x + radio, y + alto);
  s.quadraticCurveTo(x, y + alto, x, y + alto - radio);
  s.lineTo(x, y + radio);
  s.quadraticCurveTo(x, y, x + radio, y);
  return s;
}

function anillo(THREE, ancho, alto, radio, grosor) {
  const fuera = rectanguloRedondeado(THREE, ancho, alto, radio);
  const dentro = rectanguloRedondeado(THREE, ancho - grosor * 2, alto - grosor * 2, radio - grosor);
  fuera.holes.push(new THREE.Path(dentro.getPoints(24).reverse()));
  return fuera;
}

// Casa: tejado a dos aguas con alero y chimenea, hueco interior para la gema.
function contornoCasa(THREE) {
  const g = 0.3; // grosor del trazo
  const fuera = new THREE.Shape();
  fuera.moveTo(-1.35, -1.35);
  fuera.lineTo(1.35, -1.35);
  fuera.lineTo(1.35, 0.25);
  fuera.lineTo(1.75, 0.25);   // alero derecho
  fuera.lineTo(0.9, 1.05);
  fuera.lineTo(0.9, 1.45);    // chimenea
  fuera.lineTo(0.55, 1.45);
  fuera.lineTo(0.55, 1.37);
  fuera.lineTo(0, 1.85);      // cumbrera
  fuera.lineTo(-1.75, 0.25);  // alero izquierdo
  fuera.lineTo(-1.35, 0.25);
  fuera.lineTo(-1.35, -1.35);

  const hueco = new THREE.Path();
  hueco.moveTo(-1.35 + g, -1.35 + g);
  hueco.lineTo(-1.35 + g, 0.25 + 0.12);
  hueco.lineTo(0, 1.85 - g * 1.45);
  hueco.lineTo(1.35 - g, 0.25 + 0.12);
  hueco.lineTo(1.35 - g, -1.35 + g);
  hueco.lineTo(-1.35 + g, -1.35 + g);
  fuera.holes.push(hueco);
  return fuera;
}
