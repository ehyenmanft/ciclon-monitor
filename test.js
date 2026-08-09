#!/usr/bin/env node
/**
 * ============================================================
 *  CICLÓN·MONITOR — suite de verificación
 * ============================================================
 *  Ejecuta:  node test.js
 *  Sin dependencias: solo Node (probado con v18+).
 *
 *  Por qué existe: este proyecto es un único index.html sin
 *  proceso de compilación, así que no hay compilador que avise
 *  de un id mal escrito, una clave de idioma que falta o una
 *  etiqueta sin cerrar. Estas comprobaciones son el sustituto,
 *  y han cazado errores reales: claves i18n usadas pero nunca
 *  definidas (se mostraban como "intLigera" en pantalla) y
 *  funciones huérfanas tras una refactorización.
 *
 *  Ejecútalo ANTES de subir cualquier cambio. Si algo falla,
 *  sale con código 1 para que sirva en un hook o en CI.
 * ============================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
let fallos = 0, pruebas = 0;

function ok(nombre, cond, detalle) {
  if (cond === undefined) cond = true; // permitir ok('nombre') como "pasó"
  pruebas++;
  if (cond) {
    console.log('  \x1b[32m✓\x1b[0m ' + nombre);
  } else {
    fallos++;
    console.log('  \x1b[31m✗\x1b[0m ' + nombre + (detalle ? '\n      → ' + detalle : ''));
  }
}
function seccion(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

const html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const js = scriptMatch ? scriptMatch[1] : '';

// ---------------------------------------------------------------
seccion('Sintaxis');
// ---------------------------------------------------------------
try { new vm.Script(js); ok('index.html: el JavaScript embebido compila'); }
catch (e) { ok('index.html: el JavaScript embebido compila', false, e.message); }

['sw.js', 'nhc-proxy.gs'].forEach(f => {
  const p = path.join(DIR, f);
  if (!fs.existsSync(p)) { ok(f + ': existe', false); return; }
  try { new vm.Script(fs.readFileSync(p, 'utf8')); ok(f + ': compila'); }
  catch (e) { ok(f + ': compila', false, e.message); }
});

try { JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')); ok('manifest.json: JSON válido'); }
catch (e) { ok('manifest.json: JSON válido', false, e.message); }

// ---------------------------------------------------------------
seccion('Integridad del DOM');
// ---------------------------------------------------------------
const idsUsados = new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
const idsDefinidos = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const faltantes = [...idsUsados].filter(i => !idsDefinidos.has(i));
ok('todo id usado en JS existe en el HTML', faltantes.length === 0, faltantes.join(', '));

const duplicados = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1])
  .reduce((acc, id) => (acc[id] = (acc[id] || 0) + 1, acc), {});
const idsRepetidos = Object.keys(duplicados).filter(k => duplicados[k] > 1);
ok('no hay ids duplicados en el HTML', idsRepetidos.length === 0, idsRepetidos.join(', '));

['div', 'span', 'button', 'aside', 'nav', 'style', 'script'].forEach(tag => {
  const abre = (html.match(new RegExp('<' + tag + '(\\s|>)', 'g')) || []).length;
  const cierra = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  ok(`<${tag}> balanceado`, abre === cierra, `${abre} aperturas / ${cierra} cierres`);
});

// ---------------------------------------------------------------
seccion('Traducciones (bilingüe ES/EN)');
// ---------------------------------------------------------------
function bloqueIdioma(codigo, siguiente) {
  const re = siguiente
    ? new RegExp(codigo + ':\\s*\\{([\\s\\S]*?)\\n\\s*\\},\\s*\\n\\s*' + siguiente + ':')
    : new RegExp(codigo + ':\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\s*\\n\\};');
  const m = html.match(re);
  // las claves reales son camelCase en minúscula; descarta coincidencias dentro
  // de textos traducidos que contienen "Palabra: " (ej. "Intensidad: ")
  return m ? new Set([...m[1].matchAll(/(\w+):\s*'/g)].map(x => x[1]).filter(k => /^[a-z]/.test(k))) : new Set();
}
const clavesES = bloqueIdioma('es', 'en');
const clavesEN = bloqueIdioma('en', null);
ok('el bloque ES tiene claves', clavesES.size > 0);
ok('el bloque EN tiene claves', clavesEN.size > 0);

// createElement('div') mete falsos positivos por la "t" de Element: se excluyen
const RUIDO = new Set(['div', 'button', 'input', 'span', 'a', 'option', 'img']);
// (?<![\w.]) evita capturar p.set('lat'), createElement('div'), etc.: solo la
// función t() de traducción, nunca otra que termine en la letra t
const clavesUsadas = new Set([...js.matchAll(/(?<![\w.])t\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]).filter(k => !RUIDO.has(k)));
const clavesAttr = new Set([
  ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]),
  ...[...html.matchAll(/data-i18n-ph="([^"]+)"/g)].map(m => m[1])
]);
const todas = new Set([...clavesUsadas, ...clavesAttr]);
const faltanES = [...todas].filter(k => !clavesES.has(k));
const faltanEN = [...todas].filter(k => !clavesEN.has(k));
ok('toda clave usada existe en ES', faltanES.length === 0, faltanES.join(', '));
ok('toda clave usada existe en EN', faltanEN.length === 0, faltanEN.join(', '));
const soloES = [...clavesES].filter(k => !clavesEN.has(k));
const soloEN = [...clavesEN].filter(k => !clavesES.has(k));
ok('ES y EN tienen el mismo juego de claves', soloES.length === 0 && soloEN.length === 0,
   (soloES.length ? 'solo en ES: ' + soloES.join(', ') : '') + (soloEN.length ? ' | solo en EN: ' + soloEN.join(', ') : ''));

// ---------------------------------------------------------------
seccion('Declaraciones');
// ---------------------------------------------------------------
const globales = [...js.matchAll(/^(?:function|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const globDup = globales.filter((v, i) => globales.indexOf(v) !== i);
ok('no hay funciones/variables globales duplicadas', globDup.length === 0, [...new Set(globDup)].join(', '));

// ---------------------------------------------------------------
seccion('Reglas del proyecto');
// ---------------------------------------------------------------
ok('un solo archivo, sin proceso de compilación', !html.includes('type="module"') && !fs.existsSync(path.join(DIR, 'package.json')));
ok('sin claves de API incrustadas', !/['"]AIza[0-9A-Za-z_-]{20,}['"]/.test(html), 'parece haber una clave de Google en el HTML');

const sw = fs.existsSync(path.join(DIR, 'sw.js')) ? fs.readFileSync(path.join(DIR, 'sw.js'), 'utf8') : '';
const versionSW = (sw.match(/const VERSION = '([^']+)'/) || [])[1];
ok('sw.js declara una VERSION', !!versionSW, 'sin VERSION: las instalaciones PWA no se actualizarán');
// las fuentes de datos en vivo nunca deben cachearse: mostrar dato viejo como
// actual es justo lo que esta plataforma no puede hacer
const bloqueVivos = (sw.match(/DATOS_VIVOS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
const dominiosVivos = [...bloqueVivos.matchAll(/'([^']+)'/g)].map(m => m[1]);
ok('sw.js define la lista DATOS_VIVOS', dominiosVivos.length > 0);
['nhc.noaa.gov', 'open-meteo.com', 'rainviewer.com', 'gdacs.org', 'overpass-api.de',
 'mapservices.weather.noaa.gov', 'gibs.earthdata.nasa.gov', 'earthquake.usgs.gov', 'seismicportal.eu',
 'sismosve.rafnixg.dev'].forEach(d => {
  ok(`sw.js excluye ${d} del caché`, dominiosVivos.some(x => d.endsWith(x)));
});

const dominiosEnHtml = [...new Set([...html.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map(m => m[1]))];
// se compara contra la lista REAL de sw.js: así, si se añade una fuente nueva
// al HTML y se olvida excluirla del caché, esta prueba lo caza
const noCubiertos = dominiosEnHtml.filter(d =>
  /(noaa|open-meteo|rainviewer|gdacs|overpass|earthdata|kumi|mail\.ru|usgs|seismicportal|sismosve)/.test(d) &&
  !dominiosVivos.some(x => d.endsWith(x))
);
ok('toda fuente de datos del HTML está excluida del caché del SW',
   noCubiertos.length === 0, 'sin cubrir: ' + noCubiertos.join(', '));

// ---------------------------------------------------------------
seccion('Accesibilidad');
// ---------------------------------------------------------------
const botonesSoloEmoji = [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)]
  .filter(m => {
    const texto = m[2].trim();
    // solo emoji/símbolo, sin palabras
    return texto.length > 0 && texto.length <= 3 && !/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(texto);
  })
  .filter(m => !/aria-label=/.test(m[1]));
ok('los botones de solo icono tienen aria-label', botonesSoloEmoji.length === 0,
   botonesSoloEmoji.map(m => m[2].trim()).join(' '));

ok('el mapa tiene rol y etiqueta accesible', /id="map"[^>]*role=/.test(html) && /id="map"[^>]*aria-label=/.test(html));
ok('la alerta de Venezuela se anuncia a lectores de pantalla', /id="vzAlertBanner"[^>]*aria-live=/.test(html));
ok('la severidad no depende solo del color', js.includes('function sevSymbol'));

// ---------------------------------------------------------------
seccion('Honestidad de datos (requisito del proyecto)');
// ---------------------------------------------------------------
ok('la convergencia se declara aproximada', /aproximada|approximate/i.test(html));
ok('WeatherNext se declara experimental', /experimental/i.test(html));
ok('se enlaza a fuentes oficiales (NHC)', html.includes('nhc.noaa.gov/'));
ok('se enlaza a Protección Civil de Venezuela', html.includes('gestionderiesgo.gob.ve'));
ok('el modo demo se etiqueta como ejemplo', js.includes('demoTag'));
ok('existe aviso de fuente caída', js.includes('showSourceBanner'));
// SISMO·MONITOR fusiona tres redes con validación cruzada: usar solo una
// perdería los sismos locales de Venezuela que FUNVISIS sí detecta
['fetchFUNVISISQuakes', 'fetchUSGSQuakes', 'fetchEMSCQuakes'].forEach(f => {
  ok(`la capa sísmica consulta ${f.replace('fetch','').replace('Quakes','')}`, js.includes('function ' + f));
});
ok('los sismos duplicados se descartan entre redes', js.includes('function mergeSismos'));
ok('se informa qué fuente sísmica no respondió', js.includes('sinRespuesta'));
ok('FUNVISIS se parsea por contenido, no por nombre de campo', js.includes('esMag') && js.includes('esCoord'));

seccion('Capa de ciudades');
// el objetivo es una sola petición para todas las ciudades: si alguien la
// convierte en un bucle de fetch por ciudad, el consumo de datos se dispara
ok('las ciudades se piden en UNA sola llamada (lista de coordenadas)',
   js.includes("'?latitude=' + lats + '&longitude=' + lons"));
ok('la respuesta multi-punto se normaliza (array u objeto)', js.includes('Array.isArray(data) ? data : [data]'));
ok('hay caché para no repetir al mover el mapa', js.includes('ciudadesCache'));
ok('el modo bajo consumo reduce las ciudades', /lowDataMode[\s\S]{0,200}c\.vz/.test(js));
ok('cada ciudad usa el icono WMO de su condición', js.includes('wmoIcon(code)'));


// ---------------------------------------------------------------
// El análisis de condiciones es la única pieza con lógica de decisión
// propia: se ejecuta de verdad contra escenarios simulados, no basta
// con comprobar que compila. Si alguien cambia un umbral sin querer,
// estos escenarios lo detectan.
const umbralesSrc = js.match(/var UMBRALES = \{[\s\S]*?\};/);
function extraerFuncion(nombre){
  const i = js.indexOf('function ' + nombre);
  if (i < 0) return null;
  let d = 0;
  for (let k = js.indexOf('{', i); k < js.length; k++){
    if (js[k] === '{') d++;
    else if (js[k] === '}'){ d--; if (d === 0) return js.slice(i, k + 1); }
  }
  return null;
}
const fnAnalisis = extraerFuncion('analizarCondiciones');
const ctxAn = { lastClimaData: null, lang: 'es', t: k => k,
                fmtVientoKmh: v => Math.round(v) + ' km/h', findNowIndex: () => 0, console };
if (umbralesSrc && fnAnalisis){
  vm.createContext(ctxAn);
  vm.runInContext(umbralesSrc[0] + '\n' + fnAnalisis, ctxAn);

function caso(nombre, datos, esperados, nivelEsperado){
  ctxAn.lastClimaData = datos;
  const r = ctxAn.analizarCondiciones();
  const textos = r ? r.hallazgos.map(x => x.texto) : [];
  // los textos pueden llevar detalle añadido (ej. la hora pico): prefijo, no igualdad
  const faltan = esperados.filter(e => !textos.some(x => x.indexOf(e) === 0));
  const nivelOk = !nivelEsperado || (r && r.resumen === nivelEsperado) || (!r && nivelEsperado === null);
  ok(nombre, faltan.length === 0 && nivelOk,
     (faltan.length ? 'faltan: ' + faltan.join(', ') + ' · ' : '') +
     (!nivelOk ? 'nivel esperado ' + nivelEsperado + ', obtenido ' + (r && r.resumen) + ' · ' : '') +
     'obtenidos: ' + textos.join(' | '));
}

seccion('Lógica del análisis de condiciones');

caso('día tranquilo → sin hallazgos',
  { forecast:{ current:{temperature_2m:26,apparent_temperature:27,wind_gusts_10m:15,cape:200,soil_moisture_0_to_1cm:0.15,visibility:20000},
    daily:{precipitation_probability_max:[10,20,15],precipitation_sum:[0,1,0],uv_index_max:[5]},
    hourly:{time:[new Date().toISOString()],precipitation_probability:[10]} } }, [], 'ok');

caso('suelo saturado + lluvia → riesgo de deslizamiento (ALERTA)',
  { forecast:{ current:{temperature_2m:24,apparent_temperature:25,soil_moisture_0_to_1cm:0.45,wind_gusts_10m:20},
    daily:{precipitation_probability_max:[95,90,85],precipitation_sum:[30,25,20],uv_index_max:[4]},
    hourly:{time:[new Date().toISOString()],precipitation_probability:[95]} } },
  ['anSueloLluvia','anLluvia','anLluviaPersistente','anAcumulado'], 'alerta');

caso('ráfagas fuertes → alerta',
  { forecast:{ current:{temperature_2m:28,apparent_temperature:30,wind_gusts_10m:85,soil_moisture_0_to_1cm:0.1},
    daily:{precipitation_probability_max:[20],precipitation_sum:[1],uv_index_max:[6]},
    hourly:{time:[new Date().toISOString()],precipitation_probability:[20]} } },
  ['anRafagaFuerte'], 'alerta');

caso('crecida de río detectada',
  { forecast:{ current:{temperature_2m:26,apparent_temperature:27,wind_gusts_10m:10,soil_moisture_0_to_1cm:0.1},
    daily:{precipitation_probability_max:[30],precipitation_sum:[2],uv_index_max:[5]},
    hourly:{time:[new Date().toISOString()],precipitation_probability:[30]} },
    flood:{ daily:{ river_discharge:[2.0, 3.5, 8.0] } } },
  ['anRio'], 'atencion');

caso('golpe de calor por sensación térmica',
  { forecast:{ current:{temperature_2m:34,apparent_temperature:41,wind_gusts_10m:10,soil_moisture_0_to_1cm:0.1},
    daily:{precipitation_probability_max:[10],precipitation_sum:[0],uv_index_max:[11]},
    hourly:{time:[new Date().toISOString()],precipitation_probability:[10]} } },
  ['anCalor','anUV'], 'alerta');

caso('oleaje y aire, fuentes opcionales',
  { forecast:{ current:{temperature_2m:27,apparent_temperature:28,wind_gusts_10m:20,soil_moisture_0_to_1cm:0.1},
    daily:{precipitation_probability_max:[20],precipitation_sum:[0],uv_index_max:[5]},
    hourly:{time:[new Date().toISOString()],precipitation_probability:[20]} },
    air:{ current:{ european_aqi: 75 } }, marine:{ current:{ wave_height: 3.4 } } },
  ['anAire','anOleaje'], 'alerta');

caso('sin datos de clima → null seguro', null, [], null);

}
else { ok('se pudo extraer analizarCondiciones para probarla', false); }

// ---------------------------------------------------------------
seccion('Mantenibilidad');
// ---------------------------------------------------------------
const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
// no es un límite duro, es una alarma: si crece mucho más conviene
// reorganizar antes de que cada cambio se vuelva frágil
ok(`index.html mide ${kb} KB (alarma a 300 KB)`, kb < 300);
ok('el código tiene índice de secciones navegable', html.includes('índice del código'));
// cada sección abre con una línea de separadores dentro de un comentario
const secciones = (js.match(/^ \* ={10,}/gm) || []).length;
ok('el código está dividido en secciones comentadas', secciones >= 20, `encontradas: ${secciones}`);

// ---------------------------------------------------------------
console.log('\n' + '─'.repeat(52));
if (fallos === 0) {
  console.log(`\x1b[32m✓ ${pruebas} comprobaciones, todo correcto\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[31m✗ ${fallos} de ${pruebas} comprobaciones fallaron\x1b[0m`);
  process.exit(1);
}
