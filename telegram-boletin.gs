/**
 * ============================================================
 *  CICLÓN·MONITOR — Boletín diario para Telegram
 * ============================================================
 *  Publica cada mañana a las 6:00 (hora de Venezuela) una ficha
 *  por ciudad con su condición, pronóstico e indicadores de
 *  riesgo, como imagen + texto, en un canal de Telegram.
 *
 *  ── INSTALACIÓN ────────────────────────────────────────────
 *  1. Crea el bot: escribe a @BotFather en Telegram, /newbot,
 *     y guarda el token que te da.
 *  2. Crea el canal, añade el bot como ADMINISTRADOR (si no, no
 *     puede publicar) y anota su @usuario, por ejemplo
 *     @ciclonmonitorve.
 *  3. Ve a script.google.com → Nuevo proyecto, pega este archivo.
 *  4. Configuración (⚙) → Propiedades del script → añade:
 *        TELEGRAM_BOT_TOKEN  = el token de BotFather
 *        TELEGRAM_CHAT_ID    = @tucanal   (o el id numérico)
 *     NO pongas el token en el código: este proyecto puede
 *     acabar compartido y el token permite publicar en tu canal.
 *  5. Configuración (⚙) → Zona horaria → (GMT-04:00) Caracas.
 *  6. Servicios (+) → añade «Google Slides API». Hace falta para
 *     generar la imagen; sin ella el boletín sale solo en texto.
 *  7. Ejecuta `probarAhora` una vez: pedirá permisos y publicará
 *     un boletín de prueba para que compruebes cómo se ve. Puedes
 *     repetirlo las veces que quieras: `probarAhora` ignora la
 *     protección anti-duplicados (esa protección solo evita que el
 *     disparador publique dos veces la misma mañana).
 *  8. Ejecuta `instalarDisparador` para programarlo a las 6:00.
 *
 *  ── CUOTA ──────────────────────────────────────────────────
 *  Con 16 ciudades el boletín consume ~35 llamadas externas al
 *  día, muy por debajo del límite gratuito de Apps Script
 *  (20.000 UrlFetch/día). La generación de miniaturas de Slides
 *  cuenta como «lectura costosa», así que si algún día amplías
 *  mucho la lista, vigila esa cuota primero.
 *  Si el canal se vuelve ruidoso, pon SOLO_DESTACABLES = true:
 *  publica ficha solo de las ciudades con algo que reportar.
 *
 *  ── DECISIONES DE DISEÑO ───────────────────────────────────
 *  · Apps Script no tiene canvas, así que la tarjeta no se puede
 *    dibujar como en la web. Se compone en una diapositiva de
 *    Google Slides y se exporta a PNG. Es la única vía dentro de
 *    la cuenta gratuita de Google.
 *  · Si la imagen falla por lo que sea, el boletín SE ENVÍA IGUAL
 *    en texto: un canal de riesgo que se calla porque no pudo
 *    renderizar una imagen sería un fallo peor.
 *  · El clima de todas las ciudades se pide en UNA sola llamada:
 *    Open-Meteo acepta listas de coordenadas.
 *  · Cada mensaje lleva fuente, hora y el aviso de que no
 *    sustituye a los avisos oficiales, igual que en la web: un
 *    mensaje reenviado viaja sin contexto.
 * ============================================================
 */

// ── Configuración ──────────────────────────────────────────
var WEB_URL = 'https://ehyenmanft.github.io/ciclon-monitor/';
var OM_FORECAST = 'https://api.open-meteo.com/v1/forecast';
var NHC_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
var PAUSA_MS = 1500;   // respiro entre mensajes: Telegram limita ~20/min por canal
var ZONA = 'America/Caracas';

/**
 * Ciudades del boletín, una sección por entidad federal, en orden alfabético.
 * Cubre las 23 capitales de estado, el Distrito Capital y las ciudades con
 * mayor población o exposición. 68 en total.
 *
 * pri = 1 → ficha completa (imagen + texto) cada mañana
 * pri = 2 → entra en el resumen agrupado por estado
 * Con 68 fichas diarias el canal se vuelve ilegible y la gente lo silencia; y
 * entonces no lo lee el día que de verdad importa. Sube una ciudad a pri 1 si
 * tu público la necesita a diario. Una ciudad EN ALERTA recibe siempre ficha
 * completa, sea cual sea su prioridad: la prioridad regula el ruido de un día
 * normal, nunca oculta un riesgo.
 *
 * Las coordenadas son del centro urbano. La rejilla de Open-Meteo es de unos
 * 5-11 km, así que una diferencia de un par de calles no cambia el dato.
 */
