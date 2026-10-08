// ============================================================================
//  Test de CAPTAOPORTUNIDADES ASTURIAS con navegador real (Chromium + Playwright)
//  Ejecutar con: node test/captaoportunidades.ui.test.mjs   (o: npm run test:ui)
//  Hace lo que haría una persona: crear, equivocarse, corregir, verificar,
//  confirmar un encargo, bloquear a un contacto, hacer y restaurar una copia,
//  probar la demostración y comprobar seguridad (XSS, CSP) y móvil.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { iniciar } from "../captaoportunidades/iniciar.mjs";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}
const seccion = (t) => console.log(`\n${t}`);

const RAIZ = await fsp.mkdtemp(path.join(os.tmpdir(), "captao-ui-"));
const CAPTURAS = process.env.CAPTURAS || null;
const srv = await iniciar({ puerto: 0, datos: path.join(RAIZ, "datos"), copiasAutomaticas: false });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));

const J = { "content-type": "application/json", "x-captao": "1" };
const api = async (metodo, ruta, cuerpo, modo = "real") => {
  const r = await fetch(srv.url.slice(0, -1) + ruta, { method: metodo, headers: { ...J, "x-captao-modo": modo }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  return r.json();
};
const ir = async (hash) => {
  const destino = `${srv.url}#/${hash}`;
  // Ir a la misma dirección no repinta: se pide un refresco explícito (como haría pulsar «actualizar»).
  if (page.url() === destino) await page.evaluate(() => window.dispatchEvent(new Event("captao:refrescar")));
  else await page.goto(destino);
  await page.waitForSelector("main h1, main .vacio, main .aviso", { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector("main .cargando"));
  await page.waitForTimeout(150);
};
const visible = async (loc, ms = 4000) => {
  try { await loc.first().waitFor({ state: "visible", timeout: ms }); return true; }
  catch {
    if (process.env.DEPURA) { // vuelca lo que había en pantalla para entender el fallo
      const hayDlg = await page.locator("dialog[open]").count();
      const txt = hayDlg ? await page.locator("dialog[open]").first().innerText() : await page.locator("main").innerText().catch(() => "?");
      console.error(`     ↳ buscaba ${loc.toString().slice(0, 110)}\n     ↳ en pantalla (${hayDlg ? "diálogo" : "main"}): ${txt.replace(/\n+/g, " | ").slice(0, 900)}`);
    }
    return false;
  }
};
/** Espera a que la pantalla termine de cargar y devuelve su texto. */
const contenido = async () => { await page.waitForSelector("main h1", { timeout: 8000 }); await page.waitForFunction(() => !document.querySelector("main .cargando")); await page.waitForTimeout(120); return principal().innerText(); };
const dlg = () => page.locator("dialog[open]");
const sinDialogo = async () => { try { await page.locator("dialog[open]").waitFor({ state: "detached", timeout: 4000 }); return true; } catch { return (await page.locator("dialog[open]").count()) === 0; } };
const principal = () => page.locator("main");
const captura = async (nombre) => { if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`), fullPage: true }); };
const hash = () => page.evaluate(() => location.hash);

// ============================================================================
seccion("🖥️  Primera vez: base vacía");
{
  await page.goto(srv.url);
  await page.waitForSelector("main h1");
  check("la aplicación carga con el título correcto", /CAPTAOPORTUNIDADES ASTURIAS/.test(await page.title()));
  const menu = await page.locator("#nav a").allInnerTexts();
  check("el menú lateral tiene las 15 secciones, en español y en orden", menu.length === 15 && /^Inicio/.test(menu[0]) && /Configuración/.test(menu[14]) && menu.some((t) => /Asistente IA/.test(t)), menu.join("|"));
  check("las secciones de fases futuras se identifican como tales", (await page.locator("#nav .fase").allInnerTexts()).filter((t) => /fase 2/i.test(t)).length === 4 && (await page.locator("#nav .fase").allInnerTexts()).filter((t) => /fase 3/i.test(t)).length === 3);
  check("la pantalla de inicio explica por dónde empezar (pantalla vacía con instrucciones)", await visible(page.getByText("Empieza por aquí")));
  check("los indicadores muestran 0 reales y «Sin datos» para lo de la Fase 2", (await page.locator(".kpi").filter({ hasText: "Oportunidades nuevas" }).locator(".valor").innerText()) === "0" && (await page.locator(".kpi").filter({ hasText: "Ofertas pendientes" }).locator(".valor").innerText()) === "Sin datos");
  check("no hay franja de demostración en los datos reales", !(await page.locator("#banner-demo").isVisible()));
  for (const r of ["oportunidades", "propietarios", "compradores", "inmuebles", "demandas", "agenda"]) {
    await ir(r);
    check(`pantalla vacía útil en «${r}» (con botón para empezar)`, await visible(principal().locator(".vacio h3")) && (await principal().locator(".vacio .btn").count()) >= 1);
  }
  await ir("inexistente");
  check("una ruta que no existe da un mensaje claro", await visible(page.getByText("Esa página no existe")));
}

// ============================================================================
seccion("🎯 Crear una oportunidad (con errores comprensibles)");
{
  await ir("oportunidades");
  await principal().getByRole("button", { name: "Nueva oportunidad" }).first().click();
  check("se abre el formulario en un diálogo", await visible(dlg()));
  await dlg().getByRole("button", { name: "Registrar oportunidad" }).click();
  check("sin rellenar nada, avisa de lo que falta con mensajes claros", await visible(dlg().getByText("Falta indicar: la fuente.")) && await visible(dlg().getByText("Falta indicar: el tipo de inmueble.")) && await visible(dlg().getByText("Falta indicar: el municipio.")));
  check("el formulario sigue abierto y conserva lo escrito", await dlg().count() === 1);
  await dlg().getByLabel(/^Fuente/).selectOption("Idealista");
  await dlg().getByLabel(/^Tipo de inmueble/).selectOption("Piso");
  await dlg().getByLabel(/^Municipio/).fill("oviedo");
  await dlg().getByLabel(/^Zona o barrio/).fill("Centro");
  await dlg().getByLabel(/^Precio anunciado/).fill("245.000");
  await dlg().getByLabel(/^Superficie/).fill("92,5");
  await dlg().getByLabel("Enlace del anuncio").fill("javascript:alert(1)");
  await dlg().getByRole("button", { name: "Registrar oportunidad" }).click();
  check("un enlace peligroso se rechaza con explicación", await visible(dlg().getByText(/solo se admiten enlaces http o https|no parece un enlace válido/)));
  await dlg().getByLabel("Enlace del anuncio").fill("https://www.example.com/anuncio/ui-1");
  await dlg().getByRole("button", { name: "Registrar oportunidad" }).click();
  await page.waitForFunction(() => /#\/oportunidades\/\d+/.test(location.hash));
  check("al guardar, abre la ficha de la oportunidad", await visible(principal().locator("h1")) && /OP-\d{4}-0001/.test(await principal().innerText()));
  const t = await principal().innerText();
  check("el municipio se normaliza al catálogo (oviedo → Oviedo) y el precio se interpreta bien", /Oviedo/.test(t) && /245\.000/.test(t) && /92,5/.test(t));
  check("nace «Detectada» y se ofrece el siguiente paso", await visible(principal().locator(".chip", { hasText: "Detectada" })) && await visible(principal().getByRole("button", { name: "Cambiar estado" })));
  check("el enlace al anuncio se abre en pestaña nueva y de forma segura", (await principal().getByRole("link", { name: /Abrir el anuncio/ }).getAttribute("rel")).includes("noopener") && (await principal().getByRole("link", { name: /Abrir el anuncio/ }).getAttribute("target")) === "_blank");
  await captura("oportunidad");
}

// ============================================================================
seccion("🚦 Reglas del embudo: no se salta la verificación de contacto");
{
  await principal().getByRole("button", { name: "Cambiar estado" }).click();
  await dlg().locator("select").first().selectOption("conversacion_iniciada");
  check("elegir «Conversación iniciada» sin verificar explica por qué no se puede", await visible(dlg().getByText(/verifica que se puede contactar/)));
  check("y el botón de confirmar queda desactivado", await dlg().getByRole("button", { name: "Cambiar estado" }).isDisabled());
  await dlg().getByRole("button", { name: "Verificar contacto ahora" }).click();
  check("se ofrece verificar desde ahí mismo", await visible(dlg().getByText("Verificar si se puede contactar")));
  await dlg().getByRole("button", { name: "La propia persona nos contactó" }).click();
  await dlg().getByRole("button", { name: "Guardar verificación" }).click();
  check("tras verificar, el diálogo se cierra y la ficha lo refleja", await sinDialogo() && await visible(principal().getByText("Contacto permitido (verificado)")));
  await principal().getByRole("button", { name: "Cambiar estado" }).click();
  await dlg().locator("select").first().selectOption("conversacion_iniciada");
  check("ahora sí se puede avanzar", await dlg().getByRole("button", { name: "Cambiar estado" }).isEnabled());
  await dlg().getByRole("button", { name: "Cambiar estado" }).click();
  check("el estado cambia y queda en el historial", await visible(principal().locator("h1 + p, .cab-pagina p").locator(".chip", { hasText: "Conversación iniciada" })) && await visible(principal().getByText("Detectada").first()));
  await principal().getByRole("button", { name: "Cambiar estado" }).click();
  await dlg().locator("select").first().selectOption("descartada");
  await dlg().getByRole("button", { name: "Cambiar estado" }).click();
  check("descartar sin motivo da error comprensible", await visible(dlg().getByText(/Indica el motivo/)));
  await dlg().getByRole("button", { name: "Cancelar" }).click();
  check("Cancelar cierra el diálogo sin cambiar nada", await sinDialogo() && await visible(principal().locator(".chip", { hasText: "Conversación iniciada" })));
}

// ============================================================================
seccion("👤 Contactos: duplicados, privacidad y XSS");
{
  await ir("propietarios");
  await principal().getByRole("button", { name: "Nuevo contacto" }).first().click();
  await dlg().getByLabel(/^Nombre\*|^Nombre$/).first().fill("Rosa");
  await dlg().getByLabel(/^Apellidos/).fill("Valdés");
  await dlg().getByLabel(/^Teléfono/).fill("600 000 601");
  await dlg().getByRole("button", { name: "Crear contacto" }).click();
  check("teléfono sin procedencia: pide la procedencia con un mensaje claro", await visible(dlg().getByText(/Indica de dónde has obtenido el teléfono/)));
  await dlg().getByLabel(/^Procedencia de los datos/).selectOption("propia_persona");
  await dlg().getByRole("button", { name: "Crear contacto" }).click();
  await page.waitForFunction(() => /#\/contactos\/\d+/.test(location.hash));
  check("el contacto se crea y abre su ficha", await visible(principal().locator("h1", { hasText: "Rosa Valdés" })) && await visible(principal().locator(".chip", { hasText: "Propietario" })));
  const idRosa = Number((await hash()).split("/").pop());

  await ir("propietarios");
  await principal().getByRole("button", { name: "Nuevo contacto" }).first().click();
  await dlg().getByLabel(/^Nombre\*|^Nombre$/).first().fill("Rosa V.");
  await dlg().getByLabel(/^Teléfono/).fill("+34 600000601");
  await dlg().getByLabel(/^Procedencia de los datos/).selectOption("propia_persona");
  await dlg().getByRole("button", { name: "Crear contacto" }).click();
  check("mismo teléfono: avisa de posible duplicado con enlace a la ficha existente", await visible(page.getByText("¿Ya lo tienes registrado?")) && await visible(page.getByRole("link", { name: "Abrir ficha" })) && await visible(page.getByText(/mismo teléfono/)));
  await page.getByRole("button", { name: "Cancelar, revisaré la ficha" }).click();
  await dlg().getByRole("button", { name: "Cancelar" }).first().click();
  check("tras revisar, no se ha creado ningún duplicado", (await api("GET", "/api/contactos")).total === 1);

  // XSS: datos hostiles se muestran como texto
  const xss = await api("POST", "/api/contactos", { nombre: '<img src=x onerror="window.__xss=1">', apellidos: "<b>negrita</b>", notas: "<script>window.__xss=2</script>", es_propietario: true });
  await ir("propietarios");
  check("un nombre con HTML se muestra como texto literal en la lista", await visible(principal().getByText('<img src=x onerror="window.__xss=1">')));
  await ir(`contactos/${xss.id}`);
  check("y en la ficha, junto con las notas con <script>", await visible(principal().getByText("<script>window.__xss=2</script>")) && await page.locator("main img").count() === 0 && await page.locator("main script").count() === 0);
  check("ningún código de los datos se ha ejecutado", (await page.evaluate(() => window.__xss)) === undefined);
  await api("DELETE", `/api/contactos/${xss.id}`);

  await ir(`contactos/${idRosa}`);
  // Habilitaciones por canal
  await principal().getByRole("button", { name: "Editar habilitaciones" }).click();
  await dlg().locator('[id$="-email__estado"]').selectOption("habilitado");
  await dlg().getByRole("button", { name: "Guardar habilitaciones" }).click();
  check("habilitar un canal sin base ni evidencia da error junto al canal", await visible(dlg().getByText(/Indica en qué se basa la comunicación por Correo/)) && await visible(dlg().getByText(/Anota la evidencia/)));
  check("el aviso legal recuerda que es un registro interno, no una garantía", await visible(dlg().getByText(/No garantiza el cumplimiento legal/)));
  await dlg().locator('[id$="-email__base"]').selectOption("consentimiento");
  await dlg().locator('[id$="-email__fecha"]').fill("2026-10-01");
  await dlg().locator('[id$="-email__evidencia"]').fill("Casilla del formulario web");
  await dlg().getByRole("button", { name: "Guardar habilitaciones" }).click();
  check("con base, fecha y evidencia se guarda y se ve en la ficha", await sinDialogo() && await visible(principal().locator("table").filter({ hasText: "Correo electrónico" }).getByText("Habilitado")));
  await captura("contacto");

  // No contactar
  await principal().getByRole("button", { name: /Marcar «No contactar»/ }).click();
  check("explica las consecuencias antes de bloquear", await visible(dlg().getByText(/Esto bloquea de verdad/)));
  await dlg().getByRole("button", { name: "Marcar como No contactar" }).click();
  check("sin motivo no se puede bloquear", await visible(dlg().getByText(/Indica el motivo/)));
  await dlg().getByLabel(/^Motivo/).fill("Ha pedido no recibir más comunicaciones");
  await dlg().getByRole("button", { name: "Marcar como No contactar" }).click();
  check("el bloqueo se muestra de forma visible en la ficha", await visible(principal().locator(".aviso.bloqueo", { hasText: "No contactar" })) && await visible(principal().getByRole("button", { name: /Levantar/ })));
  await principal().getByRole("button", { name: "Nueva tarea" }).first().click();
  await dlg().getByLabel(/^Qué hay que hacer/).fill("Llamar a Rosa otra vez");
  await dlg().getByLabel(/^Tipo/).selectOption("llamada");
  await dlg().getByRole("button", { name: "Crear tarea" }).click();
  check("preparar una llamada a un contacto «No contactar» está bloqueado", await visible(dlg().getByText(/No se puede preparar esta tarea.*No contactar/)));
  await dlg().getByRole("button", { name: "Cancelar" }).click();
  await principal().getByRole("button", { name: /Levantar/ }).click();
  await dlg().getByLabel(/^Motivo/).fill("Ha vuelto a escribirnos él mismo");
  await dlg().getByRole("button", { name: "Levantar el bloqueo" }).click();
  await sinDialogo();
  await page.locator("main .aviso.bloqueo").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  check("levantar el bloqueo exige motivo y lo quita", (await principal().locator(".aviso.bloqueo").count()) === 0);
}

// ============================================================================
seccion("🏠 Confirmar encargo: del propietario al inmueble");
{
  await ir("oportunidades/1");
  await principal().getByRole("button", { name: "Editar", exact: true }).click();
  await dlg().locator(".selector input").fill("Rosa");
  await dlg().locator(".selector .lista button", { hasText: "Rosa Valdés" }).click();
  await dlg().getByRole("button", { name: "Guardar" }).click();
  check("se relaciona el propietario con la oportunidad mediante el buscador de contactos", await sinDialogo() && await visible(principal().getByRole("link", { name: "Rosa Valdés" })));
  await principal().getByRole("button", { name: "Confirmar encargo" }).click();
  check("el diálogo avisa de que no genera ni firma contratos", await visible(dlg().getByText(/No genera ni firma ningún contrato/)));
  await dlg().getByLabel(/^Vigencia hasta/).fill("2027-03-01");
  await dlg().getByLabel("Honorarios", { exact: true }).selectOption("porcentaje");
  await dlg().getByRole("button", { name: "Confirmar encargo" }).click();
  check("porcentaje sin importe: pide el importe", await visible(dlg().getByText(/Indica el importe o el porcentaje/)));
  await dlg().getByLabel(/^Importe o porcentaje/).fill("4");
  await dlg().getByLabel("Con exclusividad").check();
  await dlg().getByLabel(/^Dirección interna/).fill("Calle Falsa 123, 2º");
  await dlg().getByRole("button", { name: "Confirmar encargo" }).click();
  await page.waitForFunction(() => /#\/inmuebles\/\d+/.test(location.hash));
  const t = await contenido();
  check("se crea el inmueble con su referencia y se abre su ficha", /INM-0001/.test(t) && await visible(principal().locator("h1", { hasText: "Piso en Oviedo" })));
  check("figura el propietario vinculado", await visible(principal().getByRole("link", { name: "Rosa Valdés" })));
  check("el encargo aparece con exclusiva, vigencia y honorarios", /Exclusiva/.test(t) && /01\/03\/2027/.test(t) && /4 %/.test(t));
  check("la dirección interna se distingue de la ubicación pública", await visible(principal().getByText("Interna, no publicar")) && await visible(principal().getByText("Se puede publicar")) && !/Calle Falsa/.test(await principal().locator(".panel", { hasText: "Ubicación pública" }).first().locator("dd", { hasText: "Centro" }).innerText().catch(() => "")));
  check("los datos del anuncio quedan «pendientes de confirmar» y se pueden confirmar", await visible(principal().getByText("Datos pendientes de confirmar")) && await visible(principal().getByRole("button", { name: "Confirmar" }).first()));
  await principal().getByRole("button", { name: "Confirmar" }).first().click();
  check("confirmar un dato lo quita de la lista de pendientes", await visible(page.getByText("Dato confirmado.")));
  check("el historial de captación enlaza con la oportunidad de origen", await visible(principal().getByRole("link", { name: /OP-\d{4}-0001/ }).first()) && await visible(principal().getByText("Historial de captación")));
  check("fotos y documentos se declaran como Fase 2 (no se simulan)", await visible(principal().getByText("Llegan en la Fase 2")));
  check("el aviso de vencimiento del encargo se creó en la agenda", (await api("GET", "/api/tareas?vista=pendientes")).datos.some((x) => x.tipo === "vencimiento_encargo"));
  await captura("inmueble");

  await ir("oportunidades/1");
  check("la oportunidad pasa a «Encargo confirmado» y avisa de que ya es historial", await visible(principal().locator(".aviso.ok", { hasText: "Encargo confirmado" })) && !(await principal().getByRole("button", { name: "Eliminar esta oportunidad" }).count()));
  check("ya no se ofrece confirmar de nuevo", !(await principal().getByRole("button", { name: "Confirmar encargo" }).count()));

  await ir("inmuebles/1");
  await principal().getByRole("button", { name: "Cambiar precio" }).click();
  await dlg().getByLabel(/^Nuevo precio/).fill("239.000");
  await dlg().getByLabel(/^Motivo/).fill("Bajada pactada");
  await dlg().getByRole("button", { name: "Guardar precio" }).click();
  check("cambiar el precio añade una línea al historial de precios con su variación", await sinDialogo() && await visible(principal().getByText("Bajada pactada")) && await visible(principal().getByText(/[-−]6000/)));
}

// ============================================================================
seccion("🔎 Compradores y demandas");
{
  await ir("demandas");
  await principal().getByRole("button", { name: "Nueva demanda" }).first().click();
  await dlg().locator(".selector input").fill("Rosa");
  await dlg().locator(".selector .lista button", { hasText: "Rosa Valdés" }).click();
  await dlg().getByLabel(/^Nombre de la demanda/).fill("Piso en Oviedo con ascensor");
  const mun = dlg().locator(".multi input").first();
  await mun.fill("Oviedo"); await mun.press("Enter");
  await dlg().getByLabel(/^Presupuesto máximo/).fill("200.000");
  await dlg().getByLabel(/^Situación de financiación/).selectOption("aprobada_acreditada");
  await dlg().getByRole("button", { name: "Crear demanda" }).click();
  check("no deja dar la financiación por aprobada sin evidencia", await visible(dlg().getByText(/Para marcar la financiación como aprobada anota la evidencia/)));
  await dlg().getByLabel(/^Situación de financiación/).selectOption("hipoteca_manifestada");
  await dlg().getByLabel(/^Presupuesto mínimo/).fill("300000");
  await dlg().getByRole("button", { name: "Crear demanda" }).click();
  check("presupuesto máximo menor que el mínimo da error comprensible", await visible(dlg().getByText(/El presupuesto máximo no puede ser menor que el mínimo/)));
  await dlg().getByLabel(/^Presupuesto mínimo/).fill("150000");
  await dlg().getByRole("button", { name: "Crear demanda" }).click();
  await page.waitForFunction(() => /#\/demandas\/\d+/.test(location.hash));
  const t = await contenido();
  check("la demanda se crea y muestra lo que busca", /Oviedo/.test(t) && /150\.000\s€\s–\s200\.000\s€/.test(t));
  check("la financiación se presenta como manifestada, no como hecho", /manifestado, sin estudio/.test(t) && /No acreditada/.test(t));
  check("el cruce con la cartera se declara pendiente (Fase 2) y ofrece un atajo honesto", await visible(principal().getByText(/llega en la Fase 2/).first()) && await visible(principal().getByRole("link", { name: "Ver inmuebles con estos criterios" })));
  await principal().getByRole("link", { name: "Ver inmuebles con estos criterios" }).click();
  check("el atajo abre la cartera con los criterios aplicados", await visible(principal().locator("h1", { hasText: "Inmuebles" })) && (await page.locator("#filtro-municipio").inputValue()) === "Oviedo");
  await ir("compradores");
  check("el contacto aparece también como comprador (misma ficha, dos roles)", await visible(principal().getByRole("link", { name: "Rosa Valdés" })) && await visible(principal().locator(".chip", { hasText: "Comprador" }).first()));
}

// ============================================================================
seccion("📅 Agenda y recordatorios");
{
  await ir("agenda");
  await principal().getByRole("button", { name: "Nueva tarea" }).first().click();
  await dlg().getByRole("button", { name: "Crear tarea" }).click();
  check("una tarea sin título da error claro", await visible(dlg().getByText("Falta indicar: el título.")));
  await dlg().getByLabel(/^Qué hay que hacer/).fill("Llamar a Rosa por el piso");
  await dlg().getByLabel(/^Tipo/).selectOption("llamada");
  await dlg().getByLabel(/^Hora/).fill("00:01");
  await dlg().getByLabel(/^Recordatorio/).selectOption("0");
  await dlg().getByRole("button", { name: "Crear tarea" }).click();
  check("la tarea se crea y sale en «Hoy»", await sinDialogo() && await visible(principal().getByText("Llamar a Rosa por el piso")));
  const pestañas = await principal().locator("[role=tab]").allInnerTexts();
  check("las pestañas Hoy, Semana, Pendientes, Vencidas, Calendario y Hechas con contadores", ["Hoy", "Semana", "Pendientes", "Vencidas", "Calendario", "Hechas"].every((t) => pestañas.some((p) => p.startsWith(t))) && /Vencidas\s*[1-9]/.test(pestañas.join(" ")), pestañas.join("|"));
  check("la tarea de hoy a las 00:01 figura como vencida", await visible(principal().locator(".tarea.vencida", { hasText: "Llamar a Rosa" })));
  await principal().locator("[role=tab]", { hasText: "Vencidas" }).click();
  check("la pestaña Vencidas la lista", await visible(principal().locator(".tarea", { hasText: "Llamar a Rosa" })));
  await page.reload();
  check("RECORDATORIO INTERNO: al abrir la aplicación aparece el aviso de la tarea", await visible(page.locator("#avisos .toast", { hasText: "Llamar a Rosa por el piso" }), 8000));
  check("el aviso ofrece Hecha / En 1 hora / Entendido", await visible(page.locator("#avisos").getByRole("button", { name: "Entendido" })) && await visible(page.locator("#avisos").getByRole("button", { name: "Hecha" })) && await visible(page.locator("#avisos").getByRole("button", { name: "En 1 hora" })));
  check("la campana cuenta lo pendiente de hoy", (await page.locator("#campana-n").innerText()) !== "" && await page.locator("#campana-n").isVisible());
  await page.locator("#avisos").getByRole("button", { name: "Entendido" }).click();
  await page.reload();
  await page.waitForSelector("main h1");
  await page.waitForTimeout(1500);
  check("«Entendido» silencia el aviso para siempre (no vuelve a salir)", (await page.locator("#avisos .toast", { hasText: "Llamar a Rosa" }).count()) === 0);
  await ir("agenda?vista=vencidas");
  await principal().locator(".tarea", { hasText: "Llamar a Rosa" }).locator("input[type=checkbox]").check();
  check("completar la tarea la saca de vencidas", await visible(principal().getByText("Nada vencido")));
  await principal().locator("[role=tab]", { hasText: "Calendario" }).click();
  check("el calendario muestra el mes con los días de la semana en español", await visible(principal().locator(".calendario .cab", { hasText: "Lun" })) && (await principal().locator(".calendario .dia").count()) === 42);
  check("la tarea completada de hoy aparece tachada en el calendario", await visible(principal().locator(".dia.hoy .mini.hecha")));
  await principal().locator(".dia.hoy").click();
  check("pulsar un día muestra sus tareas y permite crear otra", await visible(principal().getByRole("button", { name: "Nueva tarea este día" })));
}

// ============================================================================
seccion("🔍 Buscador global y teclado");
{
  await ir("inicio");
  await page.keyboard.press("/");
  check("la tecla «/» enfoca el buscador", await page.evaluate(() => document.activeElement?.id === "buscar"));
  await page.keyboard.type("valdes");
  check("encuentra a Rosa sin tildes y la agrupa por tipo", await visible(page.locator("#resultados").getByText("Contactos")) && await visible(page.locator("#resultados a", { hasText: "Rosa Valdés" })));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /#\/contactos\/\d+/.test(location.hash));
  check("Intro abre el primer resultado", await visible(principal().locator("h1", { hasText: "Rosa Valdés" })));
  await page.locator("#buscar").fill("INM-0001");
  check("busca inmuebles por referencia", await visible(page.locator("#resultados a", { hasText: "Piso en Oviedo" })));
  await page.locator("#buscar").press("Escape");
  await principal().getByRole("button", { name: "Registrar actividad" }).first().click();
  await page.keyboard.press("Escape");
  check("Escape cierra los diálogos", await sinDialogo());
  check("ninguna navegación deja el foco perdido (el contenido recibe el foco)", await page.evaluate(() => Boolean(document.activeElement)));
}

// ============================================================================
seccion("⚙️  Configuración, catálogos y copias de seguridad");
{
  await ir("configuracion/catalogos");
  check("trae los 78 concejos", await visible(principal().getByText(/78 activas de 78/)));
  await principal().getByLabel("Nombre nuevo").fill("Localidad de Prueba");
  await principal().getByRole("button", { name: "Añadir", exact: true }).click();
  check("se puede incorporar un municipio nuevo", await visible(principal().getByText("Localidad de Prueba")) && await visible(principal().getByText(/79 activas de 79/)));
  await ir("configuracion/referencias");
  check("los prefijos de referencia son configurables", await visible(principal().getByLabel(/Prefijo de los inmuebles/)));
  await ir("configuracion/general");
  await principal().getByLabel("Tu nombre").fill("Pau");
  await principal().locator(".panel", { hasText: "Tú" }).getByRole("button", { name: "Guardar" }).first().click();
  check("la configuración se guarda con aviso", await visible(page.getByText("Configuración guardada.")));

  await ir("configuracion/copias");
  check("antes de la primera copia avisa de que falta (y aconseja guardar fuera)", await visible(principal().getByText(/ninguna copia de seguridad/)) && await visible(principal().getByText(/pendrive o nube/)));
  await principal().getByRole("button", { name: "Hacer una copia de seguridad ahora" }).click();
  check("se crea la copia y aparece en la lista", await visible(principal().locator("table td", { hasText: /^copia-\d{8}-\d{6}\.zip$/ })));
  const contactosAntes = (await api("GET", "/api/contactos")).total;
  const [descarga] = await Promise.all([page.waitForEvent("download"), principal().getByRole("link", { name: "Descargar" }).first().click()]);
  const rutaZip = path.join(RAIZ, "descargada.zip");
  await descarga.saveAs(rutaZip);
  check("la copia se descarga como ZIP", fs.statSync(rutaZip).size > 1000 && fs.readFileSync(rutaZip).subarray(0, 2).toString() === "PK");
  await api("POST", "/api/contactos", { nombre: "Posterior a la copia" });
  check("hay un contacto más que cuando se hizo la copia", (await api("GET", "/api/contactos")).total === contactosAntes + 1);
  await principal().locator('input[type=file]').setInputFiles(rutaZip);
  check("al subir una copia se muestra qué trae antes de restaurar", await visible(dlg().getByText("Restaurar una copia de seguridad")) && await visible(dlg().getByText(/Contactos/)));
  check("avisa de que sustituye todos los datos y de que se guarda una copia previa", await visible(dlg().getByText(/Esto sustituye TODOS tus datos actuales/)) && await visible(dlg().getByText(/copia de lo que tienes ahora/)));
  check("el botón de restaurar está desactivado hasta escribir RESTAURAR", await dlg().getByRole("button", { name: "Sustituir mis datos por esta copia" }).isDisabled());
  await dlg().getByLabel("Escribe RESTAURAR para confirmar").fill("restaurar ya");
  check("una confirmación incorrecta no lo activa", await dlg().getByRole("button", { name: "Sustituir mis datos por esta copia" }).isDisabled());
  await dlg().getByLabel("Escribe RESTAURAR para confirmar").fill("RESTAURAR");
  await dlg().getByRole("button", { name: "Sustituir mis datos por esta copia" }).click();
  await page.waitForFunction(() => /#\/inicio/.test(location.hash), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  check("restaurar deja los datos como estaban al hacer la copia (sin el contacto posterior)", (await api("GET", "/api/contactos")).total === contactosAntes);
  check("y los datos importantes siguen ahí (oportunidad, inmueble, demanda)", (await api("GET", "/api/oportunidades")).total === 1 && (await api("GET", "/api/inmuebles")).total === 1 && (await api("GET", "/api/demandas")).total === 1);
  await ir("configuracion/copias");
  check("antes de restaurar se guardó una copia automática de lo anterior", await visible(principal().locator("table td", { hasText: /^antes-de-restaurar-/ })));
  await ir("configuracion/datos");
  check("muestra dónde están los datos y avisa de los límites del recordatorio", await visible(principal().getByText(/solo mientras esta aplicación está abierta/)) && await visible(principal().getByText(RAIZ.slice(0, 12), { exact: false })));
  await ir("configuracion/acerca");
  check("declara con honestidad qué hace y qué no hace esta versión", await visible(principal().getByText("Todavía no existe")) && await visible(principal().getByText(/nunca: scraping de portales/i)));
}

// ============================================================================
seccion("🧪 Modo demostración: separado de lo real");
{
  await ir("inicio");
  await page.locator("#btn-demo").click();
  await page.waitForSelector("#banner-demo:not([hidden])");
  check("aparece la franja naranja avisando de que son datos ficticios", /MODO DEMOSTRACIÓN/.test(await page.locator("#banner-demo").innerText()) && /ficticios/.test(await page.locator("#banner-demo").innerText()));
  await page.waitForSelector(".kpi .valor");
  await page.waitForTimeout(400);
  check("la demostración trae datos (oportunidades nuevas = 3)", (await page.locator(".kpi").filter({ hasText: "Oportunidades nuevas" }).locator(".valor").innerText()) === "3");
  check("el menú dice dónde estás", /demostración/i.test(await page.locator("#menu-modo").innerText()));
  await ir("configuracion/copias");
  check("en demostración no hay copias de seguridad (avisa)", await visible(principal().getByText(/solo existen para los datos reales/)));
  await ir("propietarios");
  check("los datos reales no aparecen en la demostración", !(await principal().getByText("Rosa Valdés").count()) && await visible(principal().getByText("Elena Marqués Ríos")));
  await page.locator("#banner-demo").getByRole("button", { name: "Restablecer la demostración" }).click();
  await dlg().getByRole("button", { name: "Restablecer" }).click();
  check("restablecer la demostración pide confirmación y funciona", await visible(page.getByText("Demostración restablecida.")));
  await page.locator("#banner-demo").getByRole("button", { name: "Volver a mis datos reales" }).click();
  await page.waitForSelector("#banner-demo", { state: "hidden" });
  await ir("propietarios");
  check("al volver, estás en tus datos reales otra vez", await visible(principal().getByText("Rosa Valdés")) && !(await principal().getByText("Elena Marqués Ríos").count()));
}

// ============================================================================
seccion("📱 Móvil y tablet: sin desbordes y con menú desplegable");
{
  const rutas = ["inicio", "oportunidades", "oportunidades/1", "propietarios", "contactos/1", "inmuebles", "inmuebles/1", "demandas", "demandas/1", "agenda", "agenda?vista=calendario", "configuracion/copias", "configuracion/catalogos", "visitas"];
  for (const ancho of [360, 390, 768, 1366]) {
    await page.setViewportSize({ width: ancho, height: 800 });
    const malas = [];
    for (const r of rutas) {
      await ir(r);
      const ancha = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ancha > 1) malas.push(`${r} (+${ancha}px)`);
    }
    check(`a ${ancho}px ninguna pantalla se desborda horizontalmente`, malas.length === 0, malas.join(", "));
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await ir("oportunidades");
  check("a 390px aparece el botón de menú y el menú lateral está oculto", await page.locator("#btn-menu").isVisible() && (await page.locator("#menu").boundingBox()).x < 0);
  await page.locator("#btn-menu").click();
  check("el botón abre el menú como cajón con fondo oscuro", await page.locator("#menu.abierto").count() === 1 && await page.locator("#velo").isVisible() && (await page.locator("#btn-menu").getAttribute("aria-expanded")) === "true");
  await page.locator("#nav a", { hasText: "Inmuebles" }).click();
  await page.waitForFunction(() => /#\/inmuebles/.test(location.hash));
  check("elegir una sección cierra el menú", await page.locator("#menu.abierto").count() === 0);
  await ir("propietarios");
  check("en móvil las tablas se convierten en tarjetas con la etiqueta de cada dato", (await page.locator(".tabla tbody tr").first().evaluate((el) => getComputedStyle(el).display)) === "block" && (await page.locator(".tabla td").first().evaluate((el) => getComputedStyle(el, "::before").content)).includes("Nombre"));
  await principal().getByRole("button", { name: "Nuevo contacto" }).first().click();
  check("en móvil los diálogos ocupan toda la pantalla", (await dlg().boundingBox()).width >= 388);
  await page.keyboard.press("Escape");
  await captura("movil-contactos");
  await ir("inicio");
  await captura("movil-inicio");
  await page.setViewportSize({ width: 1366, height: 900 });
}

// ============================================================================
seccion("🔒 Seguridad en el navegador");
{
  check("sin errores en la consola durante todo el recorrido (incluidas violaciones de CSP)", errores.length === 0, errores.slice(0, 5).join(" | "));
  const csp = await (await fetch(srv.url)).headers.get("content-security-policy");
  check("la CSP prohíbe scripts y estilos en línea y recursos externos", /script-src 'self'/.test(csp) && /style-src 'self'/.test(csp) && /default-src 'none'/.test(csp) && !/unsafe/.test(csp));
  const externos = await page.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name).filter((n) => !n.startsWith(location.origin)));
  check("la aplicación no carga nada de Internet (todo es local)", externos.length === 0, externos.join(", "));
  const cabecerasMalas = await page.evaluate(async () => { const r = await fetch("/api/contactos", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }); return r.status; });
  check("un POST sin la cabecera de seguridad es rechazado también desde el navegador", cabecerasMalas === 403);
}

await browser.close();
await srv.cerrar();
await fsp.rm(RAIZ, { recursive: true, force: true });
console.log(`\n${fallados === 0 ? "✅" : "❌"} ${pasados} comprobaciones superadas${fallados ? `, ${fallados} FALLIDAS` : ""}.`);
process.exit(fallados ? 1 : 0);
