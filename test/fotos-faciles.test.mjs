// ============================================================================
//  Tests de Fotos Fáciles — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  No salen a Internet ni tocan las carpetas del usuario: todo pasa en un
//  directorio temporal que se borra al final. Además del núcleo, se levanta el
//  servidor de verdad en un puerto libre y se prueba el camino completo:
//  subir desde el móvil (con corte y reanudación), detectar duplicados,
//  copiar y pegar sin sobrescribir, y compartir un enlace.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

// Carpeta de pruebas aislada (config incluida) antes de importar nada.
const RAIZ = await fsp.mkdtemp(path.join(os.tmpdir(), "fotos-faciles-test-"));
const DESTINO = path.join(RAIZ, "destino");
process.env.FOTOS_FACILES_HOME = path.join(RAIZ, "config");
// Repositorio de mentira: los puentes con el ecosistema no deben tocar el real.
const REPO = path.join(RAIZ, "repo");
process.env.FOTOS_FACILES_REPO = REPO;
await fsp.mkdir(path.join(REPO, "escaparate3d", "fotos"), { recursive: true });
await fsp.writeFile(path.join(REPO, "escaparate3d", "pisos.json"), JSON.stringify({
  negocio: "Asesoría Castresana", web: "https://www.asesoriacastresana.com", actualizado: null,
  inmuebles: [{
    referencia: "PIS0190", titulo: "Piso reformado de 3 habitaciones en el centro",
    zona: "Centro, Oviedo", precio: 265000,
    imagen: "fotos/pis0190-01.jpg", imagenes: ["fotos/pis0190-01.jpg", "fotos/pis0190-02.jpg"],
    activo: true,
  }],
}, null, 2), "utf8");
await fsp.mkdir(DESTINO, { recursive: true });

const { matriz, svg, ascii } = await import("../fotos-faciles/nucleo/qr.mjs");
const util = await import("../fotos-faciles/nucleo/util.mjs");
const { leeTiff, fechaIsoBmff, metadatos, miniaturaIncrustada } = await import("../fotos-faciles/nucleo/exif.mjs");
const { Almacen, hashArchivo } = await import("../fotos-faciles/nucleo/almacen.mjs");
const { copiarArchivos, listaCarpeta } = await import("../fotos-faciles/nucleo/explorador.mjs");
const { Seguridad } = await import("../fotos-faciles/nucleo/seguridad.mjs");
const { guardarConfig } = await import("../fotos-faciles/nucleo/config.mjs");
const { escanea } = await import("../fotos-faciles/nucleo/dispositivos.mjs");
const eco = await import("../fotos-faciles/nucleo/ecosistema.mjs");
const wpd = await import("../fotos-faciles/nucleo/wpd.mjs");
const { registraRecursos, recursoEmbebido, empaquetado } = await import("../fotos-faciles/nucleo/recursos.mjs");

const huella = (m) => crypto.createHash("sha256").update(m.modulos.map((f) => f.join("")).join("")).digest("hex").slice(0, 32);

// ============================================================================
console.log("\n🔳 Códigos QR (implementación propia, sin dependencias)");
{
  const m = matriz("http://192.168.1.40:4321/m#t=abc123", { nivel: "M" });
  check("elige la versión y el tamaño correctos", m.version === 3 && m.tamano === 29, `v${m.version} ${m.tamano}px`);
  // Huella verificada módulo a módulo contra la librería `qrcode` de referencia.
  check("la matriz coincide con la referencia (URL del móvil)",
    huella(m) === "3527e652e535d197c096cebede13c68e", huella(m));
  check("la matriz coincide con la referencia (nivel Q)",
    huella(matriz("https://asesoriacastresana.com", { nivel: "Q" })) === "e9851bbc806c06eafdfc1f6b787345de");

  const buscadores = [[0, 0], [0, m.tamano - 7], [m.tamano - 7, 0]];
  check("dibuja los tres cuadrados de las esquinas",
    buscadores.every(([f, c]) => m.modulos[f][c] === 1 && m.modulos[f + 1][c + 1] === 0 && m.modulos[f + 3][c + 3] === 1));
  check("la línea de sincronía alterna",
    m.modulos[6].slice(8, 12).join("") === "1010");

  const dibujo = svg("hola", { margen: 2 });
  check("el SVG sale bien formado", dibujo.startsWith("<svg") && dibujo.includes("viewBox=\"0 0 25 25\"") && dibujo.endsWith("</svg>"));
  check("el QR del terminal tiene margen", ascii("hola").split("\n")[0].trim() === "");

  let largo = false;
  try { matriz("x".repeat(500), { nivel: "H" }); } catch { largo = true; }
  check("avisa si el texto no cabe", largo);
}