var CIUDADES = [

  // ── Amazonas ───────────────────────────────────────────
  { n: 'Puerto Ayacucho',         e: 'Amazonas',         lat:  5.6639, lon: -67.6236, pri: 1 },

  // ── Anzoátegui ─────────────────────────────────────────
  { n: 'Barcelona',               e: 'Anzoátegui',       lat: 10.1340, lon: -64.6960, pri: 1 },
  { n: 'Puerto La Cruz',          e: 'Anzoátegui',       lat: 10.2137, lon: -64.6335, pri: 1 },
  { n: 'El Tigre',                e: 'Anzoátegui',       lat:  8.8900, lon: -64.2600, pri: 2 },
  { n: 'Anaco',                   e: 'Anzoátegui',       lat:  9.4300, lon: -64.4700, pri: 2 },

  // ── Apure ──────────────────────────────────────────────
  { n: 'San Fernando de Apure',   e: 'Apure',            lat:  7.8939, lon: -67.4730, pri: 1 },
  { n: 'Guasdualito',             e: 'Apure',            lat:  7.2500, lon: -70.7333, pri: 2 },

  // ── Aragua ─────────────────────────────────────────────
  { n: 'Maracay',                 e: 'Aragua',           lat: 10.2469, lon: -67.5959, pri: 1 },
  { n: 'Turmero',                 e: 'Aragua',           lat: 10.2264, lon: -67.4750, pri: 2 },
  { n: 'La Victoria',             e: 'Aragua',           lat: 10.2264, lon: -67.3319, pri: 2 },
  { n: 'Cagua',                   e: 'Aragua',           lat: 10.1861, lon: -67.4589, pri: 2 },
  { n: 'Villa de Cura',           e: 'Aragua',           lat: 10.0397, lon: -67.4894, pri: 2 },

  // ── Barinas ────────────────────────────────────────────
  { n: 'Barinas',                 e: 'Barinas',          lat:  8.6226, lon: -70.2075, pri: 1 },

  // ── Bolívar ────────────────────────────────────────────
  { n: 'Ciudad Bolívar',          e: 'Bolívar',          lat:  8.1222, lon: -63.5497, pri: 1 },
  { n: 'Ciudad Guayana',          e: 'Bolívar',          lat:  8.3533, lon: -62.6417, pri: 1 },
  { n: 'Upata',                   e: 'Bolívar',          lat:  8.0128, lon: -62.3989, pri: 2 },
  { n: 'Santa Elena de Uairén',   e: 'Bolívar',          lat:  4.6000, lon: -61.1167, pri: 2 },

  // ── Carabobo ───────────────────────────────────────────
  { n: 'Valencia',                e: 'Carabobo',         lat: 10.1621, lon: -68.0077, pri: 1 },
  { n: 'Puerto Cabello',          e: 'Carabobo',         lat: 10.4731, lon: -68.0125, pri: 1 },
  { n: 'Guacara',                 e: 'Carabobo',         lat: 10.2264, lon: -67.8772, pri: 2 },
  { n: 'Morón',                   e: 'Carabobo',         lat: 10.4867, lon: -68.1958, pri: 2 },

  // ── Cojedes ────────────────────────────────────────────
  { n: 'San Carlos',              e: 'Cojedes',          lat:  9.6614, lon: -68.5867, pri: 1 },
  { n: 'Tinaquillo',              e: 'Cojedes',          lat:  9.9186, lon: -68.3050, pri: 2 },

  // ── Delta Amacuro ──────────────────────────────────────
  { n: 'Tucupita',                e: 'Delta Amacuro',    lat:  9.0586, lon: -62.0500, pri: 1 },

  // ── Distrito Capital ───────────────────────────────────
  { n: 'Caracas',                 e: 'Distrito Capital', lat: 10.4806, lon: -66.9036, pri: 1 },

  // ── Falcón ─────────────────────────────────────────────
  { n: 'Coro',                    e: 'Falcón',           lat: 11.4045, lon: -69.6734, pri: 1 },
  { n: 'Punto Fijo',              e: 'Falcón',           lat: 11.6947, lon: -70.1994, pri: 1 },
  { n: 'Tucacas',                 e: 'Falcón',           lat: 10.7967, lon: -68.3239, pri: 2 },
  { n: 'Chichiriviche',           e: 'Falcón',           lat: 10.9333, lon: -68.2667, pri: 2 },

  // ── Guárico ────────────────────────────────────────────
  { n: 'San Juan de los Morros',  e: 'Guárico',          lat:  9.9075, lon: -67.3547, pri: 1 },
  { n: 'Calabozo',                e: 'Guárico',          lat:  8.9242, lon: -67.4292, pri: 2 },
  { n: 'Valle de la Pascua',      e: 'Guárico',          lat:  9.2117, lon: -66.0069, pri: 2 },

  // ── La Guaira (estado, antes Vargas) ───────────────────
  // Entidad propia, distinta del Distrito Capital: la separa la cordillera y
  // su clima costero es marcadamente distinto al de Caracas. Es además la zona
  // del deslave de 1999 y del terremoto de 2026, así que su ficha va aparte.
  { n: 'La Guaira',               e: 'La Guaira',        lat: 10.6083, lon: -66.9317, pri: 1 },
  { n: 'Catia La Mar',            e: 'La Guaira',        lat: 10.5983, lon: -67.0289, pri: 2 },
  { n: 'Macuto',                  e: 'La Guaira',        lat: 10.6100, lon: -66.8900, pri: 2 },
  { n: 'Naiguatá',                e: 'La Guaira',        lat: 10.6167, lon: -66.7333, pri: 2 },

  // ── Lara ───────────────────────────────────────────────
  { n: 'Barquisimeto',            e: 'Lara',             lat: 10.0678, lon: -69.3474, pri: 1 },
  { n: 'Cabudare',                e: 'Lara',             lat: 10.0247, lon: -69.2622, pri: 2 },
  { n: 'Carora',                  e: 'Lara',             lat: 10.1747, lon: -70.0800, pri: 2 },
  { n: 'El Tocuyo',               e: 'Lara',             lat:  9.7869, lon: -69.7961, pri: 2 },

  // ── Mérida ─────────────────────────────────────────────
  { n: 'Mérida',                  e: 'Mérida',           lat:  8.5960, lon: -71.1467, pri: 1 },
  { n: 'El Vigía',                e: 'Mérida',           lat:  8.6167, lon: -71.6500, pri: 2 },
  { n: 'Tovar',                   e: 'Mérida',           lat:  8.3333, lon: -71.7667, pri: 2 },

  // ── Miranda ────────────────────────────────────────────
  { n: 'Los Teques',              e: 'Miranda',          lat: 10.3439, lon: -67.0421, pri: 1 },
  { n: 'Guarenas',                e: 'Miranda',          lat: 10.4700, lon: -66.6100, pri: 2 },
  { n: 'Guatire',                 e: 'Miranda',          lat: 10.4761, lon: -66.5405, pri: 2 },
  { n: 'Charallave',              e: 'Miranda',          lat: 10.2436, lon: -66.8583, pri: 2 },
  { n: 'Ocumare del Tuy',         e: 'Miranda',          lat: 10.1147, lon: -66.7717, pri: 2 },
  { n: 'Higuerote',               e: 'Miranda',          lat: 10.4833, lon: -66.1000, pri: 2 },

  // ── Monagas ────────────────────────────────────────────
  { n: 'Maturín',                 e: 'Monagas',          lat:  9.7457, lon: -63.1832, pri: 1 },
  { n: 'Caripito',                e: 'Monagas',          lat: 10.1069, lon: -63.1006, pri: 2 },

  // ── Nueva Esparta ──────────────────────────────────────
  { n: 'Porlamar',                e: 'Nueva Esparta',    lat: 10.9577, lon: -63.8480, pri: 1 },
  { n: 'La Asunción',             e: 'Nueva Esparta',    lat: 11.0333, lon: -63.8628, pri: 2 },

  // ── Portuguesa ─────────────────────────────────────────
  { n: 'Guanare',                 e: 'Portuguesa',       lat:  9.0433, lon: -69.7419, pri: 1 },
  { n: 'Acarigua',                e: 'Portuguesa',       lat:  9.5597, lon: -69.2019, pri: 2 },

  // ── Sucre ──────────────────────────────────────────────
  { n: 'Cumaná',                  e: 'Sucre',            lat: 10.4540, lon: -64.1770, pri: 1 },
  { n: 'Carúpano',                e: 'Sucre',            lat: 10.6667, lon: -63.2500, pri: 2 },
  { n: 'Güiria',                  e: 'Sucre',            lat: 10.5750, lon: -62.2958, pri: 2 },

  // ── Táchira ────────────────────────────────────────────
  { n: 'San Cristóbal',           e: 'Táchira',          lat:  7.7669, lon: -72.2250, pri: 1 },
  { n: 'San Antonio del Táchira', e: 'Táchira',          lat:  7.8144, lon: -72.4425, pri: 2 },
  { n: 'Rubio',                   e: 'Táchira',          lat:  7.7000, lon: -72.3500, pri: 2 },

  // ── Trujillo ───────────────────────────────────────────
  { n: 'Trujillo',                e: 'Trujillo',         lat:  9.3667, lon: -70.4333, pri: 1 },
  { n: 'Valera',                  e: 'Trujillo',         lat:  9.3167, lon: -70.6036, pri: 2 },

  // ── Yaracuy ────────────────────────────────────────────
  { n: 'San Felipe',              e: 'Yaracuy',          lat: 10.3400, lon: -68.7458, pri: 1 },
  { n: 'Yaritagua',               e: 'Yaracuy',          lat: 10.0833, lon: -69.1167, pri: 2 },

  // ── Zulia ──────────────────────────────────────────────
  { n: 'Maracaibo',               e: 'Zulia',            lat: 10.6666, lon: -71.6124, pri: 1 },
  { n: 'Cabimas',                 e: 'Zulia',            lat: 10.3900, lon: -71.4470, pri: 2 },
  { n: 'Ciudad Ojeda',            e: 'Zulia',            lat: 10.2000, lon: -71.3110, pri: 2 },
  { n: 'Santa Bárbara del Zulia', e: 'Zulia',            lat:  9.0000, lon: -71.9167, pri: 2 },
  { n: 'Machiques',               e: 'Zulia',            lat: 10.0667, lon: -72.5500, pri: 2 }
];

