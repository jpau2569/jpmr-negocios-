/* Auditoría visual de Nicer Estudia: recorre las 9 pantallas a 320, 390,
   768 y 1366 px, en tema claro y oscuro, con datos de prueba llenos de
   palabras larguísimas (lo peor que puede pegar un alumno: un enlace), y
   avisa de desbordes horizontales, botones de menos de 30 px y errores de
   JavaScript. Tiene que terminar en «SIN PROBLEMAS».
   Uso (desde la raíz del repositorio):  node nicer-estudia/herramientas/auditoria-visual.mjs */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright";
const PORT = 8231, RAIZ = new URL("../", import.meta.url).pathname;
const MIME = { ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg" };
const server = http.createServer(async (req,res)=>{ try{ const r=req.url==="/"?"/app.html":req.url.split("?")[0];
  const d=await readFile(join(RAIZ,r)); res.writeHead(200,{"content-type":MIME[extname(r)]||"application/octet-stream"}); res.end(d);}catch{res.writeHead(404).end("no")}});
await new Promise(ok=>server.listen(PORT,ok));
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium" });
const problemas = [];
const semilla = () => {
  const clave="nicer-estudia:v1"; const e=JSON.parse(localStorage.getItem(clave));
  const A=n=>e.asignaturas.find(a=>a.nombre.startsWith(n))?.id;
  const hoy=new Date().toISOString().slice(0,10); const en=(d)=>new Date(Date.now()+d*864e5).toISOString().slice(0,10);
  const largo="Supercalifragilisticoespialidosopalabramuylargasinespacios".repeat(3);
  e.tareas=[{id:"t1",titulo:"Ejercicios "+largo,asignaturaId:A("Matem"),tipo:"deber",prioridad:"alta",repetir:"diaria",para:hoy,hecha:false,hechaEl:null,creada:hoy}];
  e.libros=[{id:"l1",asignaturaId:A("Física"),titulo:"Física y Química 2º ESO "+largo,editorial:"Anaya"}];
  e.lecciones=[{id:"x1",asignaturaId:A("Física"),libroId:"l1",titulo:"Tema 3 "+largo,texto:largo,fecha:hoy,resumida:hoy,resumen:"Resumen "+largo,
    apuntes:[{titulo:"Apartado "+largo,puntos:["Punto "+largo]}],conceptos:[{termino:largo,definicion:largo}]}];
  e.examenes=[{id:"e1",titulo:"Examen "+largo,asignaturaId:A("Física"),fecha:en(3),temas:largo,leccionIds:["x1"],nota:null}];
  e.tarjetas=[{id:"c1",asignaturaId:A("Física"),pregunta:"¿"+largo+"?",respuesta:largo,caja:0,proximo:hoy,aciertos:0,fallos:0,origen:"ia",idioma:"es",creada:hoy}];
  e.esquemas=[{id:"s1",asignaturaId:A("Física"),titulo:"Esquema",fecha:hoy,ramas:[{titulo:"R",puntos:["p"]}]}];
  e.apuntes=[{id:"n1",asignaturaId:A("Física"),titulo:"Nota "+largo,texto:largo,fecha:hoy}];
  e.notas=[{id:"no1",asignaturaId:A("Matem"),titulo:"Ex",valor:7,fecha:hoy}];
  localStorage.setItem(clave,JSON.stringify(e));
  localStorage.setItem("nicer-estudia:chat",JSON.stringify([{rol:"user",texto:largo},{rol:"profe",texto:largo,buscado:true}]));
};
const vistas = [["hoy"],["agenda"],["estudiar","lecciones"],["estudiar","leccion"],["estudiar","tarjetas"],["estudiar","test"],["estudiar","esquemas"],["profe"],["yo"]];
for (const [ancho, alto] of [[320,640],[390,844],[768,1024],[1366,768]]) {
  for (const tema of ["light","dark"]) {
    const ctx = await b.newContext({ viewport:{width:ancho,height:alto}, colorScheme: tema });
    const p = await ctx.newPage();
    const errores=[]; p.on("pageerror",e=>errores.push(String(e))); p.on("console",m=>{ if(m.type()==="error") errores.push(m.text()); });
    await p.goto(`http://localhost:${PORT}/app.html`,{waitUntil:"networkidle"});
    await p.evaluate(semilla);
    for (const [v, sub] of vistas) {
      await p.goto(`http://localhost:${PORT}/app.html?vista=${v}`,{waitUntil:"networkidle"});
      if (sub) {
        await p.click(`[data-accion="sub"][data-sub="${sub==="leccion"?"lecciones":sub}"]`);
        if (sub==="leccion") await p.click('[data-accion="abrir-leccion"]');
      }
      await p.waitForTimeout(100);
      const r = await p.evaluate(() => {
        const desborde = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const bajos = [...document.querySelectorAll("button, a.boton, input, select, textarea")]
          .filter(el => el.offsetParent && getComputedStyle(el).display!=="none" && el.getBoundingClientRect().height < 30 && el.type!=="checkbox" && el.type!=="range")
          .map(el => (el.dataset.accion||el.id||el.className||el.tagName)+":"+Math.round(el.getBoundingClientRect().height));
        const fuera = [...document.querySelectorAll("main *")].filter(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.right > document.documentElement.clientWidth+1 && !el.closest(".lienzo-esquema--grande"); }).slice(0,3).map(el=>el.tagName+"."+el.className+"["+el.textContent.trim().slice(0,20)+"]@"+Math.round(el.getBoundingClientRect().right));
        return { desborde, bajos: bajos.slice(0,5), fuera };
      });
      const nombre = `${ancho}px ${tema} ${v}${sub?"/"+sub:""}`;
      if (r.desborde>0 || r.fuera.length) problemas.push(`${nombre}: desborde ${r.desborde}px ${r.fuera.join(",")}`);
      if (r.bajos.length) problemas.push(`${nombre}: botones bajos ${r.bajos.join(" ")}`);
    }
    if (errores.length) problemas.push(`${ancho} ${tema}: errores ${errores.join(" | ")}`);
    await ctx.close();
  }
}
console.log(problemas.length ? problemas.join("\n") : "SIN PROBLEMAS");
await b.close(); server.close();
