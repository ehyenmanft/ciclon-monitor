#!/usr/bin/env node
/**
 * Auditoría estática de CICLÓN·MONITOR — complementa a test.js.
 *   node audit.js
 * test.js verifica que se cumplan las reglas del proyecto; esto busca
 * problemas que nadie escribió a propósito: código muerto, listeners
 * duplicados, ids huérfanos, endpoints sin usar.
 *
 * FALSOS POSITIVOS CONOCIDOS del detector de "función no definida":
 *   fn, valida  → parámetros de callback
 *   EAST        → texto dentro de una expresión regular
 *   new         → artefacto del análisis
 * Revisar a mano antes de corregir nada.
 */
const fs=require('fs');
const html=fs.readFileSync('index.html','utf8');
const jsRaw=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const cssRaw=html.match(/<style>([\s\S]*?)<\/style>/)[1];
// quitar comentarios y literales de cadena: sin esto el análisis lee prosa
// preservar los saltos de línea al limpiar: si se colapsan, el ancla ^ de las
// expresiones deja de funcionar y todo parece no estar definido
const mantenerLineas = t => t.replace(/[^\n]/g,' ');
const js=jsRaw.replace(/\/\*[\s\S]*?\*\//g, mantenerLineas)
               .replace(/\/\/[^\n]*/g, mantenerLineas)
               .replace(/'(?:[^'\\\n]|\\.)*'/g,"''")
               .replace(/"(?:[^"\\\n]|\\.)*"/g,'""');
const css=cssRaw.replace(/\/\*[\s\S]*?\*\//g,' ');
const F=[]; const flag=(s,t,d)=>F.push({s,t,d});

// 1) listeners duplicados
const lis={};
[...jsRaw.matchAll(/getElementById\('([^']+)'\)\.addEventListener\('(\w+)'/g)].forEach(m=>{const k=m[1]+':'+m[2];lis[k]=(lis[k]||0)+1;});
Object.entries(lis).filter(([,v])=>v>1).forEach(([k,v])=>flag('ALTA','Listener duplicado',k+' × '+v));

// 2) código muerto: cuenta invocaciones Y referencias (callbacks sin paréntesis)
const defs=[...js.matchAll(/\bfunction\s+(\w+)/g)].map(m=>m[1]);
defs.forEach(f=>{
  const refs=(jsRaw.match(new RegExp('(?<![\\w.$])'+f+'(?![\\w$])','g'))||[]).length;
  if(refs<=1) flag('MEDIA','Función definida pero nunca usada',f+'()');
});

// 3) funciones llamadas y no definidas (solo código, métodos excluidos por (?<!\.))
const nativas=new Set(['if','for','while','switch','catch','return','typeof','function','parseInt','parseFloat','isFinite','isNaN','String','Number','Array','Object','Date','Math','JSON','Promise','Set','Map','RegExp','Error','encodeURIComponent','setTimeout','setInterval','clearTimeout','clearInterval','fetch','alert','prompt','requestAnimationFrame','getComputedStyle','URLSearchParams','Image','Notification','AudioContext','webkitAudioContext','L','Boolean']);
// var puede declarar varias en una línea: var a = 1, b = 2;
const varsGlob=new Set([...js.matchAll(/\bvar\s+([\w$]+)/g)].map(m=>m[1])
  .concat([...js.matchAll(/,\s*([\w$]+)\s*=/g)].map(m=>m[1])));
new Set([...js.matchAll(/(?<![\w.$])([a-zA-Z_$][\w$]*)\s*\(/g)].map(m=>m[1])).forEach(c=>{
  if(nativas.has(c)||defs.includes(c)||varsGlob.has(c)) return;
  flag('CRITICA','Llamada a función no definida',c+'()');
});

// 4) variables globales declaradas y nunca usadas
varsGlob.forEach(v=>{
  const refs=(jsRaw.match(new RegExp('(?<![\\w.$])'+v+'(?![\\w$])','g'))||[]).length;
  if(refs<=1) flag('BAJA','Variable global sin usar',v);
});

// 5) ids en CSS que no existen (excluyendo colores hex)
const htmlIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
new Set([...css.matchAll(/#([a-zA-Z][\w-]*)/g)].map(m=>m[1])).forEach(i=>{
  if(/^[0-9a-fA-F]{3,8}$/.test(i)) return;         // color hexadecimal
  if(!htmlIds.has(i)) flag('MEDIA','CSS apunta a id inexistente','#'+i);
});

// 6) ids del HTML sin estilo ni uso en JS (posible resto de refactor)
const jsIds=new Set([...jsRaw.matchAll(/getElementById\('([^']+)'\)/g)].map(m=>m[1]));
const cssIds=new Set([...css.matchAll(/#([a-zA-Z][\w-]*)/g)].map(m=>m[1]));
htmlIds.forEach(i=>{ if(!jsIds.has(i)&&!cssIds.has(i)) flag('BAJA','id del HTML sin uso en JS ni CSS','#'+i); });

// 7) manejadores de moveend
const me=(jsRaw.match(/map\.on\('moveend'/g)||[]).length;
if(me>=4) flag('MEDIA','Manejadores de moveend',me+' registrados: cada desplazamiento del mapa ejecuta los '+me);

console.log('\n===== AUDITORÍA ESTÁTICA =====\n');
let total=0;
['CRITICA','ALTA','MEDIA','BAJA'].forEach(s=>{
  const g=F.filter(x=>x.s===s); if(!g.length) return; total+=g.length;
  console.log(`--- ${s} (${g.length}) ---`);
  g.forEach(x=>console.log(`  • ${x.t}: ${x.d}`)); console.log();
});
console.log(total?`Total: ${total}`:'Sin hallazgos');