/** Mismos umbrales que la aplicación web: si se ajustan allí, ajustar aquí. */
var UMBRALES = {
  lluviaProb: 70, lluviaAcum: 20, sueloSaturado: 0.35,
  rafagaAtencion: 50, rafagaAlerta: 70, capeTormenta: 1000,
  uvAlto: 8, calorSensacion: 5
};

var COLORES = {
  fondo: '#0b0f14', texto: '#dde7ef', tenue: '#76879a',
  acento: '#f07f3c', peligro: '#e8484f', ok: '#3ec6a8', frio: '#6fb8e0'
};

// ── Punto de entrada ───────────────────────────────────────

/**
 * Si es true, solo se publica ficha de las ciudades con algo destacable,
 * más un resumen del resto. Con 16 ciudades todos los días, un canal puede
 * volverse ruidoso y la gente lo silencia — y entonces no lee el aviso el
 * día que importa. Ponlo en true si notas que ocurre.
 */
var SOLO_DESTACABLES = false;

/**
 * Lo que ejecuta el disparador de las 6:00.
 * `forzar` solo lo usan las funciones de prueba manuales. OJO: el disparador
 * llama a esta función pasándole un objeto de evento como primer argumento,
 * así que hay que comparar con === true; con un simple `if (forzar)` el
 * disparador se saltaría siempre la protección anti-duplicados.
 */
