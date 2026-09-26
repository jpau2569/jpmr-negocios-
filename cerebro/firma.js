/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — firma con el dedo
   Lienzo con eventos de puntero (dedo, lápiz o ratón), trazo suave y
   nítido en pantallas de alta densidad. Exporta la firma como JPEG
   pequeño con fondo blanco (así cabe en el PDF y en el guardado).
   ═══════════════════════════════════════════════════════════════════ */

export function creaFirma(lienzo, { alCambiar } = {}) {
  const ctx = lienzo.getContext('2d');
  let trazos = 0;
  let dibujando = false;
  let ultimo = null;

  function ajusta() {
    const r = lienzo.getBoundingClientRect();
    const ppp = Math.max(1, window.devicePixelRatio || 1);
    const copia = trazos ? lienzo.toDataURL() : null;
    lienzo.width = Math.round(r.width * ppp);
    lienzo.height = Math.round(r.height * ppp);
    ctx.setTransform(ppp, 0, 0, ppp, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#10203a';
    ctx.lineWidth = 2.4;
    if (copia) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = copia;
    }
  }

  const punto = (e) => {
    const r = lienzo.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  lienzo.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lienzo.setPointerCapture?.(e.pointerId);
    dibujando = true;
    ultimo = punto(e);
    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#10203a';
    ctx.fill();
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    e.preventDefault();
    const p = punto(e);
    const medio = { x: (ultimo.x + p.x) / 2, y: (ultimo.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.quadraticCurveTo(ultimo.x, ultimo.y, medio.x, medio.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo = p;
  });
  const fin = () => {
    if (!dibujando) return;
    dibujando = false;
    trazos++;
    alCambiar?.(trazos);
  };
  lienzo.addEventListener('pointerup', fin);
  lienzo.addEventListener('pointercancel', fin);
  lienzo.addEventListener('pointerleave', fin);

  ajusta();
  window.addEventListener('resize', ajusta);

  return {
    vacia: () => trazos === 0,
    limpia() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      ctx.restore();
      trazos = 0;
      alCambiar?.(0);
    },
    /** { dataUrl, ancho, alto } — JPEG de `anchoSalida` px de ancho sobre fondo blanco. */
    aJpeg(anchoSalida = 600, calidad = 0.72) {
      const alto = Math.round((anchoSalida * lienzo.height) / lienzo.width);
      const c = document.createElement('canvas');
      c.width = anchoSalida;
      c.height = alto;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, anchoSalida, alto);
      x.drawImage(lienzo, 0, 0, anchoSalida, alto);
      return { dataUrl: c.toDataURL('image/jpeg', calidad), ancho: anchoSalida, alto };
    },
    destruye() {
      window.removeEventListener('resize', ajusta);
    },
  };
}
