// ============================================================================
//  Constructor de formularios. Cada campo se declara con un objeto:
//    { n: 'nombre', t: 'texto', etq: 'Nombre', req: true, ancho: 'mitad', ayuda: '…' }
//  Tipos: texto largo num int fecha hora email tel url select tri check
//         checks multi contacto seccion
//  Los errores del servidor ({campo: mensaje}) se pintan bajo cada campo.
// ============================================================================
import { h, icono, debounce, nombreDe } from "./ui.js";
import { api } from "./api.js";

let seq = 0;
const CLASE_ANCHO = { mitad: "mitad", tercio: "tercio", cuarto: "cuarto" };

function selectorContacto(c, valores, alCambiar, idCampo) {
  let id = valores[c.n] ?? null;
  let etq = valores[`${c.n}__etq`] || "";
  const caja = h("div", { class: "selector" });
  const input = h("input", { id: idCampo, type: "text", placeholder: c.ph || "Escribe un nombre, teléfono o correo para buscar…", autocomplete: "off" });
  const lista = h("div", { class: "lista", hidden: true, role: "listbox" });
  const fijo = h("div", { class: "seleccionado", hidden: true });

  function pintar() {
    fijo.hidden = !id;
    input.hidden = Boolean(id);
    fijo.replaceChildren(h("span", null, etq), h("button", { type: "button", class: "btn peq suave", onclick: () => { id = null; etq = ""; pintar(); alCambiar?.(null); input.focus(); } }, "Cambiar"));
  }
  const buscar = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) { lista.hidden = true; return; }
    try {
      const r = await api.get("/api/contactos", { q, limite: 8, rol: c.rol });
      lista.replaceChildren(
        ...r.datos.map((p) => h("button", { type: "button", role: "option", onclick: () => { id = p.id; etq = nombreDe(p); lista.hidden = true; input.value = ""; pintar(); alCambiar?.(id); } },
          nombreDe(p), h("small", null, [p.telefono, p.email].filter(Boolean).join(" · ") || "Sin teléfono ni correo"))),
        r.datos.length ? null : h("div", { class: "ayuda", style: { padding: "10px 12px" } }, "No hay coincidencias."),
        c.crear ? h("button", { type: "button", onclick: async () => {
          lista.hidden = true;
          const nuevo = await c.crear(q);
          if (nuevo) { id = nuevo.id; etq = nombreDe(nuevo); pintar(); alCambiar?.(id); }
        } }, `+ Crear contacto nuevo${q ? ` «${q}»` : ""}`) : null);
      lista.hidden = false;
    } catch { lista.hidden = true; }
  });
  input.addEventListener("input", buscar);
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") lista.hidden = true; });
  document.addEventListener("click", (e) => { if (!caja.contains(e.target)) lista.hidden = true; });
  pintar();
  caja.append(input, fijo, lista);
  return { el: caja, foco: () => (id ? fijo.querySelector("button") : input).focus(), leer: () => id, entrada: input };
}

function chipsMulti(c, valores, idCampo) {
  let items = [...(valores[c.n] || [])];
  const dlId = `dl-${++seq}`;
  const caja = h("div", { class: "multi" });
  const input = h("input", { id: idCampo, type: "text", list: dlId, placeholder: c.ph || "Escribe y pulsa Intro" });
  const dl = h("datalist", { id: dlId }, (c.lista || []).map((x) => h("option", { value: x })));
  function pintar() {
    caja.replaceChildren(
      ...items.map((x) => h("span", { class: "ficha" }, x, h("button", { type: "button", "aria-label": `Quitar ${x}`, onclick: () => { items = items.filter((y) => y !== x); pintar(); } }, "×"))),
      input);
  }
  function añadir() {
    const v = input.value.trim().replace(/,$/, "");
    if (v && !items.some((x) => x.toLowerCase() === v.toLowerCase())) { items.push(v); pintar(); input.focus(); }
    input.value = "";
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); añadir(); } else if (e.key === "Backspace" && !input.value && items.length) { items.pop(); pintar(); input.focus(); } });
  input.addEventListener("change", añadir);
  input.addEventListener("blur", añadir);
  pintar();
  return { el: h("div", null, caja, dl), foco: () => input.focus(), leer: () => { añadir(); return [...items]; }, entrada: input };
}