function reporteDiario(forzar) {
  var cfg = leerConfig_();
  var manual = (forzar === true);

  // Apps Script puede reintentar un disparador: sin esto, el canal recibiría
  // el boletín dos veces la misma mañana.
  var props = PropertiesService.getScriptProperties();
  var hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  if (!manual && props.getProperty('ULTIMO_BOLETIN') === hoy) {
    Logger.log('El boletín de ' + hoy + ' ya se envió; no se repite. ' +
      'Para mandarlo otra vez a mano, ejecuta `probarAhora`.');
    return;
  }
  props.setProperty('ULTIMO_BOLETIN', hoy);
  if (manual) Logger.log('Envío manual: se ignora la protección anti-duplicados.');
  var datos = obtenerClimaTodas_();
  if (!datos) {
    // Se deja SIN marcar el día: así, si el fallo fue puntual, un reintento
    // manual o el disparador de respaldo pueden publicar el boletín después.
    props.deleteProperty('ULTIMO_BOLETIN');
    enviarTexto_(cfg, '⚠️ No se pudo obtener el clima esta mañana (la fuente no respondió). ' +
      'Se reintentará más tarde.\nConsulta ' + WEB_URL + ' o los canales de INAMEH.');
    Logger.log('Sin datos de clima tras los reintentos. No se marca el día como enviado.');
    return;
  }

  enviarTexto_(cfg, construirCabecera_(datos));
  Utilities.sleep(PAUSA_MS);

  var omitidas = [];
  for (var i = 0; i < CIUDADES.length; i++) {
    var ciudad = CIUDADES[i];
    var d = datos[i];
    if (!d || !d.current) continue;
    // pri 2: al resumen agrupado, salvo que tenga algo que reportar
    var an = analizar_(d);
    var soloResumen = (ciudad.pri !== 1) || (SOLO_DESTACABLES && an.resumen === 'ok');
    if (soloResumen && an.resumen !== 'alerta') {
      omitidas.push({ e: ciudad.e, n: ciudad.n, t: fmt_(d.current.temperature_2m, '°'),
                      i: iconoWMO_(d.current.weather_code), nivel: an.resumen });
      continue;
    }
    var texto = construirTextoCiudad_(ciudad, d);
    var imagen = null;
    try {
      imagen = generarImagen_(ciudad, d);
    } catch (err) {
      // La imagen es un extra: si falla, el boletín debe salir igual.
      Logger.log('Sin imagen para ' + ciudad.n + ': ' + err);
    }
    if (imagen) enviarFoto_(cfg, imagen, texto);
    else enviarTexto_(cfg, texto);
    Utilities.sleep(PAUSA_MS);
  }
  if (omitidas.length) enviarResumenEstados_(cfg, omitidas);
  Logger.log('Boletín enviado. Fichas: ' + (CIUDADES.length - omitidas.length) +
             ', resumidas: ' + omitidas.length + ' de ' + CIUDADES.length + ' ciudades.');
}

/**
 * Envía un boletín ahora mismo, aunque ya se haya publicado hoy.
 * Es para comprobar cómo queda: la protección anti-duplicados existe para que
 * el disparador no repita, no para impedirte probar.
 */
function probarAhora() {
  reporteDiario(true);
}

/**
 * Borra la marca del día. Útil si quieres que el disparador vuelva a publicar
 * (por ejemplo, tras corregir algo por la mañana).
 */
function reiniciarBoletinDeHoy() {
  PropertiesService.getScriptProperties().deleteProperty('ULTIMO_BOLETIN');
  Logger.log('Marca borrada: el próximo `reporteDiario` publicará de nuevo.');
}

/** Solo la primera ciudad: útil para afinar el diseño sin llenar el canal. */
function probarUnaCiudad() {
  var cfg = leerConfig_();
  var datos = obtenerClimaTodas_();
  if (!datos || !datos[0]) { Logger.log('Sin datos.'); return; }
  var texto = construirTextoCiudad_(CIUDADES[0], datos[0]);
  var img = null;
  try { img = generarImagen_(CIUDADES[0], datos[0]); }
  catch (e) { Logger.log('Sin imagen: ' + e); }
  if (img) enviarFoto_(cfg, img, texto); else enviarTexto_(cfg, texto);
}

// ── Disparador ─────────────────────────────────────────────

/** Programa el boletín a las 6:00 de Venezuela. Idempotente. */
function instalarDisparador() {
  eliminarDisparador();
  ScriptApp.newTrigger('reporteDiario')
    .timeBased()
    .atHour(6)
    .nearMinute(10)     // a las 6:00 en punto se concentran miles de disparadores
                        // de Apps Script sobre las mismas IP de salida de Google,
                        // y Open-Meteo responde 429. Diez minutos después, no.
    .everyDays(1)
    .inTimezone(ZONA)
    .create();
  Logger.log('Disparador instalado: 6:00 ' + ZONA + '. ' +
    'Apps Script puede desviarlo unos minutos; es normal.');
}

/**
 * Segundo intento a las 7:10. Si el de las 6:10 publicó, este no hace nada
 * (la marca del día lo impide); si falló por un 429 puntual, salva el boletín.
 */
function instalarDisparadorRespaldo() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'reporteDiario' &&
        ts[i].getTriggerSourceId && false) { /* no aplica */ }
  }
  ScriptApp.newTrigger('reporteDiario')
    .timeBased().atHour(7).nearMinute(10).everyDays(1).inTimezone(ZONA).create();
  Logger.log('Disparador de respaldo instalado a las 7:10 ' + ZONA + '.');
}

function eliminarDisparador() {
  var ts = ScriptApp.getProjectTriggers();
  for (var i = 0; i < ts.length; i++) {
    if (ts[i].getHandlerFunction() === 'reporteDiario') ScriptApp.deleteTrigger(ts[i]);
  }
}

// ── Datos ──────────────────────────────────────────────────

function leerConfig_() {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('TELEGRAM_BOT_TOKEN');
  var chat = p.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chat) {
    throw new Error('Falta configuración. Añade TELEGRAM_BOT_TOKEN y ' +
      'TELEGRAM_CHAT_ID en Configuración → Propiedades del script.');
  }
  return { token: token, chat: chat };
}