// ============================================================================
console.log("\n🧰 Utilidades");
{
  check("limpia rutas peligrosas del nombre", util.nombreSeguro("../../etc/passwd") === "___.._.._etc_passwd" || !util.nombreSeguro("../../etc/passwd").includes("/"));
  check("respeta los nombres reservados de Windows", util.nombreSeguro("CON.jpg").startsWith("_"));
  check("quita caracteres prohibidos", !/[<>:"|?*]/.test(util.nombreSeguro('fo<to>:"|?*.jpg')));
  check("no deja el nombre vacío", util.nombreSeguro("") === "archivo");
  check("recorta nombres larguísimos conservando la extensión", (() => {
    const n = util.nombreSeguro("a".repeat(300) + ".jpg");
    return n.length <= 120 && n.endsWith(".jpg");
  })());
  check("tamaños legibles en español", util.tamanoLegible(1468006) === "1,4 MB" && util.tamanoLegible(900) === "900 B");
  check("clave de fecha local", util.claveFecha(new Date(2026, 8, 7, 10, 0)) === "2026-09-07");
  check("detecta rutas que se salen de la carpeta",
    util.dentroDe("/a/b", "/a/b/c") && !util.dentroDe("/a/b", "/a/c") && !util.dentroDe("/a/b", "/a/b/../c"));
  check("distingue fotos de vídeos", util.esFoto("IMG_1.HEIC") && util.esVideo("clip.MOV") && !util.esFoto("nota.txt"));

  const tmp = path.join(RAIZ, "libres");
  fs.mkdirSync(tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, "a.jpg"), "x");
  const libre = util.rutaLibre(path.join(tmp, "a.jpg"), (p) => fs.existsSync(p));
  check("propone un nombre nuevo en vez de sobrescribir", path.basename(libre) === "a (2).jpg");
}

// ============================================================================
console.log("\n📅 Metadatos (fecha real de la foto y miniatura incrustada)");

/** Construye un JPEG mínimo con bloque EXIF: fecha, orientación y miniatura. */
function jpegDePrueba({ fecha = "2026:09:07 13:45:01", conMiniatura = true } = {}) {
  const mini = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x03, 0x00, 0xff, 0xd9]);
  const cuerpo = Buffer.alloc(4096);
  let p = 0;
  const u16 = (v) => { cuerpo.writeUInt16LE(v, p); p += 2; };
  const u32 = (v) => { cuerpo.writeUInt32LE(v, p); p += 4; };
  cuerpo.write("II", p, "latin1"); p += 2; u16(42); u32(8);          // cabecera TIFF

  const textoFecha = Buffer.from(`${fecha}\0`, "latin1");
  const posFecha = 300, posMini = 400;
  textoFecha.copy(cuerpo, posFecha);
  mini.copy(cuerpo, posMini);

  // IFD0: orientación + puntero al sub-IFD EXIF
  const campo = (etiqueta, tipo, cuenta, valor) => { u16(etiqueta); u16(tipo); u32(cuenta); u32(valor); };
  u16(2);
  campo(0x0112, 3, 1, 6);            // orientación 6 (girada 90°)
  campo(0x8769, 4, 1, 200);          // sub-IFD EXIF en el byte 200
  u32(conMiniatura ? 500 : 0);       // siguiente IFD (el de la miniatura)

  p = 200; u16(1);
  campo(0x9003, 2, textoFecha.length, posFecha);
  u32(0);

  if (conMiniatura) {
    p = 500; u16(2);
    campo(0x0201, 4, 1, posMini);
    campo(0x0202, 4, 1, mini.length);
    u32(0);
  }

  const bloque = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), cuerpo]);
  const cabecera = Buffer.alloc(4);
  cabecera.writeUInt16BE(0xffe1, 0);
  cabecera.writeUInt16BE(bloque.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), cabecera, bloque, Buffer.from([0xff, 0xd9])]);
}

