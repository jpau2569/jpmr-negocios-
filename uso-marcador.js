/* Marcador de tokens y gasto de Clara — se pega en cualquier página con una línea:
 *   <script src="/uso-marcador.js" defer></script>
 *
 * Lee el contador que clara.html ya guarda en localStorage (clara_uso_v1; es el
 * mismo origen, así que lo ven todas las apps) y lo enseña como una pastilla
 * fija abajo a la izquierda: «🪙 12,3 k tokens · 0,42 $». Al pulsarla se abre el
 * detalle (entrada, salida, caché, llamadas y barra del tope).
 *
 * · Solo aparece en dispositivos que ya han usado Clara (o con ?tokens=1 una
 *   vez); un visitante cualquiera no ve nada.
 * · Solo cuenta a Clara (chat, equipo y archivos). Las demás apps que llaman a
 *   la API con la misma clave no se suman: lo dice el propio panel.
 * · No llama a ningún servidor ni toca el contador: solo lo lee.
 * · Shadow DOM: no hereda ni rompe los estilos de la página.
 */
(function () {
  "use strict";
  if (window.__usoMarcador) return;
  window.__usoMarcador = true;

  var USO_KEY = "clara_uso_v1";
  var FLAG_KEY = "uso_marcador"; // "on" (forzado con ?tokens=1) | "off" (cerrado con ✕)
  var CAMPOS = ["entrada", "salida", "cache_lectura", "cache_escritura", "llamadas", "llamadas_openrouter", "llamadas_sin_precio"];

  function lee(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guarda(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var num = function (x) { var v = Number(x); return isFinite(v) && v > 0 ? v : 0; };

  function mesLocal() {
    try {
      var p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(new Date());
      return p.find(function (x) { return x.type === "year"; }).value + "-" + p.find(function (x) { return x.type === "month"; }).value;
    } catch (e) { return new Date().toISOString().slice(0, 7); }
  }

  function leeUso() {
    try {
      var u = JSON.parse(lee(USO_KEY) || "null");
      if (u && typeof u === "object") return u;
    } catch (e) {}
    return null;
  }

  // Mismo cálculo que totalUso() de clara.html: lo de la nube + lo local del mes.
  function total(u) {
    var mes = mesLocal();
    var local = (u && u.meses && u.meses[mes]) || {};
    var nube = u && u.nube && u.nube.mes === mes ? u.nube : null;
    var t = { mes: mes, coste: num(local.coste_usd) + num(nube && nube.coste_usd), nube: Boolean(nube) };
    CAMPOS.forEach(function (c) { t[c] = num(local[c]) + num(nube && nube[c]); });
    t.tokens = t.entrada + t.salida + t.cache_lectura + t.cache_escritura;
    t.tope = num(u && u.tope) || null;
    t.pc = t.tope ? Math.round((t.coste / t.tope) * 100) : null;
    return t;
  }

  function miles(x) { return Math.round(x).toLocaleString("es-ES"); }
  function corto(x) {
    if (x >= 1e6) return (x / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " M";
    if (x >= 1e4) return (x / 1e3).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " k";
    return miles(x);
  }
  function dolares(x) {
    return x.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: x > 0 && x < 0.1 ? 4 : 2 }) + " $";
  }

  function debeVerse() {
    try {
      if (/[?&]tokens=1(&|$)/.test(location.search)) guarda(FLAG_KEY, "on");
    } catch (e) {}
    if (lee(FLAG_KEY) === "off") return false;
    return lee(FLAG_KEY) === "on" || lee(USO_KEY) !== null;
  }

  var CSS =
    ":host{all:initial}" +
    ".w{position:fixed;left:10px;bottom:10px;z-index:2147483000;font:12.5px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f4f1ff;max-width:calc(100vw - 20px)}" +
    ".pill{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.28);background:rgba(20,16,38,.88);color:inherit;" +
    "border-radius:999px;padding:6px 12px;cursor:pointer;font:inherit;box-shadow:0 4px 14px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}" +
    ".pill:focus-visible,.x:focus-visible,.a:focus-visible{outline:2px solid #ffc857;outline-offset:2px}" +
    ".pill.aviso{border-color:#ffc857}.pill.agotado{border-color:#ff6b6b;background:rgba(80,14,14,.92)}" +
    ".card{margin-bottom:8px;width:min(300px,calc(100vw - 20px));border:1px solid rgba(255,255,255,.28);background:rgba(20,16,38,.96);border-radius:14px;padding:12px 14px;box-shadow:0 8px 26px rgba(0,0,0,.45)}" +
    ".card[hidden]{display:none}.card h4{margin:0 0 6px;font-size:13px}" +
    ".f{display:flex;justify-content:space-between;gap:12px;padding:2px 0}.f span:first-child{color:#bdb6d6}" +
    ".bar{height:8px;border-radius:99px;background:rgba(255,255,255,.16);overflow:hidden;margin:8px 0 2px}" +
    ".bar i{display:block;height:100%;background:#4ade80}.bar.aviso i{background:#ffc857}.bar.agotado i{background:#ff6b6b}" +
    ".n{margin:8px 0 0;font-size:11.5px;color:#bdb6d6;line-height:1.45}" +
    ".r{display:flex;gap:10px;margin-top:8px;align-items:center;justify-content:space-between}" +
    ".a{color:#ff9cc4;font-weight:700;text-decoration:none}" +
    ".x{border:0;background:none;color:#bdb6d6;cursor:pointer;font:inherit;padding:2px 4px}";

  var host = document.createElement("div");
  host.id = "uso-marcador";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
  root.innerHTML =
    "<style>" + CSS + "</style>" +
    '<div class="w">' +
    '<div class="card" id="card" hidden role="region" aria-label="Uso de tokens este mes"></div>' +
    '<button class="pill" id="pill" type="button" aria-expanded="false" aria-controls="card" title="Tokens y gasto de Clara este mes"></button>' +
    "</div>";
  var $ = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector("#" + id); };
  var pill = $("pill"), card = $("card");

  function pinta() {
    var visible = debeVerse();
    host.style.display = visible ? "" : "none";
    if (!visible) return;
    var t = total(leeUso());
    pill.textContent = "🪙 " + corto(t.tokens) + " tokens · " + dolares(t.coste);
    pill.className = "pill" + (t.pc >= 100 ? " agotado" : t.pc >= 80 ? " aviso" : "");
    var estado = t.pc >= 100 ? "agotado" : t.pc >= 80 ? "aviso" : "";
    var llam = t.llamadas + t.llamadas_openrouter;
    var h = "<h4>🪙 Uso este mes (" + t.mes + ")</h4>" +
      '<div class="f"><span>Tokens en total</span><b>' + miles(t.tokens) + "</b></div>" +
      '<div class="f"><span>Entrada / salida</span><span>' + miles(t.entrada) + " / " + miles(t.salida) + "</span></div>" +
      '<div class="f"><span>Caché (lectura / escritura)</span><span>' + miles(t.cache_lectura) + " / " + miles(t.cache_escritura) + "</span></div>" +
      '<div class="f"><span>Llamadas</span><span>' + miles(llam) + "</span></div>" +
      '<div class="f"><span>Gasto (estimado)</span><b>' + dolares(t.coste) + "</b></div>";
    if (t.tope) {
      h += '<div class="bar ' + estado + '"><i style="width:' + Math.max(0, Math.min(100, t.pc)) + '%"></i></div>' +
        '<div class="f"><span>Tope mensual</span><span>' + dolares(t.tope) + " (" + t.pc + " %)</span></div>";
    } else {
      h += '<p class="n">Sin tope mensual (se pone en Vercel con CLARA_TOPE_MES_USD).</p>';
    }
    h += '<p class="n">' + (t.nube ? "☁️ Total de todos tus dispositivos." : "📱 Solo lo de este dispositivo.") +
      " Cuenta solo a Clara (chat, equipo y archivos); las otras apps no se suman. Precios oficiales de Anthropic; la factura real está en platform.claude.com." +
      (t.llamadas_sin_precio ? " Coste sin verificar en " + t.llamadas_sin_precio + " llamada(s)." : "") + "</p>" +
      '<div class="r"><a class="a" href="/clara.html">💬 Abrir Clara</a><button class="x" id="ocultar" type="button">Ocultar</button></div>';
    card.innerHTML = h;
    var oc = $("ocultar");
    if (oc) oc.onclick = function () { guarda(FLAG_KEY, "off"); host.style.display = "none"; };
  }

  pill.addEventListener("click", function () {
    var abre = card.hidden;
    card.hidden = !abre;
    pill.setAttribute("aria-expanded", String(abre));
  });
  window.addEventListener("storage", function (e) { if (!e.key || e.key === USO_KEY || e.key === FLAG_KEY) pinta(); });
  // Dentro de la misma pestaña (clara.html) el evento «storage» no salta: se refresca cada pocos segundos.
  setInterval(pinta, 4000);

  function monta() { document.body.appendChild(host); pinta(); }
  if (document.body) monta(); else document.addEventListener("DOMContentLoaded", monta);
})();
