/* ═══════════════════════════════════════════════════════════════════
   DOSIER DE VALORACIÓN 3D — montaje de la página
   Se abre con  dosier-valoracion/?p=pis0212  (por defecto pis0212) y lee
   datos/<p>.json. Todo texto que viene del JSON pasa por escapaHtml.
   ═══════════════════════════════════════════════════════════════════ */

import { escapaHtml as esc } from '../cerebro/utiles.js';
import { construirDosier, euros, miles, fechaLarga, AVISO_VALORACION } from './calculo.js';
import { montarEscena, hayWebGL } from './escena.js';

const $ = (s, r = document) => r.querySelector(s);

async function cargaDatos() {
  const p = new URLSearchParams(location.search).get('p') || 'pis0212';
  if (!/^[a-z0-9-]{1,40}$/i.test(p)) throw new Error('Referencia no válida.');
  const r = await fetch(`datos/${p.toLowerCase()}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se encuentra este dosier.');
  return r.json();
}

const fila = (k, v) => (v || v === 0) ? `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>` : '';
const si = (v) => (v ? 'Sí' : 'No');

function veredicto(d, m) {
  const { calculo, posicion } = m;
  if (!calculo.suficiente || !posicion) {
    return 'Todavía no hay comparables suficientes para dar un rango. Necesitamos al menos tres inmuebles parecidos para poder hacerlo con honestidad.';
  }
  const pub = euros(d.inmueble.precioPublicado);
  const rango = `${euros(calculo.valor.bajo)} y ${euros(calculo.valor.alto)}`;
  const b = m.bajada;
  const historia = b ? ` El piso salió a <b>${euros(b.anterior)}</b>${b.escalones > 2 ? ', pasó por precios intermedios' : ''} y se bajó hasta ${pub} (<b>−${b.diferencia.toLocaleString('es-ES')} €, un ${b.porcentaje.toFixed(1).replace('.', ',')} %</b>). Esa bajada puede ser una señal de que el mercado no aceptó el precio anterior, y es un motivo más para contrastar antes de subirlo.` : '';
  const cautela = historia + ' Ojo: los comparables son precios <b>pedidos</b>, no de venta cerrada, y son pocos. Por eso esto no es una orden de subir el precio, sino la razón para contrastarlo con ventas cerradas antes de decidir.';
  if (posicion.lugar === 'debajo') return `El precio publicado (<b>${pub}</b>) está <b>por debajo</b> del rango que sugieren los comparables, entre ${rango}.${cautela}`;
  if (posicion.lugar === 'encima') return `El precio publicado (<b>${pub}</b>) está <b>por encima</b> del rango que sugieren los comparables, entre ${rango}. Un precio por encima del mercado suele alargar el tiempo de venta o forzar una bajada posterior.${cautela}`;
  return `El precio publicado (<b>${pub}</b>) está <b>dentro</b> del rango que sugieren los comparables, entre ${rango}.${cautela}`;
}

function historia(d) {
  const h = d.inmueble.historialPrecios;
  if (!Array.isArray(h) || h.length < 2) return '';
  const paso = (x, k) => `<li${k === h.length - 1 ? ' class="hoy"' : ''}><b>${euros(x.precio)}</b><span>${k === h.length - 1 ? 'precio actual' : k === 0 ? 'precio inicial' : 'primera bajada'}</span><em>${Number.isFinite(x.visitas) ? `${x.visitas} visitas` : 'visitas sin datos'}</em></li>`;
  return `<div class="historia"><h3>Cómo ha respondido el mercado a cada precio</h3><ol>${h.map(paso).join('')}</ol><p class="pequeno suave">Ojo: no sabemos cuánto tiempo estuvo a cada precio, así que las visitas no son una tasa por día. Y una visita no es una oferta: las ofertas están pendientes de confirmar.</p></div>`;
}

function seccionRango(d, m) {
  const c = m.calculo;
  if (!c.suficiente) return `<p class="suave">Sin comparables suficientes no se muestra rango.</p>`;
  const pub = d.inmueble.precioPublicado;
  const lo = Math.min(c.valor.bajo, pub) * 0.94, hi = Math.max(c.valor.alto, pub) * 1.06;
  const pos = (x) => `${(((x - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  return `<div class="rango" role="img" aria-label="Rango orientativo de ${miles(c.valor.bajo)} a ${miles(c.valor.alto)} euros; valor central ${miles(c.valor.central)} euros; precio publicado ${miles(pub)} euros.">
    <div class="rango__pista">
      <div class="rango__banda" style="left:${pos(c.valor.bajo)};width:calc(${pos(c.valor.alto)} - ${pos(c.valor.bajo)})"></div>
      <div class="rango__marca" style="left:${pos(c.valor.central)}"><span>Central ${euros(c.valor.central)}</span></div>
      <div class="rango__marca rango__marca--pub" style="left:${pos(pub)};background:#7a2b12"><span>Publicado ${euros(pub)}</span></div>
    </div>
    <div class="rango__pie"><span>Bajo · ${euros(c.valor.bajo)}</span><span>Alto · ${euros(c.valor.alto)}</span></div>
  </div>`;
}

function tabla(m) {
  const c = m.calculo;
  const filas = m.torres.filter((t) => t.tipo === 'comparable').map((t) => `
    <tr><td><b>${esc(t.id)}</b><div class="pequeno suave">${esc(t.detalle)}</div></td>
    <td class="n">${euros(t.precio)}</td><td class="n">${esc(String(t.m2))} m²</td>
    <td class="n">${miles(t.eurM2SinAjuste)}</td>
    <td class="n">${t.ajuste ? `${t.ajuste > 0 ? '+' : ''}${t.ajuste} %` : '—'}</td>
    <td class="n"><b>${miles(t.eurM2)}</b></td></tr>
    ${t.motivo ? `<tr><td colspan="6" class="pequeno suave">↳ ${esc(t.motivo)}</td></tr>` : ''}`).join('');
  const suyo = Number.isFinite(m.eurM2Publicado) ? `<tr class="suyo"><td>Su piso (precio publicado)</td><td class="n">${euros(m.torres.find((t) => t.id === 'publicado').precio)}</td><td class="n">${esc(String(m.torres.find((t) => t.id === 'publicado').m2))} m²</td><td class="n">${miles(m.eurM2Publicado)}</td><td class="n">—</td><td class="n">${miles(m.eurM2Publicado)}</td></tr>` : '';
  const res = c.suficiente ? `<tr class="suyo"><td>Mediana de los comparables (ajustada)</td><td class="n" colspan="4"></td><td class="n">${miles(c.porM2.mediana)}</td></tr>` : '';
  return `<div class="tabla-esc"><table><thead><tr><th>Comparable</th><th class="n">Precio pedido</th><th class="n">Superficie</th><th class="n">€/m²</th><th class="n">Ajuste</th><th class="n">€/m² ajustado</th></tr></thead><tbody>${filas}${suyo}${res}</tbody></table></div>`;
}

function html(d, m) {
  const i = d.inmueble, a = d.agente, c = m.calculo;
  const tel = (a.telefonos || []).map((t) => esc(t)).join(' · ');
  const suma = [
    i.garaje && `<b>Garaje incluido en el precio</b>: ${esc(i.garaje)}.`,
    i.ascensor && 'Ascensor y acceso adaptado para movilidad reducida.',
    i.orientacion && `Orientación ${esc(i.orientacion.toLowerCase())}${i.vistas ? ` y vistas ${esc(i.vistas.toLowerCase())}` : ''}${i.exterior ? ', vivienda exterior' : ''}.`,
    `${esc(String(i.habitaciones))} dormitorios y ${esc(i.cocina ? i.cocina.toLowerCase() : 'cocina')}.`,
    'Se puede entrar a vivir: buen estado, semi-amueblado, ventanas de PVC con doble acristalamiento.',
  ].filter(Boolean);
  const resta = [
    Number(i.banos) === 1 && 'Tiene <b>un solo baño</b>; varios de los comparables tienen dos.',
    'No está reformado, y dos de los comparables sí lo están.',
    !i.certificadoEnergetico && 'El <b>certificado energético</b> no consta correctamente en la ficha.',
    'La ficha no menciona terraza ni trastero, que sí tiene el comparable más parecido (PIS0206).',
  ].filter(Boolean);

  return `
  <section class="portada" id="portada">
    ${d.fotos?.[0] ? `<div class="portada__foto" style="background-image:url('${esc(d.fotos[0])}')"></div>` : ''}
    <div class="portada__cont">
      <div class="marca">${esc(a.empresa)}</div>
      <div>
        <h1>Dosier de valoración<br>${esc(i.titulo)}</h1>
        <p class="sub">Análisis del mercado y precio de venta orientativo, preparado para el propietario. Explora los comparables en 3D.</p>
        <div class="datos-portada">
          <p><b>Referencia</b><span>${esc(i.ref)}</span></p>
          <p><b>Preparado</b><span>${esc(fechaLarga(d.fecha))}</span></p>
          <p><b>Agente</b><span>${esc(a.nombre)}</span></p>
        </div>
      </div>
    </div>
  </section>

  <section id="resumen"><div class="envoltura">
    <h2><small>1 · Resumen</small>Dónde está su piso en el mercado</h2>
    <div class="cifras">
      <div class="cifra"><b>Precio publicado</b><strong>${euros(i.precioPublicado)}</strong><small>${m.bajada ? `Antes ${euros(m.bajada.anterior)} · ` : i.bajadaDePrecio ? 'Tras una bajada de precio · ' : ''}${miles(m.eurM2Publicado)} €/m² construido</small></div>
      ${c.suficiente ? `<div class="cifra cifra--oro"><b>Rango orientativo</b><strong>${miles(c.valor.bajo)} – ${miles(c.valor.alto)} €</strong><small>Valor central ${euros(c.valor.central)}</small></div>
      <div class="cifra"><b>Mediana de la muestra</b><strong>${miles(c.porM2.mediana)} €/m²</strong><small>${c.n} comparables, ya ajustados</small></div>` : `<div class="cifra"><b>Rango orientativo</b><strong>—</strong><small>Faltan ${c.faltan} comparables</small></div>`}
    </div>
    <div class="veredicto">${veredicto(d, m)}</div>
    ${historia(d)}
    ${d.mercado?.demandaTrasBajada ? `<div class="veredicto" style="border-left-color:var(--ok)"><b>Lo que ha dicho el mercado.</b> ${esc(d.mercado.demandaTrasBajada)} Es la señal más directa que tenemos: a ${euros(d.inmueble.precioPublicado)} hay demanda real. Los comparables son precios <b>pedidos</b>, así que el rango de arriba es una <b>referencia de techo</b>, no una promesa de precio de cierre. Cualquier subida se decidiría con usted, vigilando que no se pierda esa demanda.</div>` : ''}
  </div></section>

  <section id="inmueble" style="background:var(--papel-2)"><div class="envoltura">
    <h2><small>2 · El inmueble</small>Lo que tiene su piso</h2>
    <dl class="ficha">
      ${fila('Superficie', `${i.m2Construidos} m² construidos · ${i.m2Utiles} m² útiles`)}
      ${fila('Distribución', `${i.habitaciones} dormitorios · ${i.banos} baño${Number(i.banos) === 1 ? '' : 's'}`)}
      ${fila('Planta', `${i.planta}${i.exterior ? ' · exterior' : ''}`)}
      ${fila('Ascensor', si(i.ascensor))}
      ${fila('Orientación', i.orientacion)}
      ${fila('Vistas', i.vistas)}
      ${fila('Garaje', i.garaje)}
      ${fila('Estado', i.estado)}
      ${fila('Cocina', i.cocina)}
      ${fila('Calefacción', i.calefaccion)}
      ${fila('Certificado energético', i.certificadoEnergetico || 'Pendiente de confirmar')}
    </dl>
    ${i.equipamiento?.length ? `<p class="pequeno suave" style="margin-top:1rem">Además: ${i.equipamiento.map(esc).join(' · ')}.</p>` : ''}
    ${d.fotos?.length ? `<div class="galeria">${d.fotos.map((f, k) => `<img src="${esc(f)}" alt="Foto ${k + 1} del inmueble ${esc(i.ref)}" loading="lazy">`).join('')}</div>` : ''}
  </div></section>

  <section id="mercado" class="oscura"><div class="envoltura">
    <h2><small>3 · El mercado en 3D</small>Su piso frente a pisos parecidos</h2>
    <p class="suave">Cada torre es un inmueble y su altura es el <b>precio por m²</b>. Gira la escena con el dedo o el ratón y toca una torre para ver el detalle. El contorno dorado fino muestra el €/m² <i>antes</i> de ajustar.</p>
    <div class="escena" id="escena"><div class="escena__ayuda">Arrastra para girar · toca una torre</div></div>
    <div class="leyenda"><span><i style="background:#5b6b7b"></i>Comparable</span><span><i style="background:#d9a441"></i>Su piso, publicado</span><span><i style="background:#f2d27a"></i>Su piso, valor central</span><span><i style="background:rgba(217,164,65,.35)"></i>Rango p25–p75</span></div>
    <div class="detalle3d" id="detalle3d" aria-live="polite"></div>
    ${tabla(m)}
  </div></section>

  <section id="valoracion"><div class="envoltura">
    <h2><small>4 · Valoración</small>Precio de venta orientativo</h2>
    ${seccionRango(d, m)}
    ${c.suficiente ? `<p><b>Cómo se ha calculado.</b> ${esc(m.metodologia)}</p>` : ''}
    ${m.avisos.filter((x) => x.nivel !== 'borrador').map((x) => `<p class="pequeno"><b>${x.nivel === 'info' ? 'A tener en cuenta' : 'Fiabilidad'}:</b> ${esc(x.texto)}</p>`).join('')}
  </div></section>

  <section id="fortalezas" style="background:var(--papel-2)"><div class="envoltura">
    <h2><small>5 · Puntos clave</small>Qué suma y qué resta</h2>
    <div class="dos">
      <div class="caja caja--mas"><h3>Lo que suma</h3><ul>${suma.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="caja caja--menos"><h3>Lo que hay que gestionar</h3><ul>${resta.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    </div>
  </div></section>

  <section id="plan"><div class="envoltura">
    <h2><small>6 · Plan de venta</small>Cómo lo llevamos al mejor resultado</h2>
    <ol class="pasos">
      <li><div><b>Fijar el precio de salida</b>Contrastamos este rango con ventas cerradas y con una visita al piso, y lo acordamos con usted.</div></li>
      <li><div><b>Completar la documentación</b>Certificado energético, nota simple, cuota de comunidad e IBI. Con los papeles listos, el comprador decide antes.</div></li>
      <li><div><b>Mejorar la presentación</b>Las fotos actuales son imágenes de móvil; un reportaje cuidado con luz natural mejora el primer impacto.</div></li>
      <li><div><b>Difusión</b>Web propia, portales y la base de compradores de la agencia.</div></li>
      <li><div><b>Visitas y seguimiento</b>Le informamos de cada visita y de lo que dicen los compradores. Si el mercado responde distinto a lo previsto, revisamos el precio con datos.</div></li>
      <li><div><b>Oferta, reserva y notaría</b>Negociamos la oferta, formalizamos la reserva y acompañamos hasta la firma.</div></li>
    </ol>
  </div></section>

  <section id="pendientes" style="background:var(--papel-2)"><div class="envoltura">
    <h2><small>7 · Para afinar el precio</small>Datos que aún necesitamos</h2>
    <div class="pendientes"><ul>${(d.pendientes || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <p class="legal">${esc(AVISO_VALORACION)}</p>
  </div></section>

  <footer><div class="envoltura">
    <p><b>${esc(a.empresa)}</b><br>${esc(a.direccion)}<br>${tel}${a.email ? ` · <a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : ''}</p>
    <div class="acciones">
      <button class="boton" type="button" id="imprimir">Guardar en PDF / imprimir</button>
      ${i.url ? `<a class="boton boton--hueco" href="${esc(i.url)}" target="_blank" rel="noopener">Ver el anuncio actual</a>` : ''}
    </div>
  </div></footer>`;
}

function barras2D(cont, m) {
  const max = Math.max(...m.torres.map((t) => t.eurM2));
  cont.insertAdjacentHTML('afterbegin', `<div class="barras2d">${m.torres.map((t) => `
    <div class="barra2d ${t.tipo !== 'comparable' ? 'barra2d--suyo' : ''}"><b>${esc(miles(t.eurM2))}</b><i style="height:${((t.eurM2 / max) * 78).toFixed(1)}%"></i><span>${esc(t.etiqueta)}</span></div>`).join('')}</div>`);
}

function muestraDetalle(m, id) {
  const t = m.torres.find((x) => x.id === id);
  const el = $('#detalle3d');
  if (!t || !el) return;
  if (t.tipo === 'comparable') {
    el.innerHTML = `<h3>${esc(t.id)}</h3><p>${euros(t.precio)} · ${esc(String(t.m2))} m² · <b>${miles(t.eurM2SinAjuste)} €/m²</b>${t.ajuste ? ` → ajustado <b>${miles(t.eurM2)} €/m²</b> (${t.ajuste > 0 ? '+' : ''}${t.ajuste} %)` : ''}</p><p>${esc(t.detalle)}</p>${t.motivo ? `<p>${esc(t.motivo)}</p>` : ''}`;
  } else if (t.tipo === 'publicado') {
    el.innerHTML = `<h3>Su piso · precio publicado</h3><p>${euros(t.precio)} · ${esc(String(t.m2))} m² · <b>${miles(t.eurM2)} €/m²</b></p>`;
  } else {
    el.innerHTML = `<h3>Su piso · valor central</h3><p>Es la mediana de los comparables ajustados (<b>${miles(t.eurM2)} €/m²</b>) por los ${esc(String(t.m2))} m² de su piso: <b>${euros(t.precio)}</b>.</p>`;
  }
}

async function arranca() {
  const main = $('#contenido');
  let datos;
  try { datos = await cargaDatos(); }
  catch (e) { main.innerHTML = `<p class="cargando">${esc(e.message || 'No se ha podido abrir el dosier.')}</p>`; return; }

  const m = construirDosier(datos);
  document.title = `Dosier de valoración · ${datos.inmueble.ref} · ${datos.agente.empresa.split('·')[0].trim()}`;
  main.innerHTML = html(datos, m);

  const av = $('#aviso-borrador');
  if (m.borrador) { av.textContent = m.avisos.find((x) => x.nivel === 'borrador').texto; av.hidden = false; }
  $('#imprimir')?.addEventListener('click', () => window.print());

  const cont = $('#escena');
  const central = m.torres.find((t) => t.id === 'central') || m.torres[0];
  muestraDetalle(m, central.id);
  let escena = null;
  if (hayWebGL()) {
    const c = m.calculo;
    escena = await montarEscena(cont, {
      torres: m.torres,
      rango: c.suficiente ? { bajoM2: c.porM2.p25, altoM2: c.porM2.p75 } : null,
    }, (id) => { muestraDetalle(m, id); escena?.seleccionar(id); });
    escena?.seleccionar(central.id);
  }
  if (!escena) barras2D(cont, m);
}

arranca();
