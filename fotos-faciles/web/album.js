// ============================================================================
//  Fotos Fáciles — página que ve el cliente al abrir un enlace compartido
// ----------------------------------------------------------------------------
//  Solo lectura: enseña las fotos y deja descargarlas. No puede subir nada ni
//  ver el resto de la carpeta.
// ============================================================================
const $ = (s) => document.querySelector(s);
const token = location.pathname.split("/").filter(Boolean)[1] || "";

const tamanoLegible = (b) => {
  b = Number(b) || 0;
  if (b < 1024) return `${b} B`;
  const u = ["KB", "MB", "GB"];
  let v = b / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1).replace(".", ",")} ${u[i]}`;
};

async function carga() {
  try {
    const datos = await (await fetch(`/api/album/${token}`)).json();
    if (datos.error) throw new Error(datos.error);
    document.title = datos.nombre;
    $("#titulo").textContent = datos.nombre;
    $("#sub").textContent = `${datos.archivos.length} archivos · disponible hasta el ${new Date(datos.caduca).toLocaleDateString("es-ES")}`;
    $("#galeria").innerHTML = datos.archivos.map((a) => `
      <div class="miniatura" data-indice="${a.indice}" data-tipo="${a.tipo}" title="${a.nombre}">
        <img loading="lazy" src="/a/${token}/mini/${a.indice}" alt="${a.nombre}" />
        <span class="marca">${a.tipo === "video" ? "🎬 " : ""}${tamanoLegible(a.tamano)}</span>
      </div>`).join("");
    document.querySelectorAll(".miniatura").forEach((el) => {
      el.onclick = () => {
        const i = el.dataset.indice;
        $("#contenido").innerHTML = el.dataset.tipo === "video"
          ? `<video src="/a/${token}/f/${i}" controls autoplay></video>`
          : `<img src="/a/${token}/f/${i}" alt="" />`;
        $("#contenido").insertAdjacentHTML("beforeend",
          `<p style="text-align:center;margin-top:12px"><a class="boton" href="/a/${token}/f/${i}?descargar=1">⬇ Descargar</a></p>`);
        $("#visor").hidden = false;
      };
    });
  } catch (e) {
    $("#mensaje").innerHTML = `<div class="aviso error">${e.message || "Este enlace ya no está disponible."}</div>`;
    $("#sub").textContent = "";
  }
}

$("#cerrar").onclick = () => { $("#visor").hidden = true; $("#contenido").innerHTML = ""; };
$("#visor").onclick = (e) => { if (e.target.id === "visor") $("#cerrar").click(); };
carga();