{
  const ruta = path.join(RAIZ, "prueba.jpg");
  await fsp.writeFile(ruta, jpegDePrueba());
  const datos = await metadatos(ruta);
  check("lee la fecha real del disparo (DateTimeOriginal)",
    datos.fecha instanceof Date && util.claveFecha(datos.fecha) === "2026-09-07" && datos.fecha.getHours() === 13,
    String(datos.fecha));
  check("lee la orientación", datos.orientacion === 6);
  const mini = await miniaturaIncrustada(ruta);
  check("saca la miniatura que ya trae la foto", Buffer.isBuffer(mini) && mini[0] === 0xff && mini[1] === 0xd8);

  const sinExif = path.join(RAIZ, "plana.jpg");
  await fsp.writeFile(sinExif, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  const vacio = await metadatos(sinExif);
  check("no revienta con una foto sin metadatos", vacio.fecha === null && vacio.orientacion === 1);

  // MP4 mínimo: moov > mvhd con fecha de creación.
  const mvhd = Buffer.alloc(108);
  mvhd.writeUInt32BE(108, 0); mvhd.write("mvhd", 4, "latin1");
  mvhd.writeUInt32BE(0, 8);                                  // versión 0
  mvhd.writeUInt32BE(2082844800 + Date.UTC(2026, 8, 7) / 1000, 12);
  const moov = Buffer.alloc(8);
  moov.writeUInt32BE(8 + mvhd.length, 0); moov.write("moov", 4, "latin1");
  check("lee la fecha de un vídeo MP4",
    util.claveFecha(fechaIsoBmff(Buffer.concat([moov, mvhd]))) === "2026-09-07");
  check("ignora una caja mvhd con fecha 0", fechaIsoBmff(Buffer.alloc(40)) === null);
  check("no confunde un TIFF inválido", leeTiff(Buffer.from("nada"), 0).fecha === null);
}

// ============================================================================
console.log("\n🗃️ Almacén: organizar sin pisar nada");
{
  const almacen = await new Almacen(DESTINO).preparar();
  const origen = path.join(RAIZ, "camara");
  await fsp.mkdir(origen, { recursive: true });
  const foto = path.join(origen, "IMG_0001.jpg");
  await fsp.writeFile(foto, jpegDePrueba());

  const r1 = await almacen.incorporar(foto, { nombre: "IMG_0001.jpg", inmueble: "Piso Oviedo", organizarPor: "fecha", renombrar: true });
  check("guarda en la carpeta del día de la foto, no la de hoy",
    r1.estado === "guardado" && r1.ruta.includes(`${path.sep}2026-09-07${path.sep}`), r1.ruta);
  check("renombra de forma ordenada", /2026-09-07_Piso-Oviedo_001\.jpg$/.test(r1.ruta), r1.ruta);

  const r2 = await almacen.incorporar(foto, { nombre: "IMG_0001.jpg", inmueble: "Piso Oviedo" });
  check("detecta el duplicado por contenido y no lo copia otra vez", r2.estado === "duplicado" && r2.ruta === r1.ruta);
  check("el índice reconoce la huella rápida nombre+tamaño", !!almacen.yaTengoHuella("IMG_0001.jpg", fs.statSync(r1.ruta).size));

  const otra = path.join(origen, "IMG_0002.jpg");
  await fsp.writeFile(otra, jpegDePrueba({ fecha: "2026:09:07 20:00:00" }));
  const r3 = await almacen.incorporar(otra, { nombre: "IMG_0001.jpg", inmueble: "Piso Oviedo" });
  check("con el mismo nombre pero distinto contenido, guarda las dos",
    r3.estado === "guardado" && r3.ruta !== r1.ruta && fs.existsSync(r1.ruta) && fs.existsSync(r3.ruta));
  check("numera correlativo dentro del día", /2026-09-07_Piso-Oviedo_002\.jpg$/.test(r3.ruta), r3.ruta);

  const carpetaInmueble = almacen.carpetaPara(new Date(2026, 8, 7), { organizarPor: "inmueble", inmueble: "Piso Oviedo" });
  check("modo carpeta por inmueble", carpetaInmueble.endsWith(path.join("Piso Oviedo", "2026-09-07")), carpetaInmueble);
  check("resumen contable", almacen.resumen().total === 2 && almacen.resumen().fotos === 2);

  // Pegar dentro de la propia carpeta de la app: se apunta en el índice, pero
  // el archivo NO se copia otra vez (ese fue un fallo real durante el desarrollo).
  const dentro = path.join(path.dirname(r1.ruta), "manual.jpg");
  await fsp.writeFile(dentro, jpegDePrueba({ fecha: "2026:09:07 08:00:00" }));
  const antes = fs.readdirSync(DESTINO).length;
  const fichaManual = await almacen.registrarExistente(dentro, "pegado");
  check("registra un archivo ya colocado sin volver a copiarlo",
    !!fichaManual && fs.existsSync(dentro) && fs.readdirSync(DESTINO).length === antes
    && !!almacen.yaTengoHuella("manual.jpg", fs.statSync(dentro).size));

  almacen.guardaAhora();
  const recargado = await new Almacen(DESTINO).preparar();
  check("el índice sobrevive a cerrar el programa", !!recargado.yaTengoHash(r1.hash));
}

// ============================================================================
console.log("\n📋 Copiar y pegar (Modo C): la regla de oro");
{
  const origen = path.join(RAIZ, "whatsapp");
  const destino = path.join(RAIZ, "pegado");
  await fsp.mkdir(origen, { recursive: true });
  await fsp.mkdir(destino, { recursive: true });
  await fsp.writeFile(path.join(origen, "IMG-2026.jpg"), "contenido A");
  await fsp.writeFile(path.join(destino, "IMG-2026.jpg"), "contenido B distinto");
  await fsp.writeFile(path.join(origen, "otra.jpg"), "contenido C");

  const r = await copiarArchivos([path.join(origen, "IMG-2026.jpg"), path.join(origen, "otra.jpg")], destino);
  check("copia lo que falta", r.copiados === 2);
  check("NO sobrescribe el archivo que ya existía",
    (await fsp.readFile(path.join(destino, "IMG-2026.jpg"), "utf8")) === "contenido B distinto");
  check("guarda el distinto como copia numerada", fs.existsSync(path.join(destino, "IMG-2026 (2).jpg")));

  const r2 = await copiarArchivos([path.join(origen, "otra.jpg")], destino);
  check("el segundo pegado idéntico se salta como duplicado", r2.duplicados === 1 && r2.copiados === 0);

  const listado = await listaCarpeta(destino);
  check("el explorador ve las fotos de la carpeta", listado.archivos.length === 3 && listado.padre === RAIZ);

  const barrido = await escanea(origen, { yaEsta: () => null });
  check("el escáner de dispositivos encuentra las fotos", barrido.archivos.length === 2 && barrido.archivos.every((a) => a.nuevo));
}

// ============================================================================
console.log("\n🔐 Seguridad");
{
  const s = new Seguridad({ pedirPin: true });
  check("el PIN tiene 4 cifras", /^\d{4}$/.test(s.pin));
  check("el token es largo y aleatorio", s.token.length >= 24);
  check("rechaza un PIN equivocado", s.entrarConPin("1.2.3.4", "0000" === s.pin ? "1111" : "0000").ok === false);
  check("acepta el PIN bueno", s.entrarConPin("1.2.3.4", s.pin).ok === true);

  const malo = s.pin === "9999" ? "1111" : "9999";
  let bloqueado = false;
  for (let i = 0; i < 8; i++) {
    const r = s.entrarConPin("9.9.9.9", malo);
    if (r.espera) bloqueado = true;
  }
  check("bloquea al que prueba PINes a lo bruto", bloqueado);

  const falsa = { socket: { remoteAddress: "192.168.1.99" }, headers: {} };
  const propia = { socket: { remoteAddress: "127.0.0.1" }, headers: {} };
  check("desde la red hace falta token", !s.autorizada(falsa, new URL("http://x/api/estado")));
  check("desde el propio ordenador no hace falta", s.autorizada(propia, new URL("http://x/api/estado")));
  check("con el token del QR entra",
    s.autorizada({ socket: { remoteAddress: "192.168.1.99" }, headers: { "x-fotos-token": s.token } }, new URL("http://x/api/estado")));

  // PIN fijo y enlace fijo (lo que pidió Pau para no depender de la ventana abierta)
  const fija = new Seguridad({ pin: "1969", token: "T".repeat(32) });
  check("acepta un PIN fijo", fija.pin === "1969" && fija.pinFijo === true);
  check("acepta un enlace fijo", fija.token === "T".repeat(32) && fija.tokenFijo === true);
  check("un PIN demasiado corto se ignora y vuelve a ser aleatorio",
    new Seguridad({ pin: "12" }).pinFijo === false);
  check("el PIN fijo también entra bien", fija.entrarConPin("1.1.1.1", "1969").ok === true);

  const cambiada = new Seguridad({});
  const tokenViejo = cambiada.token;
  const tokenGuardado = cambiada.aplicaAjustes({ pin: "4321", enlaceFijo: true });
  check("se puede fijar el PIN sin reiniciar", cambiada.pin === "4321" && cambiada.pinFijo);
  check("al fijar el enlace devuelve el token para guardarlo",
    tokenGuardado === cambiada.token && tokenGuardado.length >= 24);
  cambiada.aplicaAjustes({ enlaceFijo: false });
  check("al quitar el enlace fijo se genera uno nuevo",
    cambiada.token !== tokenGuardado && cambiada.token !== tokenViejo && !cambiada.tokenFijo);

  const { token } = s.nuevoTokenAlbum("abc", 7);
  check("el token de álbum abre solo ese álbum", s.albumDeToken(token) === "abc" && s.albumDeToken("inventado") === null);
}

// ============================================================================
console.log("\n🏠 Puente con el escaparate 3D y LimpiaFotos");
{
  // El "slug" TIENE que ser idéntico al de escaparate3d/herramientas/sincronizar.mjs:
  // si no, las fotos propias chocarían con las que descarga ese script.
  const babelDelEscaparate = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  const muestras = ["PIS0190", "Ático en Calle Rosal", "es1616045", "Piso 4º exterior, El Fontán"];
  check("usa el mismo nombre de archivo que sincronizar.mjs",
    muestras.every((m) => eco.babel(m) === babelDelEscaparate(m)));

  check("encuentra el repositorio", eco.localizaRepo() === REPO);
  const cartera = await eco.leeCartera();
  check("lee la cartera del escaparate", cartera.hay && cartera.inmuebles.length === 1);
  check("compone la etiqueta y la carpeta del inmueble",
    cartera.inmuebles[0].etiqueta.startsWith("PIS0190 — ") &&
    cartera.inmuebles[0].carpeta === "PIS0190 - Piso reformado de 3 habitaciones en el centro",
    cartera.inmuebles[0].carpeta);

  const rel1 = await eco.guardaFotoEscaparate({ referencia: "PIS0190", datos: Buffer.from("foto1"), extensionArchivo: ".jpg" });
  const rel2 = await eco.guardaFotoEscaparate({ referencia: "PIS0190", datos: Buffer.from("foto2"), extensionArchivo: ".jpg" });
  check("numera las fotos propias sin pisar las del portal",
    rel1 === "fotos/pis0190-propia-01.jpg" && rel2 === "fotos/pis0190-propia-02.jpg", `${rel1} / ${rel2}`);
  check("no admite formatos que el navegador no pinta",
    (await eco.guardaFotoEscaparate({ referencia: "PIS0190", datos: Buffer.from("x"), extensionArchivo: ".heic" })).endsWith(".jpg"));
  check("distingue lo publicable", eco.publicable("salon.jpg") && !eco.publicable("salon.heic"));

  const r = await eco.publicaEnEscaparate({ referencia: "PIS0190", relativas: [rel1, rel2] });
  const pisos = JSON.parse(await fsp.readFile(path.join(REPO, "escaparate3d", "pisos.json"), "utf8"));
  const ficha = pisos.inmuebles.find((p) => p.referencia === "PIS0190");
  check("las fotos propias quedan las primeras (portada)", ficha.imagen === rel1 && ficha.imagenes[0] === rel1);
  check("conserva las fotos que ya tenía del portal",
    ficha.imagenes.includes("fotos/pis0190-01.jpg") && ficha.imagenes.length === 4, JSON.stringify(ficha.imagenes));
  check("no duplica un inmueble que ya existía", !r.nueva && pisos.inmuebles.length === 1);
  check("deja copia de seguridad de pisos.json", fs.existsSync(path.join(REPO, "escaparate3d", "pisos.json.bak")));

  const nueva = await eco.publicaEnEscaparate({ referencia: "PIS9999", titulo: "Ático nuevo", relativas: ["fotos/pis9999-propia-01.jpg"] });
  const pisos2 = JSON.parse(await fsp.readFile(path.join(REPO, "escaparate3d", "pisos.json"), "utf8"));
  check("da de alta un inmueble que aún no estaba", nueva.nueva && pisos2.inmuebles.length === 2 &&
    pisos2.inmuebles[1].titulo === "Ático nuevo" && pisos2.inmuebles[1].activo === true);

  const origen = path.join(RAIZ, "camara", "IMG_0001.jpg");
  const prep = await eco.preparaLimpiaFotos({ carpetaBase: DESTINO, etiqueta: "PIS0190", archivos: [origen] });
  check("prepara la carpeta para LimpiaFotos",
    prep.copiadas === 1 && fs.existsSync(path.join(prep.carpeta, "IMG_0001.jpg")) && fs.existsSync(origen));
  const prep2 = await eco.preparaLimpiaFotos({ carpetaBase: DESTINO, etiqueta: "PIS0190", archivos: [origen] });
  check("no vuelve a copiar lo que ya preparó", prep2.copiadas === 0);
}

// ============================================================================
console.log("\n📱 iPhone por cable en Windows (MTP/WPD)");
{
  check("solo se activa en Windows", wpd.disponible() === (process.platform === "win32"));
  check("lee una respuesta con varios elementos", wpd.comoLista('[{"nombre":"a"},{"nombre":"b"}]').length === 2);
  check("lee una respuesta con un solo elemento (PowerShell no la mete en lista)",
    wpd.comoLista('{"nombre":"Apple iPhone"}').length === 1);
  check("aguanta una respuesta vacía o rota",
    wpd.comoLista("").length === 0 && wpd.comoLista("no es json").length === 0 && wpd.comoLista("null").length === 0);

  check("escapa las comillas al construir el guion", wpd.escapaPs("Piso d'Oviedo") === "Piso d''Oviedo");
  const guion = wpd.guionNavegar(["Apple iPhone", "Internal Storage", "DCIM"]);
  check("el guion navega paso a paso por nombres",
    guion.includes("$shell.NameSpace(17)") && guion.includes("'Apple iPhone'") && guion.includes("'DCIM'"));
  const guionMalo = wpd.guionNavegar(["x'; Remove-Item C:\\ -Recurse; '"]);
  check("un nombre con comillas no puede inyectar órdenes",
    !/\$it\.Name -eq 'x'; Remove/.test(guionMalo) && guionMalo.includes("''"));

  const dispositivos = wpd.interpretaDispositivos('[{"nombre":"Apple iPhone","tipo":"Dispositivo portátil"}]');
  check("interpreta la lista de dispositivos",
    dispositivos.length === 1 && dispositivos[0].camino[0] === "Apple iPhone" && dispositivos[0].portatil);

  const contenido = wpd.interpretaContenido(
    '[{"nombre":"DCIM","carpeta":true},{"nombre":"IMG_0001.HEIC","carpeta":false,"tamano":"2048","modificado":"2026-09-07T10:00:00"}]',
    ["Apple iPhone"],
  );
  check("separa carpetas y archivos con su camino completo",
    contenido.carpetas.length === 1 && contenido.archivos.length === 1 &&
    contenido.archivos[0].tamano === 2048 &&
    contenido.archivos[0].camino.join("/") === "Apple iPhone/IMG_0001.HEIC");

  const fake = async () => '[{"nombre":"Apple iPhone"}]';
  check("fuera de Windows no intenta nada", (await wpd.dispositivos(fake)).length === (process.platform === "win32" ? 1 : 0));
}

// ============================================================================
console.log("\n📦 Recursos incrustados (ejecutable único)");
{
  check("sin registrar nada, no está empaquetado", empaquetado() === false && recursoEmbebido("pc.html") === null);
  registraRecursos({ "prueba.html": Buffer.from("<h1>hola</h1>").toString("base64") });
  check("tras registrar, sirve el recurso desde memoria",
    empaquetado() && recursoEmbebido("prueba.html").toString() === "<h1>hola</h1>");
  check("da igual la barra inicial", recursoEmbebido("/prueba.html").toString() === "<h1>hola</h1>");
}

// ============================================================================
console.log("\n🌐 Servidor completo (subida desde el móvil, corte incluido)");
{
  guardarConfig({ carpetaDestino: DESTINO, organizarPor: "fecha", renombrar: false, abrirNavegador: false });
  const { arranca } = await import("../fotos-faciles/nucleo/servidor.mjs");
  const { servidor, seguridad, puerto } = await arranca({ puerto: 0 });
  const base = `http://127.0.0.1:${puerto}`;
  const pide = async (ruta, opciones = {}) => {
    const res = await fetch(base + ruta, opciones);
    const texto = await res.text();
    let cuerpo = null;
    try { cuerpo = JSON.parse(texto); } catch { cuerpo = texto; }
    return { res, cuerpo };
  };

  const publico = await pide("/api/estado-publico");
  check("responde el estado público sin token", publico.res.status === 200 && publico.cuerpo.app === "Fotos Fáciles");

  const estado = await pide("/api/estado");
  check("la pantalla del PC recibe QR, PIN y destino",
    estado.cuerpo.qr.startsWith("<svg") && /^\d{4}$/.test(estado.cuerpo.pin) && estado.cuerpo.destino === DESTINO);
  check("la URL del móvil lleva el token en el fragmento", estado.cuerpo.urlMovil.includes("/m#t="));

  const pagina = await pide("/");
  check("sirve la pantalla del ordenador", pagina.res.status === 200 && String(pagina.cuerpo).includes("Fotos Fáciles"));
  check("sirve la pantalla del móvil", (await pide("/m")).res.status === 200);

  // --- Subida en dos trozos con reanudación ---------------------------------
  const contenido = jpegDePrueba({ fecha: "2026:03:15 09:30:00" });
  const metaSubida = { nombre: "IMG_9999.jpg", tamano: contenido.length, fechaMod: 1_770_000_000_000, sesion: "test" };
  const abierta = await pide("/api/subida/abrir", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(metaSubida),
  });
  check("abre la subida y no tiene nada todavía", abierta.cuerpo.recibido === 0 && /^[a-f0-9]{20}$/.test(abierta.cuerpo.id));
  const id = abierta.cuerpo.id;

  const mitad = Math.floor(contenido.length / 2);
  await pide(`/api/subida/${id}?desde=0`, { method: "PUT", body: contenido.subarray(0, mitad) });

  const reabierta = await pide("/api/subida/abrir", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(metaSubida),
  });
  check("tras un corte, reconoce la subida y cuántos bytes tiene ya",
    reabierta.cuerpo.id === id && reabierta.cuerpo.recibido === mitad,
    `${reabierta.cuerpo.id} ${reabierta.cuerpo.recibido} vs ${mitad}`);

  const desfase = await pide(`/api/subida/${id}?desde=0`, { method: "PUT", body: contenido.subarray(0, 10) });
  check("rechaza un trozo con el desplazamiento equivocado", desfase.res.status === 409);

  await pide(`/api/subida/${id}?desde=${mitad}`, { method: "PUT", body: contenido.subarray(mitad) });
  const cerrada = await pide(`/api/subida/${id}/cerrar`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
  });
  check("al cerrar, la foto queda guardada", cerrada.cuerpo.estado === "guardado" && fs.existsSync(cerrada.cuerpo.ruta));
  check("la guarda en la carpeta de su fecha EXIF, no la de hoy",
    cerrada.cuerpo.ruta.includes(`${path.sep}2026-03-15${path.sep}`), cerrada.cuerpo.ruta);
  check("el archivo llega entero", fs.readFileSync(cerrada.cuerpo.ruta).equals(contenido));

  const yaTengo = await pide("/api/ya-tengo", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ archivos: [{ nombre: "IMG_9999.jpg", tamano: contenido.length }, { nombre: "nueva.jpg", tamano: 10 }] }),
  });
  check("el móvil puede preguntar qué falta antes de subir",
    yaTengo.cuerpo.conocidos[0] === true && yaTengo.cuerpo.conocidos[1] === false);

  const galeria = await pide("/api/galeria?limite=10");
  check("la galería devuelve lo importado", galeria.cuerpo.total >= 1 && galeria.cuerpo.archivos[0].nombre);

  const mini = await fetch(`${base}/api/miniatura?ruta=${encodeURIComponent(cerrada.cuerpo.ruta)}`);
  check("sirve la miniatura incrustada como JPEG", mini.headers.get("content-type") === "image/jpeg");

  const trozo = await fetch(`${base}/api/archivo?ruta=${encodeURIComponent(cerrada.cuerpo.ruta)}`, { headers: { range: "bytes=0-9" } });
  check("sirve rangos (necesario para ver vídeos)", trozo.status === 206 && (await trozo.arrayBuffer()).byteLength === 10);

  const fuera = await pide(`/api/archivo?ruta=${encodeURIComponent("/etc/shadow")}`);
  check("no deja leer archivos fuera de las carpetas permitidas", fuera.res.status === 403);

  // --- Pegar por API con seguimiento de tarea -------------------------------
  const carpetaPegar = path.join(RAIZ, "origen-api");
  await fsp.mkdir(carpetaPegar, { recursive: true });
  await fsp.writeFile(path.join(carpetaPegar, "casa.jpg"), jpegDePrueba({ fecha: "2026:01:02 10:00:00" }));
  const tarea = await pide("/api/copiar", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ archivos: [path.join(carpetaPegar, "casa.jpg")], destino: path.join(RAIZ, "pegado") }),
  });
  check("lanza la tarea de pegado", !!tarea.cuerpo.tarea);
  let fin = null;
  for (let i = 0; i < 40 && (!fin || fin.estado === "en curso"); i++) {
    fin = (await pide(`/api/tarea/${tarea.cuerpo.tarea}`)).cuerpo;
    if (fin.estado !== "en curso") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  check("la tarea termina y cuenta lo copiado", fin.estado === "terminada" && fin.copiados === 1, JSON.stringify(fin));

  // --- Compartir ------------------------------------------------------------
  const album = await pide("/api/albumes", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: "Piso Uría 12", dias: 3, archivos: [cerrada.cuerpo.ruta] }),
  });
  check("crea el enlace local", album.cuerpo.local.includes("/a/") && album.cuerpo.publico === null);
  const verAlbum = await pide(`/api/album/${album.cuerpo.token}`);
  check("el enlace enseña las fotos sin token de sesión",
    verAlbum.res.status === 200 && verAlbum.cuerpo.nombre === "Piso Uría 12" && verAlbum.cuerpo.archivos.length === 1);
  const archivoAlbum = await fetch(`${base}/a/${album.cuerpo.token}/f/0`);
  check("descarga la foto del álbum", archivoAlbum.status === 200);
  const inventado = await pide("/api/album/token-inventado");
  check("un enlace inventado no abre nada", inventado.res.status === 404);

  // --- El móvil elige carpeta del PC ---------------------------------------
  const carpetaElegida = path.join(RAIZ, "elegida-desde-el-movil");
  await fsp.mkdir(carpetaElegida, { recursive: true });
  const otroContenido = jpegDePrueba({ fecha: "2026:05:20 12:00:00" });
  const metaCarpeta = { nombre: "IMG_8888.jpg", tamano: otroContenido.length, fechaMod: 1_770_000_111_000, sesion: "movil" };
  const abre2 = await pide("/api/subida/abrir", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(metaCarpeta),
  });
  await pide(`/api/subida/${abre2.cuerpo.id}?desde=0`, { method: "PUT", body: otroContenido });
  const cierra2 = await pide(`/api/subida/${abre2.cuerpo.id}/cerrar`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ carpeta: carpetaElegida }),
  });
  check("el móvil puede mandar las fotos a una carpeta concreta del PC",
    cierra2.cuerpo.estado === "guardado" && path.dirname(cierra2.cuerpo.ruta) === carpetaElegida, cierra2.cuerpo.ruta);
  check("al elegir carpeta se respeta el nombre original",
    path.basename(cierra2.cuerpo.ruta) === "IMG_8888.jpg", cierra2.cuerpo.ruta);

  const meta3 = { nombre: "IMG_7777.jpg", tamano: otroContenido.length, fechaMod: 1_770_000_222_000, sesion: "movil" };
  const abre3 = await pide("/api/subida/abrir", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(meta3),
  });
  await pide(`/api/subida/${abre3.cuerpo.id}?desde=0`, { method: "PUT", body: otroContenido });
  const prohibida = await pide(`/api/subida/${abre3.cuerpo.id}/cerrar`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ carpeta: "/etc" }),
  });
  check("no deja escribir en una carpeta del sistema", prohibida.res.status === 403);

  const carpetaNueva = await pide("/api/carpeta", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ padre: DESTINO, nombre: "Piso Uría 12" }),
  });
  check("el móvil puede crear una carpeta nueva en el PC",
    carpetaNueva.res.status === 200 && fs.existsSync(carpetaNueva.cuerpo.ruta), JSON.stringify(carpetaNueva.cuerpo));

  // --- Puentes con el ecosistema por HTTP ----------------------------------
  const inmuebles = await pide("/api/inmuebles");
  check("la API ofrece la cartera para el desplegable",
    inmuebles.cuerpo.hay && inmuebles.cuerpo.inmuebles.some((i) => i.referencia === "PIS0190"));

  const subeFoto = await fetch(`${base}/api/escaparate/foto?referencia=PIS0190&ext=.jpg`, {
    method: "PUT", headers: { "content-type": "image/jpeg" }, body: contenido,
  });
  const fotoPublicada = await subeFoto.json();
  check("acepta una foto ya reducida para el escaparate",
    subeFoto.status === 200 && /^fotos\/pis0190-propia-\d{2}\.jpg$/.test(fotoPublicada.relativa), JSON.stringify(fotoPublicada));

  const publicada = await pide("/api/escaparate/publicar", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ referencia: "PIS0190", relativas: [fotoPublicada.relativa] }),
  });
  check("la publica en pisos.json", publicada.res.status === 200 && publicada.cuerpo.portada === fotoPublicada.relativa);

  const limpia = await pide("/api/limpiafotos", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ archivos: [cerrada.cuerpo.ruta], etiqueta: "PIS0190", abrir: false }),
  });
  check("prepara la carpeta de LimpiaFotos por HTTP", limpia.res.status === 200 && fs.existsSync(limpia.cuerpo.carpeta));

  const portatil = await pide("/api/portatil/explorar?camino=%5B%5D");
  check("fuera de Windows, el modo MTP lo dice en vez de fallar raro",
    process.platform === "win32" ? portatil.res.status === 200 : portatil.res.status === 400);

  // --- PIN y enlace fijos sobreviven al reinicio ---------------------------
  const antes = (await pide("/api/estado")).cuerpo;
  await pide("/api/config", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin: "1969", enlaceFijo: true }),
  });
  const conFijos = (await pide("/api/estado")).cuerpo;
  check("la pantalla puede fijar el PIN sin reiniciar",
    conFijos.pin === "1969" && conFijos.pinFijo === true, conFijos.pin);
  // Al fijar el enlace se conserva el token que ya estaba en uso: así el móvil
  // que acabas de emparejar no tiene que volver a escanear el QR.
  check("y fijar el enlace del móvil sin invalidar el que ya está emparejado",
    conFijos.enlaceFijo === true && conFijos.token === antes.token);

  // Se apaga y se vuelve a levantar: es la prueba de verdad.
  await new Promise((r) => servidor.close(r));
  const { olvidarConfig } = await import("../fotos-faciles/nucleo/config.mjs");
  olvidarConfig();
  const segundo = await arranca({ puerto: 0 });
  const base2 = `http://127.0.0.1:${segundo.puerto}`;
  const trasReinicio = await (await fetch(`${base2}/api/estado`)).json();
  check("tras reiniciar, el PIN sigue siendo el mismo", trasReinicio.pin === "1969", trasReinicio.pin);
  check("tras reiniciar, el enlace del móvil sigue siendo el mismo",
    trasReinicio.token === conFijos.token && trasReinicio.enlaceFijo === true);
  await new Promise((r) => segundo.servidor.close(r));

  // --- El original no se ha tocado -----------------------------------------
  check("compartir no mueve ni renombra el original", fs.existsSync(cerrada.cuerpo.ruta));

  // --- Sin token desde fuera del ordenador ---------------------------------
  check("el PIN de la sesión tiene el formato esperado", /^\d{4}$/.test(seguridad.pin));
}

// ============================================================================
await fsp.rm(RAIZ, { recursive: true, force: true });
console.log(`\n${fallados === 0 ? "✅" : "❌"}  Fotos Fáciles: ${pasados} pruebas correctas, ${fallados} fallidas\n`);
process.exit(fallados === 0 ? 0 : 1);
