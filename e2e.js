#!/usr/bin/env node
/**
 * ============================================================
 *  CICLÓN·MONITOR — ejecución real de la página
 * ============================================================
 *  node e2e.js
 *
 *  test.js y audit.js analizan el código SIN ejecutarlo, así que
 *  no ven los fallos que solo aparecen al correr: un id que se lee
 *  antes de existir, un campo que llega null desde una fuente, un
 *  manejador que revienta al pulsarlo. Esto carga index.html en un
 *  navegador simulado (jsdom), con Leaflet y la red sustituidos por
 *  dobles, y ejercita los flujos principales capturando cualquier
 *  excepción.
 *
 *  Lo que NO puede comprobar: apariencia, CORS real, gestos
 *  táctiles y rendimiento. Eso sigue necesitando un navegador de
 *  verdad.
 * ============================================================
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

let fallos = 0, pruebas = 0;
const errores = [];
function ok(nombre, cond, detalle) {
  pruebas++;
  if (cond) console.log('  \x1b[32m✓\x1b[0m ' + nombre);
  else { fallos++; console.log('  \x1b[31m✗\x1b[0m ' + nombre + (detalle ? '\n      → ' + detalle : '')); }
}
function seccion(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

// ---------------------------------------------------------------
// Doble de Leaflet: registra lo que la aplicación le pide, para
// poder comprobar que dibuja lo que debe.
// ---------------------------------------------------------------
const registro = { capas: 0, marcadores: 0, tiles: [], eventos: {} };
function crearLeafletFalso(win) {
  const encadenable = (extra = {}) => {
    const o = Object.assign({
      addTo() { registro.capas++; return o; },
      bindPopup() { return o; },
      bindTooltip() { return o; },
      on() { return o; },
      addEventListener() { return o; },
      clearLayers() { return o; },
      removeLayer() { return o; },
      setUrl() { return o; },
      setStyle() { return o; },
      remove() { return o; },
      getElement() { return win.document.createElement('div'); }
    }, extra);
    return o;
  };
  const mapa = encadenable({
    setView() { return mapa; },
    panTo() { return mapa; },
    setZoom(z) { mapa._z = z; return mapa; },
    getZoom() { return mapa._z || 5; },
    zoomIn() { return mapa; },
    zoomOut() { return mapa; },
    getCenter() { return { lat: 10.5, lng: -66.9 }; },
    getBounds() {
      return {
        getNorth: () => 16, getSouth: () => 6, getEast: () => -60, getWest: () => -74,
        contains: () => true
      };
    },
    on(ev, fn) { (registro.eventos[ev] = registro.eventos[ev] || []).push(fn); return mapa; },
    invalidateSize() { return mapa; },
    closePopup() { return mapa; },
    addLayer() { return mapa; },
    removeLayer() { return mapa; },
    _z: 5
  });
  const L = {
    map: () => mapa,
    tileLayer: (url, opts) => { registro.tiles.push({ url, opts }); return encadenable(); },
    layerGroup: () => encadenable(),
    marker: () => { registro.marcadores++; return encadenable(); },
    circleMarker: () => { registro.marcadores++; return encadenable(); },
    circle: () => encadenable(),
    polyline: () => encadenable(),
    geoJSON: () => encadenable(),
    divIcon: (o) => o,
    control: {
      zoom: () => encadenable(),
      scale: () => encadenable()
    }
  };
  L.control.zoom = () => encadenable();
  L.control.scale = () => encadenable();
  return L;
}

// ---------------------------------------------------------------
// Red simulada: cada endpoint responde con datos con la forma real.
// Se puede pedir que una fuente falle, para probar la degradación.
// ---------------------------------------------------------------
function crearFetchFalso(opciones = {}) {
  const fallan = opciones.fallan || [];
  const llamadas = [];
  const j = (data) => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });
  const fn = (url, init) => {
    const u = String(url);
    llamadas.push(u);
    if (fallan.some(f => u.includes(f))) return Promise.reject(new Error('fallo simulado: ' + u));

    if (u.includes('CurrentStorms') || u.includes('script.google')) {
      if (opciones.vacio) return j({ activeStorms: [] });
      if (opciones.raro) {
        // lo que puede llegar de verdad si NOAA cambia el formato sin avisar
        return j({ activeStorms: [
          { id: 'x1', name: 'SIN DATOS' },                                   // sin nada más
          { id: 'x2', name: 'PARCIAL', classification: 'HU', latitude: 12,   // sin longitud
            intensity: null, pressure: 'no disponible' },
          { id: 'x3', name: 'TIPOS RAROS', classification: 99, latitude: '13.5',
            longitude: '-64.2', intensity: '105', pressure: undefined,
            movementSpeed: null, lastUpdate: 'fecha inválida' }
        ] });
      }
      return j({ activeStorms: [{
        id: 'al012026', name: 'ANDREA', classification: 'HU',
        latitude: 13.2, longitude: -64.1, intensity: 105, pressure: 962,
        movementDir: 285, movementSpeed: 16, lastUpdate: new Date().toISOString(),
        publicAdvisory: { url: 'https://www.nhc.noaa.gov/x' }
      }, {
        id: 'al022026', name: 'BETO', classification: 'TD',
        latitude: 11.0, longitude: -55.0, intensity: 28, pressure: 1007,
        movementDir: 290, movementSpeed: 18, lastUpdate: new Date().toISOString()
      }] });
    }
    if (u.includes('rainviewer')) {
      const t = Math.floor(Date.now() / 1000);
      return j({ host: 'https://tilecache.rainviewer.com', radar: { past: [
        { time: t - 1200, path: '/v2/radar/a' }, { time: t - 600, path: '/v2/radar/b' }, { time: t, path: '/v2/radar/c' }
      ] } });
    }
    if (u.includes('geocoding-api')) {
      return j({ results: [{ name: 'Valencia', latitude: 10.16, longitude: -68.0, country: 'Venezuela', admin1: 'Carabobo' }] });
    }
    if (u.includes('air-quality')) return j({ current: { european_aqi: 25, us_aqi: 53, pm2_5: 6 } });
    if (u.includes('flood-api')) return j({ daily: { river_discharge: [1.6, 2.2, 4.8, 3.0, 2.1, 1.9, 1.7] } });
    if (u.includes('marine-api')) return j({ current: { wave_height: 0.9, wave_direction: 55, wave_period: 5, sea_surface_temperature: 26 } });
    if (u.includes('ensemble-api')) {
      const t = [], w0 = [], w1 = [], p0 = [], p1 = [];
      for (let i = 0; i < 28; i++) {
        t.push(new Date(Date.now() + i * 6 * 3600000).toISOString());
        w0.push(20 + i); w1.push(24 + i); p0.push(1010 - i); p1.push(1008 - i);
      }
      return j({ hourly: { time: t, wind_speed_10m_member01: w0, wind_speed_10m_member02: w1,
                           pressure_msl_member01: p0, pressure_msl_member02: p1 } });
    }
    if (u.includes('api.open-meteo.com')) {
      // varias coordenadas → array; una sola → objeto
      const varias = /latitude=[-\d.]+,/.test(u);
      if (opciones.raro) {
        return j({ current: { temperature_2m: null, weather_code: 999, apparent_temperature: undefined,
          wind_speed_10m: 'mucho', wind_gusts_10m: null, relative_humidity_2m: 78,
          pressure_msl: null, cloud_cover: undefined, precipitation: null },
          hourly: { time: [], precipitation_probability: [] },
          daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [],
                   precipitation_sum: [], precipitation_probability_max: [], uv_index_max: [] } });
      }
      const uno = () => {
        const t = [], pp = [], tt = [], wc = [];
        for (let i = 0; i < 48; i++) {
          t.push(new Date(Date.now() + i * 3600000).toISOString());
          pp.push(60 + (i % 40)); tt.push(26 - (i % 5)); wc.push(2);
        }
        return {
          current: { temperature_2m: 29, relative_humidity_2m: 78, apparent_temperature: 33,
            precipitation: 0, weather_code: 2, cloud_cover: 42, pressure_msl: 1012,
            wind_speed_10m: 22, wind_direction_10m: 75, wind_gusts_10m: 55,
            cape: 1200, soil_moisture_0_to_1cm: 0.41, visibility: 18000 },
          hourly: { time: t, temperature_2m: tt, precipitation_probability: pp, weather_code: wc },
          daily: { time: [0,1,2,3,4,5,6].map(d => new Date(Date.now() + d * 86400000).toISOString().slice(0,10)),
            weather_code: [2,3,61,80,2,1,2],
            temperature_2m_max: [31,30,29,28,30,31,31], temperature_2m_min: [23,24,24,23,24,24,23],
            precipitation_sum: [12, 25, 30, 8, 2, 0, 1],
            precipitation_probability_max: [94, 100, 92, 55, 30, 20, 15],
            uv_index_max: [9,8,7,8,9,10,9],
            sunrise: [], sunset: [] }
        };
      };
      return j(varias ? [uno(), uno(), uno(), uno(), uno(), uno(), uno(), uno(), uno()] : uno());
    }
    if (u.includes('mapservices.weather.noaa.gov')) {
      if (u.includes('_summary')) {
        if (opciones.vacio) return j({ type: 'FeatureCollection', features: [] });
        return j({ type: 'FeatureCollection', features: [{
          type: 'Feature', geometry: { type: 'Point', coordinates: [-48.2, 12.4] },
          properties: { prob2day: 30, prob7day: 70, basin: 'AL' }
        }] });
      }
      return j({ type: 'FeatureCollection', features: [{
        type: 'Feature', geometry: { type: 'Point', coordinates: [-64.1, 13.2] },
        properties: { STORMNAME: 'ANDREA', MAXWIND: 105, FLDATELBL: '08/1400' }
      }] });
    }
    if (u.includes('usgs.gov')) {
      return j({ features: [{ geometry: { type: 'Point', coordinates: [-66.5, 10.7, 24] },
        properties: { mag: 4.2, place: '20 km NE de Caracas', time: Date.now() - 3600000, url: 'https://x' } }] });
    }
    if (u.includes('seismicportal')) {
      return j({ features: [{ properties: { mag: 3.1, flynn_region: 'CARIBBEAN', time: new Date().toISOString(),
        lat: 11.2, lon: -62.0, depth: 30, unid: 'abc' } }] });
    }
    if (u.includes('sismosve') || u.includes('funvisis')) {
      return j({ features: [{ properties: { value: '3.4', depth: '15', address: 'Sur de Cariaco',
        date: '08-08-2026', time: '10:15', lat: '10.5', long: '-63.6' } }] });
    }
    if (u.includes('gdacs')) {
      return j({ type: 'FeatureCollection', features: [{
        type: 'Feature', geometry: { type: 'Point', coordinates: [-66.9, 10.4] },
        properties: { eventtype: 'FL', alertlevel: 'Orange', eventname: 'Inundación Venezuela',
          country: 'Venezuela', fromdate: '2026-08-01', url: 'https://gdacs.org/x' } }] });
    }
    if (u.includes('overpass')) {
      return j({ elements: [{ type: 'node', lat: 10.5, lon: -66.9,
        tags: { amenity: 'hospital', name: 'Hospital Central', phone: '0212-555' } }] });
    }
    return j({});
  };
  fn.llamadas = llamadas;
  return fn;
}

// ---------------------------------------------------------------
// Arranque de la página
// ---------------------------------------------------------------
async function abrirPagina(opciones = {}) {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
    // fuera el <script src> de Leaflet: no hay red hacia el CDN y se sustituye por un doble
    .replace(/<script src="[^"]*leaflet[^"]*"><\/script>/i, '');

  const vc = new VirtualConsole();
  const consola = [];
  vc.on('jsdomError', e => { errores.push('jsdomError: ' + (e.detail || e.message)); });
  vc.on('error', (...a) => consola.push('error: ' + a.join(' ')));
  vc.on('warn', (...a) => consola.push('warn: ' + a.join(' ')));

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://ehyenmanft.github.io/ciclon-monitor/' + (opciones.query || ''),
    virtualConsole: vc,
    beforeParse(win) {
      win.L = crearLeafletFalso(win);
      win.fetch = crearFetchFalso(opciones);
      // la app elige idioma por navigator.language; se fuerza para poder
      // comprobar ambos recorridos de forma determinista
      Object.defineProperty(win.navigator, 'language', { value: opciones.idioma || 'es-VE', configurable: true });
      win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      win.scrollTo = () => {};
      win.print = () => { registro.imprimio = true; };
      win.navigator.geolocation = {
        getCurrentPosition: (ok2) => ok2({ coords: { latitude: 10.6, longitude: -66.9 } })
      };
      Object.defineProperty(win.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
      // canvas: jsdom no lo implementa; basta con que no reviente
      win.HTMLCanvasElement.prototype.getContext = function () {
        const nada = () => {};
        return new Proxy({}, {
          get: (t, k) => {
            if (k === 'measureText') return () => ({ width: 42 });
            if (k === 'canvas') return { width: 1080, height: 1080 };
            return nada;
          },
          set: () => true
        });
      };
      win.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new win.Blob([''], { type: 'image/png' })); };
    }
  });

  const win = dom.window;
  await new Promise(r => {
    if (win.document.readyState === 'complete') r();
    else win.addEventListener('load', r);
  });
  await new Promise(r => setTimeout(r, 300)); // dar tiempo a las promesas de red
  return { dom, win, consola };
}

function clic(win, id) {
  const el = win.document.getElementById(id);
  if (!el) throw new Error('no existe #' + id);
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
}

// ---------------------------------------------------------------
(async function () {
  console.log('\n═══ EJECUCIÓN REAL DE LA PÁGINA (jsdom) ═══');

  seccion('Arranque');
  let ctx;
  try {
    ctx = await abrirPagina();
    ok('la página carga sin excepciones', errores.length === 0, errores.join(' | '));
  } catch (e) {
    ok('la página carga sin excepciones', false, e.message);
    process.exit(1);
  }
  const { win, consola } = ctx;

  const errConsola = consola.filter(c => c.startsWith('error:'));
  ok('sin errores en consola al arrancar', errConsola.length === 0, errConsola.slice(0, 3).join(' | '));

  ok('el mapa se inicializa', registro.tiles.length > 0, 'ninguna capa de teselas creada');
  ok('el radar arranca encendido', win.document.getElementById('btnRadar').classList.contains('act'));
  ok('las ciudades arrancan encendidas', win.document.getElementById('btnCiudades').classList.contains('act'));
  ok('el modo por defecto es Clima', win.document.getElementById('modeBtnClima').classList.contains('act'));

  seccion('Datos cargados');
  const lista = win.document.getElementById('stormList');
  ok('los sistemas activos se listan', /ANDREA/.test(lista.innerHTML), 'lista: ' + lista.textContent.slice(0, 80));
  ok('una depresión tropical aparece en la lista', /BETO/.test(lista.innerHTML));
  ok('la categoría Saffir-Simpson se muestra', /categor[íi]a?y?\s*3/i.test(lista.innerHTML),
     'esperaba categoría 3 para 105 kt · ' + lista.textContent.slice(0, 120));
  ok('la depresión se etiqueta como tal', /Depresión tropical|Tropical depression/i.test(lista.innerHTML));
  const dist = win.document.getElementById('disturbiosList');
  ok('las perturbaciones vigiladas se listan', /70%|Perturbación/i.test(dist.innerHTML), dist.textContent.slice(0, 80));
  const clima = win.document.getElementById('climaBody');
  ok('la ficha de clima se rellena', /29|Caracas/i.test(clima.innerHTML), clima.textContent.slice(0, 80));
  ok('el análisis de condiciones aparece',
     /riesgo|lluvia|suelo|risk|rain|soil/i.test(clima.innerHTML), clima.textContent.slice(0, 100));
  ok('el caudal del río se muestra', /m³\/s/.test(clima.innerHTML));
  ok('el estado del mar se muestra', /0\.9|ola/i.test(clima.innerHTML));

  seccion('Interacción');
  const antes = errores.length;
  const botones = ['btnSat', 'btnViento', 'btnNubes', 'btnGdacs', 'btnRecursos', 'btnSismos',
                   'btnLegend', 'btnDiag', 'btnRRSS', 'btnShareView', 'themeBtn', 'langBtn',
                   'hideAllBtn', 'btnSimulacro', 'zoomInBtn', 'zoomOutBtn', 'printBtn'];
  const rotos = [];
  for (const b of botones) {
    try { clic(win, b); await new Promise(r => setTimeout(r, 40)); }
    catch (e) { rotos.push(b + ': ' + e.message); }
  }
  ok('ningún botón lanza excepción al pulsarlo', rotos.length === 0 && errores.length === antes,
     rotos.concat(errores.slice(antes)).join(' | '));

  ok('la leyenda se rellena al abrirla',
     (win.document.getElementById('legendBody').innerHTML || '').length > 200);
  ok('el diagnóstico se ejecuta', (win.document.getElementById('diagBody').innerHTML || '').length > 20);
  // en modo Clima comparte la ciudad; en modo Ciclones, el sistema
  const txtComp = win.document.getElementById('rrssTexto').value || '';
  ok('el modal de compartir genera el texto de lo que se ve',
     /Caracas|ANDREA|CICLÓN/i.test(txtComp), 'texto: ' + txtComp.slice(0, 60));
  ok('el texto compartido lleva la fuente y la hora',
     /Fuente|Source/.test(txtComp) && /\dZ|\d{2}:\d{2}/.test(txtComp));
  ok('el mensaje compartido incluye el aviso de no-oficial',
     /NO es un aviso oficial|NOT an official/i.test(win.document.getElementById('rrssTexto').value || ''));
  ok('el reporte de impresión se genera',
     (win.document.getElementById('printReport').innerHTML || '').length > 50);

  seccion('Simulacro');
  const sim = win.document.getElementById('simuladorModal');
  ok('el selector de simulacro se abre', sim.classList.contains('on'));
  const escenarios = win.document.querySelectorAll('#simuladorLista .simEsc');
  ok('hay escenarios de simulacro', escenarios.length >= 3, 'encontrados: ' + escenarios.length);
  if (escenarios.length) {
    escenarios[escenarios.length - 1].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    ok('el simulacro se activa', win.document.body.classList.contains('simulacro'));
    ok('el banner de simulacro se muestra',
       win.document.getElementById('simulacroBanner').classList.contains('on'));
    ok('los sistemas del simulacro se marcan',
       /SIMULACRO/.test(win.document.getElementById('stormList').innerHTML));
    // el texto compartido debe advertirlo
    clic(win, 'btnRRSS');
    await new Promise(r => setTimeout(r, 60));
    ok('el texto a compartir advierte que es un ejercicio',
       /EJERCICIO|DRILL/i.test(win.document.getElementById('rrssTexto').value || ''),
       (win.document.getElementById('rrssTexto').value || '').slice(0, 70));
    const salir = win.document.getElementById('simSalirBtn');
    if (salir) {
      salir.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
      ok('se sale del simulacro', !win.document.body.classList.contains('simulacro'));
    }
  }

  seccion('Degradación ante fuentes caídas');
  errores.length = 0;
  const caido = await abrirPagina({ fallan: ['CurrentStorms', 'script.google', 'gdacs', 'usgs', 'overpass'] });
  ok('la página sobrevive con varias fuentes caídas', errores.length === 0, errores.join(' | '));
  ok('se avisa del fallo de fuente',
     caido.win.document.getElementById('sourceBanner').classList.contains('on'));
  ok('el clima sigue funcionando pese al fallo del resto',
     /29|°/.test(caido.win.document.getElementById('climaBody').innerHTML || ''));

  seccion('Vista compartida por URL');
  errores.length = 0;
  const compartida = await abrirPagina({ query: '?lat=11&lon=-63&z=6&m=x&l=rv' });
  ok('una URL compartida se aplica sin errores', errores.length === 0, errores.join(' | '));
  ok('la URL fija el modo Ciclones',
     compartida.win.document.getElementById('modeBtnCiclones').classList.contains('act'));
  ok('la URL activa las capas indicadas',
     compartida.win.document.getElementById('btnViento').classList.contains('act'));

  seccion('Recorrido en inglés');
  errores.length = 0;
  const en = await abrirPagina({ idioma: 'en-US' });
  ok('la página funciona en inglés', errores.length === 0, errores.join(' | '));
  const enHtml = en.win.document.body.innerHTML;
  // OJO: el <script> vive dentro del <body>, así que su código entra en
  // textContent. Se mide solo el texto visible.
  function textoVisible(doc){
    const clon = doc.body.cloneNode(true);
    clon.querySelectorAll('script, style').forEach(n => n.remove());
    return clon.textContent;
  }
  const visibleEn = textoVisible(en.win.document);
  const sinResolver = visibleEn.match(/\b(an[A-Z]\w+|sim[A-Z]\w+|comp[A-Z]\w+|leg[A-Z]\w+|rrss[A-Z]\w+)\b/g) || [];
  ok('no quedan claves de traducción sin resolver en pantalla',
     sinResolver.length === 0, sinResolver.slice(0, 5).join(', '));
  ok('la ficha inglesa muestra la categoría', /category\s*3/i.test(enHtml));

  seccion('Datos degenerados (robustez del parseo)');
  errores.length = 0;
  const raro = await abrirPagina({ raro: true });
  ok('sobrevive a campos nulos y tipos inesperados', errores.length === 0, errores.join(' | '));
  const listaRara = raro.win.document.getElementById('stormList').textContent;
  ok('no imprime NaN ni undefined en pantalla',
     !/NaN|undefined|null/.test(listaRara), listaRara.slice(0, 120));
  const climaRaro = raro.win.document.getElementById('climaBody').textContent;
  ok('la ficha de clima tampoco imprime NaN',
     !/NaN|undefined/.test(climaRaro), climaRaro.slice(0, 120));

  seccion('Sin ciclones activos (el caso más común)');
  errores.length = 0;
  const vacio = await abrirPagina({ vacio: true });
  ok('la página funciona sin sistemas activos', errores.length === 0, errores.join(' | '));
  const txtVacio = vacio.win.document.getElementById('emptyState').textContent;
  ok('se explica que no hay sistemas', txtVacio.length > 10, txtVacio.slice(0, 80));
  ok('no aparece la alerta de Venezuela sin motivo',
     !vacio.win.document.getElementById('vzAlertBanner').classList.contains('on'));

  seccion('Simulacro sin conexión');
  errores.length = 0;
  const simOff = await abrirPagina({ fallan: ['CurrentStorms', 'script.google', 'mapservices'] });
  try {
    simOff.win.document.getElementById('btnSimulacro').dispatchEvent(new simOff.win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const escs = simOff.win.document.querySelectorAll('#simuladorLista .simEsc');
    if (escs.length) escs[0].dispatchEvent(new simOff.win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    ok('el simulacro funciona aunque las fuentes estén caídas', errores.length === 0, errores.join(' | '));
    ok('el ejercicio se activa igualmente', simOff.win.document.body.classList.contains('simulacro'));
    ok('el aviso de fuente caída no oculta el del simulacro',
       simOff.win.document.getElementById('simulacroBanner').classList.contains('on'));
  } catch (e) { ok('el simulacro funciona sin conexión', false, e.message); }

  console.log('\n' + '─'.repeat(52));
  if (fallos === 0) { console.log(`\x1b[32m✓ ${pruebas} comprobaciones en ejecución, todo correcto\x1b[0m`); process.exit(0); }
  else { console.log(`\x1b[31m✗ ${fallos} de ${pruebas} comprobaciones fallaron\x1b[0m`); process.exit(1); }
})().catch(e => { console.error('\x1b[31mError del banco de pruebas:\x1b[0m', e); process.exit(1); });
