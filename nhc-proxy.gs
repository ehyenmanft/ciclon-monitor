/**
 * ============================================================
 *  PROXY NHC — Google Apps Script (RESPALDO, solo si hace falta)
 * ============================================================
 *  index.html intenta leer https://www.nhc.noaa.gov/CurrentStorms.json
 *  DIRECTO primero. Este proxy solo entra en juego si confirmas
 *  (abriendo la consola del navegador en GitHub Pages) que el
 *  navegador bloquea esa lectura por falta de cabecera CORS.
 *
 *  Si lo necesitas:
 *  1. Ve a https://script.google.com → Nuevo proyecto
 *  2. Borra el contenido de Code.gs y pega este archivo completo
 *  3. Implementar → Nueva implementación → tipo "Aplicación web"
 *       - Ejecutar como:      Yo
 *       - Quién tiene acceso: Cualquier usuario
 *  4. Copia la URL que termina en /exec
 *  5. Pégala en index.html, en la constante NHC_PROXY
 *
 *  ENDPOINTS:
 *    GET {URL}/exec                → JSON de NHC, tal cual, cacheado 3 min
 *    GET {URL}/exec?nocache=1      → fuerza lectura fresca de NHC
 *    GET {URL}/exec?url=<https...> → passthrough genérico (ver abajo)
 *
 *  PASSTHROUGH GENÉRICO (?url=):
 *  Se agregó porque el mapa de trayectorias también necesita leer
 *  mapservices.weather.noaa.gov (GIS oficial del NHC), un dominio
 *  distinto de nhc.noaa.gov que podría tener el mismo problema de
 *  CORS o no tenerlo — no se pudo probar en vivo. Si tras subir el
 *  mapa de trayectorias ves en consola un error de red contra
 *  mapservices.weather.noaa.gov, pega esta MISMA URL de proxy en
 *  la constante GIS_PROXY de index.html (además de NHC_PROXY) y
 *  este passthrough se activa solo.
 *  Por seguridad, SOLO reenvía URLs cuyo dominio esté en la lista
 *  blanca de abajo — nunca funciona como proxy abierto a cualquier
 *  sitio.
 *
 *  A diferencia de funvisis-proxy.gs, aquí NO normalizamos el
 *  contenido: tanto CurrentStorms.json como el GeoJSON del GIS ya
 *  vienen bien formados y documentados por NOAA, así que este
 *  proxy solo resuelve el problema de CORS. El parseo defensivo
 *  vive en index.html, del lado del navegador, para poder
 *  ajustarlo sin tener que reimplementar el proxy.
 * ============================================================
 */

var FUENTE_OFICIAL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
var CACHE_KEY       = 'nhc_data_v1';
var CACHE_SEGUNDOS  = 180; // 3 min — NHC actualiza por evento, no hace falta más frecuencia

// Dominios permitidos para el passthrough genérico (?url=). Nunca se reenvía nada fuera de esta lista.
var DOMINIOS_PERMITIDOS = [
  'www.nhc.noaa.gov',
  'mapservices.weather.noaa.gov'
];

function doGet(e) {
  var params = (e && e.parameter) || {};

  if (params.url) {
    return manejarPassthrough_(params.url);
  }

  var nocache = params.nocache === '1';
  var payload = obtenerDatos(nocache);
  return ContentService
    .createTextOutput(JSON.stringify(payload.data))
    .setMimeType(ContentService.MimeType.JSON);
}

function manejarPassthrough_(url) {
  var host = extraerHost_(url);
  if (!host || DOMINIOS_PERMITIDOS.indexOf(host) === -1) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'dominio no permitido: ' + host }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    return ContentService
      .createTextOutput(res.getContentText())
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'fetch falló: ' + err }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
function extraerHost_(url) {
  var m = /^https?:\/\/([^\/]+)/i.exec(url);
  return m ? m[1] : null;
}

/**
 * Devuelve {data, via, fetchedAt}. Orden: caché → NHC oficial.
 * Si NHC falla y no hay caché, devuelve activeStorms:[] con un
 * campo de error explícito — nunca datos inventados.
 */
function obtenerDatos(nocache) {
  var cache = CacheService.getScriptCache();

  if (!nocache) {
    var hit = cache.get(CACHE_KEY);
    if (hit) {
      try { return JSON.parse(hit); } catch (err) { /* caché corrupta: seguir */ }
    }
  }

  var payload = intentarFetch_();

  if (!payload) {
    return {
      data: { activeStorms: [], error: 'sin conexión con nhc.noaa.gov desde Apps Script' },
      via: 'error',
      fetchedAt: new Date().toISOString()
    };
  }

  try {
    cache.put(CACHE_KEY, JSON.stringify(payload), CACHE_SEGUNDOS);
  } catch (err) { /* si excede el límite de caché, servimos sin cachear */ }

  return payload;
}

function intentarFetch_() {
  try {
    var res = UrlFetchApp.fetch(FUENTE_OFICIAL, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return null;
    var data = JSON.parse(res.getContentText());
    return { data: data, via: 'nhc.noaa.gov', fetchedAt: new Date().toISOString() };
  } catch (err) {
    return null;
  }
}
