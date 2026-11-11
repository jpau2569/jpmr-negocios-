// Comprueba que Tema.kt usa los mismos colores que tokens.json y que el contraste cumple WCAG AA.
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
const kt = readFileSync(new URL('../android/app/src/main/kotlin/es/ilusionpantalla/app/ui/theme/Tema.kt', import.meta.url), 'utf8');
const lum = (h) => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(v => v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const cr = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const err = [];
const mapa = { grafito:'Grafito', superficie:'SuperficieGrafito', azulElectrico:'AzulElectrico', violetaProfundo:'VioletaProfundo', turquesa:'Turquesa', blancoSuave:'BlancoSuave', grisTexto:'GrisTexto' };
for (const [k,n] of Object.entries(mapa)) { const hex = t.color[k].slice(1).toUpperCase(); if (!new RegExp(`val ${n} = Color\\(0xFF${hex}\\)`).test(kt)) err.push(`Tema.kt: ${n} != ${t.color[k]}`); }
const pares = [['blancoSuave','grafito'],['grisTexto','grafito'],['grisTexto','superficie'],['grafito','azulElectrico'],['blancoSuave','violetaProfundo'],['grafito','turquesa']];
for (const [f,b] of pares) { const r = cr(t.color[f], t.color[b]); console.log(`${f} sobre ${b}: ${r.toFixed(2)}:1`); if (r < t.accesibilidad.contrasteMinimo) err.push(`contraste bajo ${f}/${b}: ${r.toFixed(2)}`); }
if (err.length) { console.error(err.join('\n')); process.exit(1); }
console.log('✓ tokens coherentes y accesibles');