/**
 * Clima de todas las ciudades.
 *
 * POR QUÉ ES MÁS COMPLICADO DE LO QUE PARECE:
 * el disparador se ejecuta a la misma hora que miles de scripts de Apps
 * Script, y todos salen por las IP compartidas de Google. Open-Meteo limita
 * por IP, así que a las 6:00 en punto es fácil recibir un 429 aunque el mismo
 * script funcione perfectamente media hora después a mano. Por eso:
 *   · se parte en lotes: si uno falla, los demás se publican igual;
 *   · se reintenta con espera creciente;
 *   · se registra el código y el cuerpo de la respuesta, porque antes esta
 *     función devolvía null en silencio y no había forma de saber la causa.
 */
var LOTE = 20;              // ciudades por petición
var REINTENTOS = 3;
var ESPERA_BASE_MS = 4000;  // 4 s, 8 s, 16 s

function obtenerClimaTodas_() {
  var resultado = [];
  var fallidos = 0;
  for (var i = 0; i < CIUDADES.length; i += LOTE) {
    var grupo = CIUDADES.slice(i, i + LOTE);
    var datos = pedirLote_(grupo);
    if (datos) {
      resultado = resultado.concat(datos);
    } else {
      fallidos++;
      // hueco del tamaño del lote: así los índices siguen alineados con CIUDADES
      for (var k = 0; k < grupo.length; k++) resultado.push(null);
      Logger.log('Lote ' + (i / LOTE + 1) + ' sin datos (' + grupo[0].n + '…).');
    }
  }
  var conDatos = 0;
  for (var j = 0; j < resultado.length; j++) if (resultado[j] && resultado[j].current) conDatos++;
  Logger.log('Clima obtenido para ' + conDatos + ' de ' + CIUDADES.length + ' ciudades' +
             (fallidos ? ' (' + fallidos + ' lote(s) fallido(s))' : '') + '.');
  // solo se considera fracaso total si no se obtuvo NADA
  return conDatos > 0 ? resultado : null;
}

function pedirLote_(grupo) {
  var lats = [], lons = [];
  for (var i = 0; i < grupo.length; i++) {
    lats.push(grupo[i].lat.toFixed(4));
    lons.push(grupo[i].lon.toFixed(4));
  }
  var url = OM_FORECAST +
    '?latitude=' + lats.join(',') + '&longitude=' + lons.join(',') +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,' +
    'weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,cape,soil_moisture_0_to_1cm' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,' +
    'precipitation_probability_max,uv_index_max' +
    '&forecast_days=3&timezone=' + encodeURIComponent(ZONA);

  for (var intento = 1; intento <= REINTENTOS; intento++) {
    try {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var code = res.getResponseCode();
      if (code === 200) {
        var data = JSON.parse(res.getContentText());
        return Array.isArray(data) ? data : [data];
      }
      // 429 = demasiadas peticiones; 5xx = problema temporal del servidor.
      // Ambos suelen resolverse esperando: merece la pena reintentar.
      Logger.log('Open-Meteo respondió ' + code + ' (intento ' + intento + '/' + REINTENTOS + '): ' +
                 res.getContentText().slice(0, 200));
      if (code !== 429 && code < 500) return null; // error nuestro: reintentar no ayuda
    } catch (err) {
      Logger.log('Fallo de red con Open-Meteo (intento ' + intento + '/' + REINTENTOS + '): ' + err);
    }
    if (intento < REINTENTOS) Utilities.sleep(ESPERA_BASE_MS * Math.pow(2, intento - 1));
  }
  return null;
}

