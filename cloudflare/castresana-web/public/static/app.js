// ============================================================================
//  castresana-web — pequeñas ayudas en el navegador (las páginas funcionan
//  igual sin JavaScript; esto solo las hace más cómodas). Va en archivo
//  aparte porque la CSP no permite scripts en línea.
// ============================================================================
(function () {
  "use strict";

  // Al cambiar el inmueble o el día, se cargan solas las horas libres.
  document.querySelectorAll("select[data-autoenvio]").forEach(function (sel) {
    sel.addEventListener("change", function () {
      var form = sel.form;
      if (!form) return;
      var ref = form.querySelector("#ref");
      var fecha = form.querySelector("#fecha");
      if (ref && ref.value && (!fecha || fecha.value)) form.submit();
      else if (ref && ref.value && fecha && !fecha.value) fecha.focus();
    });
  });

  // Confirmación antes de cancelar o borrar en el panel.
  document.querySelectorAll("form[data-confirmar]").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      if (!window.confirm(form.getAttribute("data-confirmar"))) ev.preventDefault();
    });
  });

  // Evita el doble envío (dos toques seguidos en el móvil).
  document.querySelectorAll("form[method='post']").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      if (ev.defaultPrevented) return;
      if (form.dataset.enviando === "1") { ev.preventDefault(); return; }
      form.dataset.enviando = "1";
      var boton = form.querySelector("button[type='submit']");
      if (boton) { boton.setAttribute("aria-disabled", "true"); boton.classList.add("enviando"); }
    });
  });

  // Al volver atrás con el botón del móvil, la página sale de la caché con el
  // formulario «enviando»: se desbloquea.
  window.addEventListener("pageshow", function () {
    document.querySelectorAll("form[data-enviando]").forEach(function (form) {
      delete form.dataset.enviando;
      var boton = form.querySelector("button[type='submit']");
      if (boton) { boton.removeAttribute("aria-disabled"); boton.classList.remove("enviando"); }
    });
  });

  // Si hay errores, lleva el foco al resumen para que se lean.
  var resumen = document.getElementById("resumen-errores");
  if (resumen) resumen.focus();
})();
