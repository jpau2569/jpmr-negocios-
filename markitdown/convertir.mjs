#!/usr/bin/env node
/*
 * convertir.mjs — pasa PDF, Word, Excel, PowerPoint (y más) a Markdown con
 * MarkItDown, la herramienta libre de Microsoft (licencia MIT,
 * github.com/microsoft/markitdown), hablando con su conector oficial
 * `markitdown-mcp` por MCP (stdio). Sin dependencias de npm: solo Node y uv.
 *
 * Uso:
 *   node markitdown/convertir.mjs <archivo>             → <archivo>.md al lado
 *   node markitdown/convertir.mjs <carpeta>             → un .md al lado de cada original
 *   node markitdown/convertir.mjs <https://...>         → Markdown por pantalla
 *   node markitdown/convertir.mjs <https://...> --salida video.md
 *   Opciones: --sobrescribir (por defecto un .md que ya existe NO se toca)
 *             --recursivo    (entra también en subcarpetas)
 *
 * Al final dice qué ha salido vacío o raro para que se revise a mano.
 */
import { spawn } from 'node:child_process';
import { readdir, stat, writeFile, access } from 'node:fs/promises';
import { resolve, join, extname, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXTENSIONES = new Set([
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.csv', '.json', '.xml',
  '.html', '.htm', '.epub', '.msg', '.txt', '.zip',
  '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.m4a',
]);

/* Vacío: casi nada de texto. Raro: muchos caracteres de reemplazo o casi
   ninguna letra (típico de un PDF escaneado sin OCR o con fuentes rotas). */
export function diagnostico(md) {
  const texto = String(md || '').trim();
  if (texto.length < 20) return 'vacío';
  const reemplazos = (texto.match(/�/g) || []).length;
  const letras = (texto.match(/\p{L}/gu) || []).length;
  if (reemplazos / texto.length > 0.02) return 'raro (caracteres ilegibles)';
  if (letras / texto.length < 0.3) return 'raro (casi sin letras)';
  return null;
}

export function nombreSalida(ruta) {
  return join(dirname(ruta), basename(ruta) + '.md');
}

/* Cliente MCP mínimo: initialize → tools/call convert_to_markdown. */
export function abrirMarkitdown({ comando = 'uvx', args = ['markitdown-mcp'] } = {}) {
  const proc = spawn(comando, args, { stdio: ['pipe', 'pipe', 'ignore'] });
  const pendientes = new Map();
  let id = 0, buf = '';
  proc.stdout.on('data', (d) => {
    buf += d;
    const lineas = buf.split('\n'); buf = lineas.pop();
    for (const l of lineas) {
      let m; try { m = JSON.parse(l); } catch { continue; }
      const p = pendientes.get(m.id); if (!p) continue;
      pendientes.delete(m.id);
      m.error ? p.no(new Error(m.error.message || 'error de MarkItDown')) : p.si(m.result);
    }
  });
  const fin = new Promise((_, no) => proc.on('exit', (c) => {
    for (const p of pendientes.values()) p.no(new Error(`markitdown-mcp se cerró (código ${c})`));
    no(new Error('cerrado'));
  }));
  fin.catch(() => {});
  const pedir = (method, params) => new Promise((si, no) => {
    const n = ++id; pendientes.set(n, { si, no });
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n');
  });
  const listo = pedir('initialize', {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'convertir', version: '1' },
  }).then(() => proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n'));
  return {
    async convertir(uri) {
      await listo;
      const r = await pedir('tools/call', { name: 'convert_to_markdown', arguments: { uri } });
      if (r.isError) throw new Error((r.content || []).map((c) => c.text).join(' ') || 'no se pudo convertir');
      return r.structuredContent?.result ?? (r.content || []).map((c) => c.text).join('\n');
    },
    cerrar() { proc.stdin.end(); proc.kill(); },
  };
}

async function existe(ruta) { try { await access(ruta); return true; } catch { return false; } }

async function listarCarpeta(carpeta, recursivo) {
  const salida = [];
  for (const e of await readdir(carpeta, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const ruta = join(carpeta, e.name);
    if (e.isDirectory()) { if (recursivo) salida.push(...await listarCarpeta(ruta, true)); continue; }
    if (EXTENSIONES.has(extname(e.name).toLowerCase())) salida.push(ruta);
  }
  return salida.sort();
}

async function main(argv) {
  const opciones = new Set(argv.filter((a) => a.startsWith('--')));
  const iSalida = argv.indexOf('--salida');
  const salidaUrl = iSalida >= 0 ? argv[iSalida + 1] : null;
  const objetivo = argv.find((a, i) => !a.startsWith('--') && !(iSalida >= 0 && i === iSalida + 1));
  if (!objetivo) {
    console.error('Uso: node markitdown/convertir.mjs <archivo | carpeta | https://...> [--sobrescribir] [--recursivo] [--salida f.md]');
    return 2;
  }
  const md = abrirMarkitdown();
  try {
    if (/^https?:\/\//i.test(objetivo)) {
      const texto = await md.convertir(objetivo);
      if (salidaUrl) { await writeFile(salidaUrl, texto); console.log(`✔ Guardado en ${salidaUrl}`); }
      else console.log(texto);
      const d = diagnostico(texto); if (d) console.error(`⚠ Ha salido ${d}.`);
      return 0;
    }
    const ruta = resolve(objetivo);
    const info = await stat(ruta);
    const archivos = info.isDirectory() ? await listarCarpeta(ruta, opciones.has('--recursivo')) : [ruta];
    if (!archivos.length) { console.log('No hay archivos que convertir en esa carpeta.'); return 0; }
    const avisos = [];
    let hechos = 0;
    for (const a of archivos) {
      const destino = nombreSalida(a);
      if (!opciones.has('--sobrescribir') && await existe(destino)) { console.log(`· ${basename(a)}: ya tenía .md, no lo toco`); continue; }
      try {
        const texto = await md.convertir(pathToFileURL(a).href);
        await writeFile(destino, texto);
        hechos++;
        const d = diagnostico(texto);
        if (d) avisos.push(`${basename(a)} → ${d}`);
        console.log(`${d ? '⚠' : '✔'} ${basename(a)} → ${basename(destino)} (${texto.length} caracteres)`);
      } catch (e) {
        avisos.push(`${basename(a)} → error: ${e.message}`);
        console.log(`✘ ${basename(a)}: ${e.message}`);
      }
    }
    console.log(`\nConvertidos: ${hechos} de ${archivos.length}.`);
    console.log(avisos.length ? `Revisar a mano:\n  - ${avisos.join('\n  - ')}` : 'Ninguno ha salido vacío ni raro.');
    return avisos.length ? 1 : 0;
  } finally {
    md.cerrar();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error('Error:', e.message); process.exit(2); });
}