/** Sistemas activos del NHC, solo para la cabecera. Si falla, se omite. */
function obtenerCiclones_() {
  try {
    var res = UrlFetchApp.fetch(NHC_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    return (JSON.parse(res.getContentText()).activeStorms) || [];
  } catch (err) { return null; }
}

// ── Análisis (mismas reglas que la web) ────────────────────

function analizar_(d) {
  var c = d.current || {}, dl = d.daily || {};
  var h = [];
  function add(nivel, texto, dato) { h.push({ nivel: nivel, texto: texto, dato: dato }); }

  var prob0 = arr_(dl.precipitation_probability_max, 0);
  if (prob0 !== null && prob0 >= UMBRALES.lluviaProb) {
    add(prob0 >= 90 ? 'atencion' : 'info', 'Alta probabilidad de lluvia hoy', Math.round(prob0) + '%');
  }
  var seguidos = 0;
  if (dl.precipitation_probability_max) {
    for (var i = 0; i < dl.precipitation_probability_max.length; i++) {
      if (dl.precipitation_probability_max[i] >= UMBRALES.lluviaProb) seguidos++; else break;
    }
  }
  if (seguidos >= 3) add('atencion', 'Lluvia persistente varios días seguidos', seguidos + ' días');

  var acum = 0;
  if (dl.precipitation_sum) {
    for (var j = 0; j < Math.min(3, dl.precipitation_sum.length); j++) {
      if (typeof dl.precipitation_sum[j] === 'number') acum += dl.precipitation_sum[j];
    }
  }
  if (acum >= UMBRALES.lluviaAcum) {
    add(acum >= 60 ? 'alerta' : 'atencion', 'Acumulado de lluvia previsto', Math.round(acum) + ' mm / 3 días');
  }

  var suelo = c.soil_moisture_0_to_1cm;
  if (typeof suelo === 'number' && suelo >= UMBRALES.sueloSaturado) {
    var conLluvia = prob0 !== null && prob0 >= UMBRALES.lluviaProb;
    add(conLluvia ? 'alerta' : 'atencion',
        conLluvia ? 'Suelo saturado con más lluvia prevista — riesgo de deslizamiento'
                  : 'Suelo con humedad alta',
        Math.round(suelo * 100) + '%');
  }

  var raf = c.wind_gusts_10m;
  if (typeof raf === 'number') {
    if (raf >= UMBRALES.rafagaAlerta) add('alerta', 'Ráfagas fuertes — riesgo para estructuras ligeras y árboles', Math.round(raf) + ' km/h');
    else if (raf >= UMBRALES.rafagaAtencion) add('atencion', 'Ráfagas de viento apreciables', Math.round(raf) + ' km/h');
  }
  if (typeof c.cape === 'number' && c.cape >= UMBRALES.capeTormenta) {
    add(c.cape >= 2500 ? 'alerta' : 'atencion', 'Energía atmosférica alta — posibilidad de tormentas', Math.round(c.cape) + ' J/kg');
  }
  if (typeof c.apparent_temperature === 'number' && typeof c.temperature_2m === 'number') {
    var delta = c.apparent_temperature - c.temperature_2m;
    if (delta >= UMBRALES.calorSensacion && c.apparent_temperature >= 32) {
      add(c.apparent_temperature >= 38 ? 'alerta' : 'atencion',
          'Sensación térmica muy por encima de la real',
          Math.round(c.temperature_2m) + '° → ' + Math.round(c.apparent_temperature) + '°');
    }
  }
  var uv = arr_(dl.uv_index_max, 0);
  if (uv !== null && uv >= UMBRALES.uvAlto) add('info', 'Índice ultravioleta alto', 'UV ' + Math.round(uv));

  var nAlerta = 0, nAtencion = 0;
  for (var k = 0; k < h.length; k++) {
    if (h[k].nivel === 'alerta') nAlerta++;
    else if (h[k].nivel === 'atencion') nAtencion++;
  }
  return { hallazgos: h, resumen: nAlerta ? 'alerta' : nAtencion ? 'atencion' : h.length ? 'info' : 'ok' };
}

// ── Texto ──────────────────────────────────────────────────

/**
 * Resumen del resto del país, agrupado por estado. Telegram corta los mensajes
 * en 4096 caracteres, así que se parte en varios si hiciera falta.
 */
function enviarResumenEstados_(cfg, lista) {
  var porEstado = {}, orden = [];
  for (var i = 0; i < lista.length; i++) {
    var x = lista[i];
    if (!porEstado[x.e]) { porEstado[x.e] = []; orden.push(x.e); }
    porEstado[x.e].push(x.i + ' ' + x.n + ' ' + x.t + (x.nivel === 'atencion' ? ' 🟠' : ''));
  }
  var bloques = [], actual = ['🗺️ *Resto del país*', ''];
  var largo = 30;
  for (var j = 0; j < orden.length; j++) {
    var trozo = '*' + orden[j] + '*\n' + porEstado[orden[j]].join(' · ');
    if (largo + trozo.length > 3600) { bloques.push(actual.join('\n')); actual = []; largo = 0; }
    actual.push(trozo, '');
    largo += trozo.length + 2;
  }
  actual.push(pie_());
  bloques.push(actual.join('\n'));
  for (var k = 0; k < bloques.length; k++) {
    enviarTexto_(cfg, bloques[k]);
    Utilities.sleep(PAUSA_MS);
  }
}

function construirCabecera_(datos) {
  var l = ['*CICLÓN·MONITOR* — boletín de las 6:00', fechaLarga_(), ''];
  var storms = obtenerCiclones_();
  if (storms === null) {
    l.push('_No se pudo consultar el NHC esta mañana._');
  } else if (!storms.length) {
    l.push('✅ Sin ciclones tropicales activos reportados por el NHC.');
  } else {
    l.push('*' + storms.length + ' sistema(s) activo(s)* según el NHC:');
    for (var i = 0; i < storms.length; i++) {
      l.push('• ' + (storms[i].name || '—') + ' — ' + tipoCiclon_(storms[i].classification));
    }
    l.push('Detalle y trayectoria: ' + WEB_URL);
  }
  // aviso general si alguna ciudad amanece en alerta
  var enAlerta = [];
  for (var j = 0; j < CIUDADES.length; j++) {
    if (!datos[j] || !datos[j].current) continue;
    if (analizar_(datos[j]).resumen === 'alerta') enAlerta.push(CIUDADES[j].n);
  }
  if (enAlerta.length) {
    l.push('', '🔴 *Condiciones que requieren atención en:* ' + enAlerta.join(', '));
  }
  l.push('', pie_());
  return l.join('\n');
}

function construirTextoCiudad_(ciudad, d) {
  var c = d.current || {}, dl = d.daily || {};
  var an = analizar_(d);
  var l = [];
  l.push(iconoWMO_(c.weather_code) + ' *' + ciudad.n.toUpperCase() + '*');
  l.push(descWMO_(c.weather_code) + ' · *' + fmt_(c.temperature_2m, '°C') + '*' +
         (typeof c.apparent_temperature === 'number' ? ' (sensación ' + Math.round(c.apparent_temperature) + '°)' : ''));

  var max = arr_(dl.temperature_2m_max, 0), min = arr_(dl.temperature_2m_min, 0);
  var pr = arr_(dl.precipitation_probability_max, 0);
  if (max !== null) {
    l.push('Hoy: ' + Math.round(max) + '° / ' + Math.round(min) + '°' +
           (pr !== null ? ' · lluvia ' + Math.round(pr) + '%' : ''));
  }
  l.push('Viento ' + fmt_(c.wind_speed_10m, ' km/h') +
         ' · ráfagas ' + fmt_(c.wind_gusts_10m, ' km/h') +
         ' · humedad ' + fmt_(c.relative_humidity_2m, '%'));

  if (an.hallazgos.length) {
    l.push('');
    l.push(nivelIcono_(an.resumen) + ' *' + tituloResumen_(an.resumen) + '*');
    // Telegram corta el pie de foto en 1024 caracteres. Con muchos hallazgos se
    // rozaría el límite y lo primero en perderse sería el aviso de no-oficial,
    // que va al final. Se priorizan los más graves y se indica cuántos quedan.
    var orden = { alerta: 0, atencion: 1, info: 2 };
    var lista = an.hallazgos.slice().sort(function(a, b) { return orden[a.nivel] - orden[b.nivel]; });
    var MAX = 5;
    for (var i = 0; i < Math.min(lista.length, MAX); i++) {
      var x = lista[i];
      l.push(nivelIcono_(x.nivel) + ' ' + x.texto + ' — *' + x.dato + '*');
    }
    if (lista.length > MAX) {
      l.push('_… y ' + (lista.length - MAX) + ' indicador(es) más en la aplicación._');
    }
  } else {
    l.push('', '🔵 Sin condiciones destacables.');
  }
  l.push('', pie_());
  return l.join('\n');
}

function pie_() {
  return '_Fuente: Open-Meteo · ' + horaLocalYUtc_() + '_\n' +
         '_ℹ️ Información de referencia, NO es un aviso oficial. Sigue siempre a Protección Civil e INAMEH._\n' +
         WEB_URL;
}

// ── Imagen (Google Slides → PNG) ───────────────────────────

/**
 * Compone la ficha en una diapositiva cuadrada y la exporta a PNG.
 * Se reutiliza SIEMPRE la misma presentación (su id queda guardado en
 * las propiedades del script): crear una nueva cada día llenaría el
 * Drive de archivos y consumiría cuota sin motivo.
 */
function generarImagen_(ciudad, d) {
  var pres = obtenerPresentacion_();
  var slide = pres.getSlides()[0];

  // dejar la diapositiva vacía antes de componer
  var elems = slide.getPageElements();
  for (var i = 0; i < elems.length; i++) elems[i].remove();
  slide.getBackground().setSolidFill(COLORES.fondo);

  var c = d.current || {}, dl = d.daily || {};
  var an = analizar_(d);
  var W = 540; // puntos: la presentación se crea cuadrada de 540×540

  txt_(slide, 'CICLÓN·MONITOR', 40, 30, W - 80, 30, 16, COLORES.acento, true);
  txt_(slide, ciudad.n.toUpperCase(), 40, 62, W - 80, 50, 34, COLORES.texto, true);

  txt_(slide, iconoWMO_(c.weather_code), 40, 120, 90, 80, 48, COLORES.texto, false);
  txt_(slide, fmt_(c.temperature_2m, '°'), 130, 118, 240, 80, 60, COLORES.texto, true);
  txt_(slide, descWMO_(c.weather_code), 40, 205, W - 80, 26, 14, COLORES.tenue, false);

  var max = arr_(dl.temperature_2m_max, 0), min = arr_(dl.temperature_2m_min, 0);
  var pr = arr_(dl.precipitation_probability_max, 0);
  var linea2 = 'Hoy ' + (max !== null ? Math.round(max) + '° / ' + Math.round(min) + '°' : '—') +
               (pr !== null ? '   ·   Lluvia ' + Math.round(pr) + '%' : '') +
               '   ·   Viento ' + fmt_(c.wind_speed_10m, ' km/h');
  txt_(slide, linea2, 40, 232, W - 80, 26, 12, COLORES.tenue, false);

  var y = 272;
  if (an.hallazgos.length) {
    txt_(slide, tituloResumen_(an.resumen).toUpperCase(), 40, y, W - 80, 22, 12,
         an.resumen === 'alerta' ? COLORES.peligro : an.resumen === 'atencion' ? COLORES.acento : COLORES.frio, true);
    y += 26;
    var n = Math.min(an.hallazgos.length, 4);
    for (var k = 0; k < n; k++) {
      var x = an.hallazgos[k];
      var col = x.nivel === 'alerta' ? COLORES.peligro : x.nivel === 'atencion' ? COLORES.acento : COLORES.tenue;
      txt_(slide, '• ' + x.texto, 40, y, W - 190, 34, 11, COLORES.texto, false);
      txt_(slide, x.dato, W - 150, y, 110, 20, 11, col, true, true);
      y += 36;
    }
  } else {
    txt_(slide, 'Sin condiciones destacables.', 40, y, W - 80, 24, 12, COLORES.tenue, false);
  }

  txt_(slide, horaLocalYUtc_() + '  ·  Fuente: Open-Meteo', 40, W - 78, W - 80, 20, 10, COLORES.tenue, false);
  txt_(slide, 'Información de referencia, NO es un aviso oficial.\nSigue siempre a Protección Civil e INAMEH.',
       40, W - 58, W - 80, 40, 9, COLORES.tenue, false);

  pres.saveAndClose();
  return exportarPng_(pres.getId(), slide.getObjectId(), ciudad.n);
}

/** Caja de texto con estilo. `derecha` alinea a la derecha. */
function txt_(slide, texto, left, top, width, height, tam, color, negrita, derecha) {
  var caja = slide.insertTextBox(String(texto), left, top, width, height);
  var t = caja.getText();
  var st = t.getTextStyle();
  st.setFontSize(tam).setForegroundColor(color).setBold(!!negrita);
  try { st.setFontFamily('Roboto Mono'); } catch (e) { /* si no está, se usa la de por defecto */ }
  if (derecha) {
    var ps = t.getParagraphs();
    for (var i = 0; i < ps.length; i++) {
      ps[i].getRange().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
    }
  }
  return caja;
}

/** Presentación reutilizable de 540×540 pt (cuadrada, como la web). */
function obtenerPresentacion_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SLIDES_ID');
  if (id) {
    try { return SlidesApp.openById(id); }
    catch (e) { /* borrada o sin acceso: se crea otra */ }
  }
  var res = UrlFetchApp.fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({
      title: 'CICLÓN·MONITOR — plantilla de fichas (no borrar)',
      pageSize: {
        width:  { magnitude: 540, unit: 'PT' },
        height: { magnitude: 540, unit: 'PT' }
      }
    }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('No se pudo crear la presentación: ' + res.getContentText().slice(0, 200));
  }
  var nuevo = JSON.parse(res.getContentText()).presentationId;
  props.setProperty('SLIDES_ID', nuevo);
  return SlidesApp.openById(nuevo);
}