export function crearFormulario(campos, valores = {}) {
  const refs = {};
  const el = h("form", { class: "form", novalidate: true, autocomplete: "off" });
  const prefijo = `f${++seq}`;
  el.addEventListener("submit", (e) => e.preventDefault());

  for (const c of campos) {
    if (c.t === "seccion") { el.append(h("h3", { class: "sec" }, c.etq)); continue; }
    const idCampo = `${prefijo}-${c.n}`;
    const idErr = `${idCampo}-err`;
    const caja = h("div", { class: `campo ${CLASE_ANCHO[c.ancho] || ""}`.trim() });
    if (c.oculto) caja.hidden = true;
    const v = valores[c.n];
    let leer, foco, entrada;

    const etiqueta = c.t === "check" ? null
      : c.t === "checks" ? h("span", { class: "etq", id: `${idCampo}-lbl` }, c.etq)
      : h("label", { class: "etq", for: idCampo }, c.etq, c.req ? h("span", { class: "req", "aria-hidden": "true" }, "*") : null);
    let control;
    switch (c.t) {
      case "largo":
        entrada = h("textarea", { id: idCampo, rows: c.filas || 3, value: v ?? "", placeholder: c.ph, maxlength: c.max });
        control = entrada; leer = () => entrada.value.trim(); break;
      case "select": {
        // Si el registro trae un valor que ya no está en la lista (p. ej. una fuente desactivada), se conserva como opción.
        const ops = [...(c.op || [])];
        if (v !== undefined && v !== null && v !== "" && !ops.some((o) => o.valor === v)) ops.push({ valor: v, texto: String(v) });
        entrada = h("select", { id: idCampo }, c.sinVacio ? null : h("option", { value: "" }, c.vacio || "— Sin indicar —"), ops.map((o) => h("option", { value: o.valor }, o.texto)));
        entrada.value = v ?? (c.sinVacio ? ops[0]?.valor ?? "" : ""); control = entrada; leer = () => entrada.value; break;
      }
      case "tri": {
        entrada = h("select", { id: idCampo }, h("option", { value: "" }, "Sin indicar"), h("option", { value: "si" }, "Sí"), h("option", { value: "no" }, "No"));
        entrada.value = v === 1 || v === true ? "si" : v === 0 || v === false ? "no" : ""; control = entrada; leer = () => entrada.value; break;
      }
      case "check":
        entrada = h("input", { type: "checkbox", id: idCampo, checked: v === 1 || v === true });
        control = h("label", { class: "check", for: idCampo }, entrada, h("span", null, c.etq, c.ayuda ? h("span", { class: "ayuda", style: { display: "block" } }, c.ayuda) : null));
        leer = () => entrada.checked; break;
      case "checks": {
        const marcados = new Set(v || []);
        const cajas = (c.op || []).map((o) => ({ o, i: h("input", { type: "checkbox", checked: marcados.has(o.valor) }) }));
        control = h("div", { class: "chips", role: "group", "aria-labelledby": `${idCampo}-lbl` }, cajas.map(({ o, i }) => h("label", { class: "check" }, i, o.texto)));
        entrada = cajas[0]?.i; leer = () => cajas.filter((x) => x.i.checked).map((x) => x.o.valor); break;
      }
      case "multi": {
        const m = chipsMulti(c, valores, idCampo); control = m.el; leer = m.leer; entrada = m.entrada; break;
      }
      case "contacto": {
        const s = selectorContacto(c, valores, c.alCambiar, idCampo); control = s.el; leer = s.leer; entrada = s.entrada; foco = s.foco; break;
      }
      default: {
        const tipoHtml = { fecha: "date", hora: "time", email: "email", tel: "tel", url: "url" }[c.t] || "text";
        entrada = h("input", {
          type: tipoHtml, id: idCampo, value: v ?? "", placeholder: c.ph, maxlength: c.max, list: c.lista ? `${idCampo}-dl` : undefined,
          inputmode: c.t === "num" ? "decimal" : c.t === "int" ? "numeric" : undefined, autocomplete: "off",
        });
        control = c.lista ? [entrada, h("datalist", { id: `${idCampo}-dl` }, c.lista.map((x) => h("option", { value: x })))] : entrada;
        leer = () => entrada.value.trim();
      }
    }
    if (entrada && c.t !== "check" && c.t !== "checks") { entrada.setAttribute("aria-describedby", idErr); }
    const err = h("div", { class: "error-campo", id: idErr, role: "alert", hidden: true });
    caja.append(etiqueta, ...[].concat(control), c.ayuda && c.t !== "check" ? h("div", { class: "ayuda" }, c.ayuda) : null, err);
    el.append(caja);
    refs[c.n] = { c, caja, err, leer, entrada, foco: foco || (() => entrada?.focus()) };
    if (c.alEscribir && entrada) entrada.addEventListener("input", () => c.alEscribir(entrada.value, refs));
  }

  const api_ = {
    el,
    refs,
    leer() {
      const salida = {};
      for (const [n, r] of Object.entries(refs)) salida[n] = r.leer();
      return salida;
    },
    /** Pone los mensajes del servidor bajo sus campos. Devuelve los que no encajan en ningún campo. */
    mostrarErrores(mapa = {}) {
      api_.limpiarErrores();
      const sueltos = {};
      let primero = null;
      for (const [k, msg] of Object.entries(mapa)) {
        const r = refs[k];
        if (!r) { sueltos[k] = msg; continue; }
        r.caja.classList.add("invalido");
        r.err.textContent = msg;
        r.err.hidden = false;
        r.entrada?.setAttribute("aria-invalid", "true");
        if (r.caja.hidden) r.caja.hidden = false;
        primero ??= r;
      }
      primero?.foco();
      return sueltos;
    },
    limpiarErrores() {
      for (const r of Object.values(refs)) { r.caja.classList.remove("invalido"); r.err.hidden = true; r.err.textContent = ""; r.entrada?.removeAttribute("aria-invalid"); }
    },
    foco() { const primero = Object.values(refs).find((r) => !r.caja.hidden && r.entrada); primero?.foco(); },
  };
  return api_;
}

export { icono };
