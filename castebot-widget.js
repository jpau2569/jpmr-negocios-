// ============================================================================
//  CasteBot — widget embebible para asesoriacastresana.com (o cualquier web)
// ----------------------------------------------------------------------------
//  Se instala pegando UNA línea antes de </body> de la web:
//
//    <script src="https://TU-DOMINIO-VERCEL/castebot-widget.js" defer></script>
//
//  Pinta una burbuja flotante abajo a la derecha; al pulsarla se abre el chat
//  (castebot.html) en un panel. El widget deduce su propio dominio del src del
//  script, así que funciona igual en local, en Vercel o embebido en la web del
//  despacho. En móvil el panel ocupa toda la pantalla.
// ============================================================================

(function () {
  if (window.__casteBotCargado) return; // evita duplicados si se pega dos veces
  window.__casteBotCargado = true;

  // Origen del propio script → de ahí se sirve castebot.html
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var origen;
  try {
    origen = new URL(script.src, location.href).origin;
  } catch (e) {
    origen = location.origin;
  }
  var urlChat = origen + "/castebot.html";

  // --- Estilos (aislados con prefijo cb-) ---
  var css = [
    "#cb-burbuja{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;",
    "border:0;cursor:pointer;background:#1d3557;color:#fff;font-size:26px;box-shadow:0 6px 24px rgba(29,53,87,.35);",
    "display:grid;place-items:center;transition:transform .15s ease}",
    "#cb-burbuja:hover{transform:scale(1.07)}",
    "#cb-etiqueta{position:fixed;right:90px;bottom:32px;z-index:2147483000;background:#fff;color:#1d3557;",
    "font:600 13px/1.3 system-ui,sans-serif;padding:8px 12px;border-radius:10px;box-shadow:0 4px 16px rgba(29,53,87,.18);",
    "max-width:190px;cursor:pointer}",
    "#cb-panel{position:fixed;right:20px;bottom:92px;z-index:2147483001;width:390px;height:600px;max-height:calc(100dvh - 112px);",
    "border:0;border-radius:16px;box-shadow:0 12px 48px rgba(29,53,87,.35);background:#f7f5f0;display:none}",
    "#cb-panel.cb-abierto{display:block}",
    "@media (max-width:480px){#cb-panel{right:0;bottom:0;width:100%;height:100dvh;max-height:100dvh;border-radius:0}}",
  ].join("");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // --- Burbuja + etiqueta de invitación ---
  var burbuja = document.createElement("button");
  burbuja.id = "cb-burbuja";
  burbuja.type = "button";
  burbuja.setAttribute("aria-label", "Abrir el chat de Asesoría Castresana");
  burbuja.textContent = "💬";

  var etiqueta = document.createElement("div");
  etiqueta.id = "cb-etiqueta";
  etiqueta.textContent = "¿Hablamos? Nuestro equipo te atiende 24/7";

  // --- Panel con el chat (iframe perezoso: no carga hasta el primer clic) ---
  var panel = document.createElement("iframe");
  panel.id = "cb-panel";
  panel.title = "Chat de Asesoría Castresana";
  panel.setAttribute("loading", "lazy");

  var abierto = false;
  function alternar() {
    abierto = !abierto;
    if (abierto && !panel.src) panel.src = urlChat;
    panel.classList.toggle("cb-abierto", abierto);
    burbuja.textContent = abierto ? "✕" : "💬";
    etiqueta.style.display = "none";
  }
  burbuja.addEventListener("click", alternar);
  etiqueta.addEventListener("click", alternar);

  // La etiqueta se esconde sola a los 12 segundos para no estorbar
  setTimeout(function () { etiqueta.style.display = "none"; }, 12000);

  document.body.appendChild(panel);
  document.body.appendChild(burbuja);
  document.body.appendChild(etiqueta);
})();