/** Exporta la diapositiva como PNG y devuelve el blob. */
function exportarPng_(presId, pageId, nombre) {
  var url = 'https://slides.googleapis.com/v1/presentations/' + presId +
            '/pages/' + pageId + '/thumbnail' +
            '?thumbnailProperties.thumbnailSize=LARGE' +
            '&thumbnailProperties.mimeType=PNG';
  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Miniatura no disponible (¿falta activar la API de Slides?): ' +
                    res.getContentText().slice(0, 200));
  }
  var contentUrl = JSON.parse(res.getContentText()).contentUrl;
  var blob = UrlFetchApp.fetch(contentUrl).getBlob();
  return blob.setName('ciclon-monitor-' + normalizar_(nombre) + '.png');
}

// ── Telegram ───────────────────────────────────────────────

function enviarTexto_(cfg, texto) {
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', {
    method: 'post',
    payload: {
      chat_id: cfg.chat,
      text: texto,
      parse_mode: 'Markdown',
      disable_web_page_preview: 'true'
    },
    muteHttpExceptions: true
  });
  revisarRespuesta_(res, 'sendMessage');
}

function enviarFoto_(cfg, blob, pie) {
  // Telegram limita el pie de foto a 1024 caracteres. Si hubiera que recortar,
  // se recorta por el MEDIO: el encabezado identifica la ciudad y el final
  // lleva la fuente y el aviso de no-oficial, que no pueden perderse.
  var caption = pie;
  if (caption.length > 1024) {
    var cola = pie.slice(-260);                    // fuente + aviso + enlace
    caption = pie.slice(0, 1024 - cola.length - 8) + '\n…\n' + cola;
  }
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendPhoto', {
    method: 'post',
    payload: {
      chat_id: cfg.chat,
      photo: blob,
      caption: caption,
      parse_mode: 'Markdown'
    },
    muteHttpExceptions: true
  });
  // si la foto falla, al menos que salga el texto
  if (res.getResponseCode() !== 200) {
    Logger.log('sendPhoto falló: ' + res.getContentText().slice(0, 200));
    enviarTexto_(cfg, pie);
  }
}

