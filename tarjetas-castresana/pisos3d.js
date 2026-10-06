/* ============================================================================
   Bloque «Nuestros pisos» para las tarjetas digitales de Asesoría Castresana
   ----------------------------------------------------------------------------
   Un solo archivo para todas las tarjetas. En cada tarjeta basta con:

     <section id="pisos3d" data-agente="pau" hidden></section>
     <script src="/pisos3d.js" defer></script>

   Qué hace: lee la cartera real del escaparate (/api/escaparate), enseña 4
   pisos con foto y precio y un botón que abre el escaparate 3D. Las visitas que
   pida el cliente llegan al WhatsApp de la persona de la tarjeta (?ag=<clave>).

   Si algo falla (sin red, la cartera no responde…) la tarjeta se queda igual que
   antes: el bloque solo se muestra cuando tiene algo que enseñar. Sin dependencias.
   ========================================================================== */
(function () {
  'use strict';

  var ESCAPARATE = 'https://jpmr-negocios.vercel.app/escaparate3d/';
  var API = 'https://jpmr-negocios.vercel.app/api/escaparate';
  var FOTO = 'https://jpmr-negocios.vercel.app/api/foto?u=';
  var MAX = 4;

  var host = document.getElementById('pisos3d');
  if (!host) return;

  // La clave de la persona va en la URL del escaparate; solo letras minúsculas.
  var agente = String(host.getAttribute('data-agente') || '').toLowerCase();
  if (!/^[a-z]{2,20}$/.test(agente)) agente = '';

  // El 3D solo se ve en pantallas anchas: en el móvil el escaparate enseña la lista.
  // El texto no promete lo que el cliente no va a ver.
  var ancho = !!(window.matchMedia && window.matchMedia('(min-width: 861px)').matches);

  function enlace(ref) {
    var q = [];
    if (agente) q.push('ag=' + encodeURIComponent(agente));
    if (ref) q.push('ref=' + encodeURIComponent(ref));
    return ESCAPARATE + (q.length ? '?' + q.join('&') : '');
  }

  function h(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto != null) el.textContent = texto;
    return el;
  }

  function estilos() {
    if (document.getElementById('pisos3d-css')) return;
    var s = document.createElement('style');
    s.id = 'pisos3d-css';
    s.textContent = [
      '.p3{background:var(--card,#fff);border-radius:18px;padding:18px 0 16px;overflow:hidden}',
      '.p3-head{padding:0 18px;display:flex;align-items:center;gap:10px}',
      '.p3-k{font-size:11px;letter-spacing:.16em;font-weight:600;color:var(--muted,#5D6580)}',
      '.p3-badge{margin-left:auto;background:var(--navy,#1F2D6B);color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 9px;border-radius:999px}',
      '.p3-t{padding:6px 18px 0;font-size:14px;line-height:1.45;color:var(--fg,#18203A)}',
      '.p3-strip{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:14px 18px 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}',
      '.p3-strip::-webkit-scrollbar{display:none}',
      '.p3-it{flex:0 0 150px;scroll-snap-align:start;text-decoration:none;color:inherit;border:1px solid var(--line,#E2E5EE);border-radius:14px;overflow:hidden;background:#fff;display:block}',
      '.p3-it:active{transform:scale(.98)}',
      '.p3-ph{position:relative;aspect-ratio:4/3;background:linear-gradient(140deg,#dfe4f2,#c9d1e8)}',
      '.p3-ph img{width:100%;height:100%;object-fit:cover;display:block}',
      '.p3-op{position:absolute;left:6px;top:6px;background:var(--navy,#1F2D6B);color:#fff;font-size:10px;font-weight:600;letter-spacing:.08em;padding:2px 7px;border-radius:999px;text-transform:uppercase}',
      '.p3-b{padding:8px 10px 10px}',
      '.p3-p{font-weight:700;font-size:15px;color:var(--navy,#1F2D6B)}',
      '.p3-m{font-size:11.5px;color:var(--muted,#5D6580);line-height:1.35;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.p3-cta{display:flex;align-items:center;justify-content:center;gap:10px;margin:14px 18px 0;background:var(--navy,#1F2D6B);color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:15px;border-radius:14px}',
      '.p3-cta svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}',
      '.p3-cta:active{transform:scale(.99)}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // Cuatro pisos repartidos por toda la lista (de los más caros a los más
  // asequibles), para que se vea la variedad de la cartera y no solo la cabecera.
  function elegir(items) {
    var v = items.filter(function (p) {
      return p && typeof p.foto === 'string' && /^https?:\/\//.test(p.foto) && p.precio > 0;
    });
    var ventas = v.filter(function (p) { return p.operacion !== 'alquiler'; });
    var base = ventas.length >= MAX ? ventas : v;
    if (base.length <= MAX) return base;
    var out = [];
    for (var i = 0; i < MAX; i++) out.push(base[Math.round(i * (base.length - 1) / (MAX - 1))]);
    return out;
  }

  function precio(p) {
    return Number(p.precio).toLocaleString('es-ES') + ' €' + (p.operacion === 'alquiler' ? '/mes' : '');
  }

  function meta(p) {
    var m = [];
    if (p.localidad) m.push(p.localidad);
    // Espacio duro entre número y unidad: que «4 hab.» no se parta en dos líneas.
    if (p.m2) m.push(p.m2 + ' m²');
    if (p.habitaciones) m.push(p.habitaciones + ' hab.');
    return m.join(' · ');
  }

  function miniatura(p) {
    var ref = p.ref || p.referencia || '';
    var a = h('a', 'p3-it');
    a.href = enlace(ref);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', precio(p) + ' · ' + (p.titulo || 'Inmueble'));
    var ph = h('div', 'p3-ph');
    var img = document.createElement('img');
    img.alt = p.titulo || 'Inmueble';
    img.loading = 'lazy';
    // La foto se pide a través del proxy del escaparate (cache y lista blanca de
    // dominios); si no responde se prueba la URL original y, si tampoco, se quita.
    var intento = 0;
    img.addEventListener('error', function () {
      intento++;
      if (intento === 1) img.src = p.foto;
      else img.remove();
    });
    img.src = FOTO + encodeURIComponent(p.foto);
    ph.appendChild(img);
    ph.appendChild(h('span', 'p3-op', p.operacion === 'alquiler' ? 'Alquiler' : 'Venta'));
    var b = h('div', 'p3-b');
    b.appendChild(h('div', 'p3-p', precio(p)));
    b.appendChild(h('div', 'p3-m', meta(p)));
    a.appendChild(ph);
    a.appendChild(b);
    return a;
  }

  function pinta(items, total) {
    estilos();
    host.textContent = '';
    var sec = h('div', 'p3');

    var cab = h('div', 'p3-head');
    cab.appendChild(h('span', 'p3-k', 'NUESTROS PISOS'));
    if (ancho) cab.appendChild(h('span', 'p3-badge', '3D'));
    sec.appendChild(cab);

    sec.appendChild(h('p', 'p3-t', ancho
      ? 'Recorre la cartera en 3D, marca los que te gusten y pide visita.'
      : 'Mira la cartera, marca los que te gusten y pide visita.'));

    var tira = h('div', 'p3-strip');
    items.forEach(function (p) { tira.appendChild(miniatura(p)); });
    sec.appendChild(tira);

    var cta = h('a', 'p3-cta');
    cta.href = enlace('');
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M3 7l9 5 9-5"/></svg>';
    cta.appendChild(document.createTextNode(
      'Ver ' + (total > 1 ? 'los ' + total + ' pisos' : 'nuestros pisos') + (ancho ? ' en 3D' : '')));
    sec.appendChild(cta);

    host.appendChild(sec);
    host.hidden = false;
  }

  function carga() {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(API, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function (d) {
        clearTimeout(t);
        var lista = Array.isArray(d && d.items) ? d.items : [];
        var elegidos = elegir(lista);
        // Sin pisos con foto no hay nada que enseñar: la tarjeta queda como estaba.
        if (elegidos.length) pinta(elegidos, lista.length);
      })
      .catch(function () { clearTimeout(t); /* silencioso: la tarjeta sigue funcionando sin el bloque */ });
  }

  carga();
})();
