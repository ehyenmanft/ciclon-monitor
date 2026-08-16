/* CICLÓN·MONITOR — service worker
 * Estrategia:
 *  - Cascarón de la app (HTML, íconos, Leaflet): caché primero
 *    → carga instantánea e inicio sin conexión.
 *  - Datos de ciclones (NHC, proxy, WeatherNext/Open-Meteo): SIEMPRE
 *    red, nunca caché → un panel de riesgo jamás debe mostrar datos
 *    viejos como frescos.
 * Al actualizar la web, sube también este archivo cambiando VERSION.
 */
const VERSION = 'v25';
const CACHE = 'ciclon-monitor-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
];

// dominios de datos en vivo: no interceptar jamás
const DATOS_VIVOS = [
  'nhc.noaa.gov',
  'script.google.com',
  'script.googleusercontent.com',
  'open-meteo.com', // cubre también api./ensemble-api./geocoding-api./air-quality-api. (endsWith)
  'basemaps.cartocdn.com',
  'rainviewer.com', // metadata JSON + teselas de radar (endsWith cubre tilecache.rainviewer.com)
  'gibs.earthdata.nasa.gov', // teselas satelitales NASA
  'mapservices.weather.noaa.gov', // GIS oficial del NHC: trayectoria y cono
  'gdacs.org', // alertas multi-amenaza
  'earthquake.usgs.gov', // sismos: red de Estados Unidos
  'seismicportal.eu', // sismos: EMSC (Europa-Mediterráneo, buena cobertura del Caribe)
  'sismosve.rafnixg.dev', // sismos: espejo público de FUNVISIS
  'overpass-api.de', // OpenStreetMap: hospitales, refugios, bomberos
  'overpass.kumi.systems', // espejo de Overpass
  'maps.mail.ru' // espejo de Overpass
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('ciclon-monitor-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // datos en vivo: directo a la red, sin tocar
  if (DATOS_VIVOS.some(d => url.hostname.endsWith(d))) return;

  // navegación (abrir la app): red primero, caché como respaldo sin conexión
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copia));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // resto del cascarón (íconos, librerías): caché primero
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(r => {
        if (r.ok && (url.protocol === 'https:')) {
          const copia = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return r;
      })
    )
  );
});