function revisarRespuesta_(res, que) {
  if (res.getResponseCode() !== 200) {
    Logger.log(que + ' falló (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
  }
}

// ── Utilidades ─────────────────────────────────────────────

function arr_(a, i) {
  if (!a || typeof a[i] !== 'number' || !isFinite(a[i])) return null;
  return a[i];
}
/** Solo formatea si de verdad es un número: evita imprimir NaN o ceros inventados. */
function fmt_(v, sufijo) {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  return Math.round(v) + (sufijo || '');
}
function nivelIcono_(n) {
  return n === 'alerta' ? '🔴' : n === 'atencion' ? '🟠' : n === 'ok' ? '🟢' : '🔵';
}
function tituloResumen_(n) {
  if (n === 'alerta') return 'Requiere atención inmediata';
  if (n === 'atencion') return 'Condiciones a vigilar';
  if (n === 'info') return 'Detalles a considerar';
  return 'Sin condiciones destacables';
}
function tipoCiclon_(k) {
  var m = {
    TD: 'depresión tropical', STD: 'depresión subtropical', TS: 'tormenta tropical',
    STS: 'tormenta subtropical', HU: 'huracán', TY: 'tifón',
    PTC: 'ciclón post-tropical', PC: 'ciclón tropical potencial'
  };
  return m[k] || (k || '—');
}
function iconoWMO_(c) {
  if (c === 0 || c === 1) return '☀️';
  if (c === 2) return '⛅';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if (c >= 95) return '⛈️';
  if (c >= 71 && c <= 86) return '🌨️';
  if (c >= 51 && c <= 67) return '🌧️';
  if (c >= 80) return '🌦️';
  return '🌡️';
}
function descWMO_(c) {
  var m = {
    0: 'Cielo despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Neblina', 48: 'Neblina helada', 51: 'Llovizna ligera', 53: 'Llovizna moderada',
    55: 'Llovizna densa', 61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
    71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve fuerte',
    80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
    95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte'
  };
  return m[c] || 'Condición no especificada';
}
function fechaLarga_() {
  return Utilities.formatDate(new Date(), ZONA, "EEEE d 'de' MMMM 'de' yyyy");
}
/** Hora local y UTC: los avisos oficiales se emiten en Zulu. */
function horaLocalYUtc_() {
  var ahora = new Date();
  return Utilities.formatDate(ahora, ZONA, 'dd/MM HH:mm') + ' · ' +
         Utilities.formatDate(ahora, 'UTC', 'HH:mm') + 'Z';
}
function normalizar_(s) {
  return String(s).toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
