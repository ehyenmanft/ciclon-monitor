# CICLÓN·MONITOR

**Monitoreo de ciclones tropicales y huracanes en tiempo real** — mapa con sistemas activos, trayectoria y cono de incertidumbre, ficha por sistema, capa experimental de IA (WeatherNext) y foco en Venezuela y el Caribe.

> Plataforma hermana de [SISMO·MONITOR](https://github.com/ehyenmanft/monitor-sismico), nacida de la misma filosofía: gratuita, en español, y con la información de riesgo natural que ninguna app internacional muestra para Venezuela.

---

## ✨ Características (versión actual)

### Modo Ciclones
- **Categorización completa**: cada sistema muestra su clasificación exacta —«Huracán categoría 3», «Depresión tropical»— con la escala Saffir-Simpson aplicada sobre el viento máximo sostenido, y una descripción del **daño esperado en lenguaje llano** («daño devastador: agua y electricidad no disponibles por días o semanas»). Para una depresión tropical se aclara lo que suele ignorarse: el riesgo principal es la lluvia acumulada, no el viento.
- **Perturbaciones en vigilancia** ✕: las áreas que el NHC observa por su posibilidad de convertirse en ciclón, con probabilidad de formación a 2 y 7 días y su región de posible desarrollo. `CurrentStorms.json` solo lista sistemas ya formados; estas perturbaciones vienen del servicio `NHC_tropical_weather_summary` (ids de capa confirmados contra la definición oficial del servicio). Para Protección Civil son justamente lo que da margen de preparación: cuando el sistema ya es depresión, se perdieron varios días de aviso.
- Colores según la convención oficial del NHC: amarillo probabilidad baja, naranja media, rojo alta.
- **Mapa oscuro** (Leaflet + teselas CARTO): sistemas activos con color por categoría Saffir-Simpson.
- **Trayectoria y cono oficiales del NHC**: trayecto recorrido, pronóstico y cono de incertidumbre reales, vía el GIS oficial de NOAA (ArcGIS REST) — no una aproximación.
- **Watch/Warning oficiales**: tramos de costa bajo aviso o alerta de tormenta tropical/huracán, coloreados por tipo.
- **Alerta destacada Venezuela**: banner permanente en la parte superior si algún sistema activo pone a Venezuela bajo watch/warning oficial o llegada probable de vientos de tormenta — con enlaces directos al NHC y a Protección Civil Venezuela.
- **Ficha por sistema**: categoría, vientos máximos, presión central, movimiento, hora de última actualización, enlace directo al aviso oficial del NHC.
- **Parseo defensivo**: valida los campos del JSON de NHC por contenido (rango numérico + pista en el nombre), no por nombre exacto de campo — para sobrevivir a cambios de formato sin aviso.
- **Capa experimental WeatherNext** (Google DeepMind, vía Open-Meteo): dispersión del ensamble de 64 miembros de viento/presión en el punto del sistema. Etiquetada explícitamente como experimental — nunca se usa como fuente de la posición del ciclón.
- **Modo demo**: sistema de ejemplo, claramente etiquetado, para probar la interfaz cuando no hay ciclones activos reales.

### Compartir en redes sociales 📤
Genera un mensaje listo para WhatsApp, Telegram, X, Facebook o correo con lo que se esté viendo: la ficha del ciclón seleccionado, el clima y análisis de una ciudad, o un resumen general. En móvil usa el selector nativo del sistema (un toque, cualquier app instalada); en escritorio ofrece los enlaces por red. El texto es editable antes de enviarlo.

También genera una **tarjeta de imagen PNG** (1080×1080, sin marco) con los datos del sitio o del ciclón seleccionado, sus indicadores de riesgo, la hora y la fuente. Se previsualiza antes de enviar y se comparte como archivo por el selector nativo del sistema, o se descarga si el navegador no lo permite.

No es una captura del mapa a propósito: sus teselas vienen de servidores externos y el navegador bloquea la exportación de un lienzo que las contenga, así que una captura fallaría de forma intermitente justo con el radar y el satélite. La tarjeta se dibuja con formas propias —incluidos los símbolos de condición meteorológica, porque en canvas no siempre hay fuente de emoji disponible— y por eso funciona siempre.

**Cada mensaje incluye siempre**, no como opción: la fuente del dato, la hora en local y UTC, el aviso de que no sustituye a los avisos oficiales, y un enlace de vuelta a la vista exacta. El motivo es concreto: un mensaje reenviado viaja sin el mapa, sin las fuentes y sin los avisos, así que todo lo que le da contexto tiene que ir dentro del propio texto.

Si el modo simulacro está activo, el mensaje se encabeza en mayúsculas con «ESTO ES UN EJERCICIO. LOS DATOS NO SON REALES. NO DIFUNDIR COMO INFORMACIÓN VERDADERA» — un ejercicio reenviado sin marcar podría provocar pánico real.

### Modo simulacro 🎓
Ejercicio de entrenamiento con tres escenarios: sistema lejano en vigilancia, huracán al norte de Venezuela, y huracán mayor con dos sistemas simultáneos y Venezuela en zona de aviso.

**Por qué existe:** el módulo de ciclones sólo se ejercita cuando hay un ciclón. Sin esto, toda su cadena —parseo, trayectoria, cono, cruce con territorio venezolano, banner de alerta, notificaciones, reporte— se estrenaría durante una emergencia real, que es el peor momento para descubrir un fallo. También permite entrenar a un equipo sin esperar a que haya un huracán.

**Los escenarios son sintéticos**, construidos sobre la climatología real de la región (los sistemas entran por el este entre 10–15°N desplazándose al oeste-noroeste). **No reconstruyen ningún huracán histórico concreto**: inventar coordenadas y presentarlas como datos históricos reales sería exactamente el tipo de dato falso que esta plataforma no admite.

Salvaguardas para que un ejercicio nunca se confunda con la realidad:
- Banner con rayado diagonal permanente: «SIMULACRO EN CURSO — DATOS FICTICIOS», anunciado también a lectores de pantalla.
- Borde morado alrededor de toda la ventana y sufijo «· SIMULACRO» en el título.
- Cada sistema lleva `[SIMULACRO]` en el nombre y su ficha sale marcada.
- El reporte impreso se emite con una cabecera de aviso: un PDF de ejercicio circulando sin marcar sería indistinguible de uno real.
- **No persiste**: al recargar la página se apaga solo.
- Los datos reales no pisan el ejercicio, y al salir se restauran automáticamente.
- Los sistemas ficticios no consultan el GIS real de NOAA.

### Análisis de condiciones (sin IA, deliberadamente)
En la ficha de cada ubicación aparece un resumen que cruza los datos ya obtenidos y señala lo que merece atención — por ejemplo, *"suelo saturado con más lluvia prevista → riesgo de deslizamiento (45%)"*, que combina humedad del suelo y probabilidad de precipitación.

**Es determinista, no un modelo de lenguaje.** Cada línea muestra al lado el dato que la respalda, así que se puede verificar de un vistazo de dónde sale la afirmación. Esta decisión es deliberada: un LLM podría inventar un pronóstico, y en una herramienta que informa sobre riesgo para la vida eso es inaceptable. Además funciona sin conexión, sin cuota y sin costo.

No pronostica: solo describe y relaciona lo que las fuentes ya dijeron. Los pronósticos y avisos siguen siendo del NHC, INAMEH y Protección Civil. Hay un botón para copiar el análisis en texto, útil para minutas de situación.

Los umbrales están todos agrupados en la constante `UMBRALES` dentro de `index.html`, para poder ajustarlos en un solo sitio. `test.js` los ejecuta contra siete escenarios simulados, así que un cambio accidental de umbral se detecta antes de subirlo.

### Clima por ciudad sobre el mapa
- **Capa Ciudades** (🏙️, activa por defecto): icono de la condición actual (☀️ ⛅ 🌧️ ⛈️) y temperatura sobre cada ciudad — 28 de Venezuela (una por estado más las principales) y 20 del Caribe insular y costas cercanas.
- Al tocar una ciudad: condición descrita, máxima/mínima de hoy, **pronóstico de mañana** y acceso a su ficha completa.
- **Coste: una sola petición de red para todas las ciudades.** Open-Meteo acepta listas de coordenadas (hasta 1000 puntos) y devuelve un array, así que el mapa completo cuesta una llamada, no una por ciudad. Con caché de 10 min y filtrado por zoom y por área visible.

### Modo Clima
- **Búsqueda global** (geocoding Open-Meteo) + **geolocalización del navegador** + acceso rápido a 9 ciudades de Venezuela.
- **Condiciones actuales**: temperatura, sensación térmica, humedad, viento, ráfagas, presión, nubosidad, precipitación.
- **Próximas 24 horas** y **pronóstico de 7 días**, más **calidad del aire** (AQI europeo/EE.UU.).

### Enlace con SISMO·MONITOR
- **Capa sísmica** (🌋): sismos de las últimas 24 h dimensionados y coloreados por magnitud, más los **límites de placas tectónicas** (modelo PB2002, Bird 2003) recortados a la región Caribe/Atlántico.
- **Tres fuentes con validación cruzada**, igual que SISMO·MONITOR: **FUNVISIS** (red nacional de Venezuela), **USGS** y **EMSC**. Se fusionan descartando duplicados (mismo evento a menos de 10 min y 0.5°), con prioridad FUNVISIS > USGS > EMSC, porque ante un mismo sismo la red local es la más precisa. Usar solo USGS perdería los sismos locales pequeños que solo FUNVISIS detecta.
- Si una red no responde, se indica **cuál** falló y se sigue con las demás. El popup muestra de qué red vino cada evento.
- FUNVISIS se parsea **por contenido, no por nombre de campo** (ha llegado a servir la magnitud en un campo llamado `phone`).
- Al tocar un sismo se abre su ficha con profundidad, hora local y UTC, y enlaces al detalle en USGS y a [SISMO·MONITOR](https://ehyenmanft.github.io/monitor-sismico/), la plataforma hermana con el análisis completo (globo 3D, histórico, replay y FUNVISIS para Venezuela).
- Por qué tiene sentido: un ciclón y un sismo comparten las mismas cuadrillas de respuesta y la misma población expuesta. Se reusan las fuentes ya probadas en producción en SISMO·MONITOR, no fuentes nuevas.

### Herramientas para equipos de monitoreo / Protección Civil
- **Leyenda explicada** (❓): modal con todos los colores y símbolos del mapa traducidos a lenguaje simple — categorías de sistema, líneas de trayectoria, tipos de aviso costero, intensidad de radar, escala de viento. Pensado para alguien sin formación meteorológica.
- **Compartir ubicación** (📍): toma tu GPS (o el centro del mapa si no hay permiso) y genera un enlace a Google Maps + mensaje de WhatsApp listo para enviar — para reportar una posición exacta en campo sin dictar coordenadas por radio.
- **Escala de distancia y lector de coordenadas** en el mapa.
- **Notificaciones del navegador** (🔔): aviso con sonido cuando aparece un sistema nuevo o Venezuela entra en zona de watch/warning — pensado para un panel desatendido en sala de situación.
- **Reporte de situación** (🖨️): resumen imprimible de todos los sistemas activos + estado de alerta, en un clic.
- **Persistencia local**: si la página se recarga durante un corte de conexión, muestra el último dato confirmado guardado en el navegador (con su hora real) en vez de una pantalla vacía.
- **Capa de viento y nubosidad**: muestreo de 16 puntos con Open-Meteo sobre el área visible — flechas de viento rotadas por dirección/velocidad, nubosidad como sombreado translúcido. Colapsable en un solo panel de "Capas del mapa".
- **Convergencia aproximada**: cuando la capa de viento está activa, resalta zonas donde el viento converge entre puntos vecinos de la rejilla (asociado a mayor probabilidad de lluvia). Etiquetado explícitamente como estimación gruesa, no un análisis sinóptico oficial ni una zona de convergencia intertropical real.
- **Radar en tiempo real** ([RainViewer](https://www.rainviewer.com)) con leyenda de intensidad.
- **Vista satelital dual**: diaria (NASA VIIRS, confiable, ~24h de latencia) o casi en vivo (NOAA/NASA GOES-East GeoColor, ~10-15 min — experimental, el ajuste técnico exacto de esta capa no se pudo confirmar en desarrollo).

### General
- **Vista principal: Clima** por defecto, con Caracas precargada.
- **Honestidad de fuente**: si una fuente no responde, se muestra un aviso explícito con la hora del último dato confirmado — nunca datos viejos como si fueran actuales.
- **Bilingüe** español/inglés. **Responsive auditado**: paneles, controles táctiles (≥38-40px) y áreas seguras (`safe-area-inset`) ajustados a tamaños reales de pantalla móvil. **PWA instalable**.

## 🔌 Fuentes de datos

| Fuente | Cobertura | Acceso |
|---|---|---|
| [NHC/NOAA](https://www.nhc.noaa.gov) — `CurrentStorms.json` | Atlántico, Pacífico oriental y central | JSON público, sin clave |
| [Google WeatherNext 2](https://open-meteo.com/en/docs/google-weathernext-api) vía Open-Meteo | Global, capa experimental | JSON público, sin clave |
| [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Global, clima general | JSON público, sin clave |
| [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Global, búsqueda de ciudades | JSON público, sin clave |
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Global, calidad del aire | JSON público, sin clave |
| [RainViewer](https://www.rainviewer.com/api.html) | Global, radar de precipitación (últimas 2h) | JSON + teselas públicas, sin clave |
| [NASA EOSDIS GIBS](https://nasa-gibs.github.io/gibs-api-docs/) — VIIRS true color | Global, imagen satelital diaria | Teselas WMTS públicas, sin clave |
| [NOAA GIS (ArcGIS REST)](https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer) | Trayectoria, cono y puntos pronosticados reales | GeoJSON público, sin clave |
| [USGS](https://earthquake.usgs.gov) — `all_day.geojson` | Global, sismos últimas 24 h | JSON público, sin clave |
| [EMSC](https://www.seismicportal.eu) | Europa-Mediterráneo y Caribe, sismos | JSON público, sin clave |
| FUNVISIS (Venezuela) | Red nacional venezolana | Vía el mismo proxy de Apps Script de SISMO·MONITOR, con espejo público de respaldo |
| PB2002 (Bird 2003) | Límites de placas tectónicas | Datos estáticos incluidos en el archivo |
| INAMEH (Venezuela) | — | Sin API pública — se enlaza directo a sus canales oficiales |

### El problema CORS de NHC (posible, sin confirmar aún)

`www.nhc.noaa.gov` es el sitio web del NHC, no una API dedicada como `api.weather.gov` — no está confirmado que envíe cabecera CORS para lectura directa desde el navegador. Si `index.html` reporta error de red en consola al leer `CurrentStorms.json`:

- **`nhc-proxy.gs`** — mismo patrón que `funvisis-proxy.gs` de SISMO·MONITOR: Google Apps Script que lee la fuente oficial, la cachea 3 minutos y la sirve sin problema de CORS.

## Sobre WeatherNext (Google DeepMind)

WeatherNext Cyclones se liberó como código abierto el 6 de agosto de 2026 (Apache 2.0, junto a un artículo en *Nature*). Es tentador querer sus trayectorias de ciclón aquí, así que conviene dejar claro **qué se puede y qué no** con infraestructura gratuita:

| Vía de acceso | ¿Da trayectorias de ciclón? | ¿Usable en esta plataforma? |
|---|---|---|
| **Open-Meteo** (`ensemble-api`) | No — campos atmosféricos de rejilla en un punto | ✅ **Sí, es lo que usamos.** Sin clave, desde el navegador |
| **Weather Lab** | Sí | ❌ Es un sitio interactivo, no una API. Se enlaza desde la ficha |
| **Google Cloud** (Earth Engine / BigQuery / Vertex AI) | Sí | ❌ Requiere cuenta con facturación |
| **Ejecutar el modelo** (GitHub) | Sí | ⚠️ Ver abajo |

### Lo que sí muestra la plataforma

En la ficha de cada sistema activo se consulta el ensamble de WeatherNext en el punto donde el NHC sitúa el centro, y se muestra **la dispersión entre miembros a lo largo del tiempo** (ahora, +24 h, +48 h, +72 h, +120 h). Una barra ancha significa que los miembros del ensamble no se ponen de acuerdo, es decir, más incertidumbre. También se muestra la tendencia de la presión media, que es el indicador más directo de intensificación.

Esto **no es** la trayectoria del ciclón: es contexto probabilístico en un punto que ya conocemos por la fuente oficial. La posición y el cono siempre vienen del NHC.

### Ejecutar el modelo manualmente (opcional, no automático)

`WeatherNext 2-mini` está diseñado para correr en un notebook de Google Colab gratuito, con el objetivo declarado de bajar la barrera de entrada para servicios meteorológicos de países con pocos recursos, incluido el Caribe. El código y los pesos están en [google-deepmind/weathernext](https://github.com/google-deepmind/weathernext).

**Contrapartida honesta:** Colab gratuito no es un servidor. Se desconecta solo, no corre desatendido y no puede programarse para actualizar cada 6 horas sin que alguien abra el navegador. Sirve como **herramienta de análisis manual** durante un evento concreto — nunca como fuente automática de una plataforma que debe estar viva a las 3 de la madrugada durante un huracán.

## 🏗 Arquitectura

```
Navegador (index.html — archivo único, sin build)
 ├── NHC ──────── directo (CurrentStorms.json) ── o vía proxy Apps Script si CORS falla
 └── WeatherNext ─ directo (Open-Meteo, sin clave) — capa experimental en el punto del sistema
```

Todo corre en infraestructura gratuita: GitHub Pages + (opcionalmente) Google Apps Script. Sin servidores, sin claves de API, sin costos.

## 🧪 Verificación

```bash
node test.js    # 121 comprobaciones estructurales: reglas del proyecto
node audit.js   # auditoría estática: código muerto, ids huérfanos, listeners duplicados
node e2e.js     #  47 comprobaciones EJECUTANDO la página en un navegador simulado
```

Las tres son complementarias. `test.js` y `audit.js` analizan el código sin ejecutarlo; `e2e.js` carga `index.html` en jsdom con Leaflet y la red sustituidos por dobles, y ejercita los flujos reales: arranque, carga de datos, pulsación de todos los botones, simulacro, fuentes caídas, datos degenerados, sin ciclones activos, vista compartida por URL y recorrido en inglés.

Instalar las herramientas (solo para desarrollo — la aplicación no usa npm ni compilación):

```bash
npm install
```

`e2e.js` ya ha encontrado fallos que el análisis estático no podía ver: campos nulos que llegaban a pantalla como «Sensación NaN°C».

Lo que **no** cubre: apariencia, CORS real, gestos táctiles y rendimiento. Eso sigue necesitando un navegador de verdad.

44 comprobaciones sin dependencias: sintaxis de todos los archivos, ids usados vs. definidos, etiquetas balanceadas, paridad de traducciones ES/EN, dominios de datos excluidos del caché del service worker, accesibilidad (aria-labels, severidad no dependiente solo del color) y los requisitos de honestidad del proyecto (avisos de "experimental", enlaces a fuentes oficiales, etiquetado del modo demo).

Ejecútalo antes de cada `git push`. Ya ha cazado errores reales: claves de traducción usadas pero nunca definidas, y espejos de Overpass que se estaban cacheando cuando no debían.

## 📢 Canal de Telegram

La web enlaza al canal desde tres sitios: un botón en la barra superior (que llama la atención las primeras visitas y luego se calma), una tarjeta explicativa en el panel de ciclones y otra al pie de la ficha de clima. El icono es un SVG propio, sin depender de recursos externos.

`telegram-boletin.gs` publica cada mañana a las **6:00 (hora de Venezuela)** un boletín en un canal de Telegram: primero una cabecera con los ciclones activos según el NHC y qué ciudades amanecen con condiciones de atención, y después una ficha por ciudad —imagen + texto— con su condición, pronóstico e indicadores de riesgo. Cubre **70 ciudades** en las 23 entidades federales más el Distrito Capital, incluidas las 23 capitales de estado. El listado va organizado con una sección por entidad, en orden alfabético; La Guaira figura como estado propio y no como parte de Caracas: la separa la cordillera, su clima costero es marcadamente distinto y es la zona del deslave de 1999 y del terremoto de 2026.

Para que el canal siga siendo legible, cada ciudad lleva una prioridad: 28 reciben ficha completa cada mañana y el resto entra en un resumen agrupado por estado. **Una ciudad en alerta recibe siempre ficha completa, sea cual sea su prioridad.**

Se instala en Apps Script; las instrucciones paso a paso están en la cabecera del propio archivo. El token del bot va en las propiedades del script, nunca en el código.

**Sobre la imagen:** Apps Script no tiene canvas, así que la ficha no se puede dibujar como en la web. Se compone en una diapositiva de Google Slides y se exporta a PNG mediante la API de miniaturas — la única vía dentro de la cuenta gratuita. Si esa generación falla por lo que sea, **el boletín se publica igualmente en texto**: un canal de riesgo que se calla porque no pudo renderizar una imagen sería un fallo peor que uno feo.

Otras decisiones: el clima de las 16 ciudades se pide en una sola llamada; no se repite el boletín si Apps Script reintenta el disparador; los indicadores más graves van primero y, si hubiera que recortar por el límite de 1024 caracteres de Telegram, el recorte va por el medio para que nunca se pierdan la fuente ni el aviso de que no es un aviso oficial. Si el canal se vuelve ruidoso, `SOLO_DESTACABLES = true` publica ficha solo de las ciudades con algo que reportar.

## 🔌 Configuración de proxy

Las URLs de los proxys de Apps Script se configuran desde el panel **🩺 Diagnóstico**, no editando el código. Se guardan en el navegador y **sobreviven a las actualizaciones de `index.html`**, así que actualizar la aplicación ya no borra la configuración.

Las constantes `NHC_PROXY` y `GIS_PROXY` del código siguen funcionando como valor por defecto para un despliegue nuevo.

## ⚙️ Ajustes del usuario

- **Tema claro / oscuro** (☀️/🌙): el tema oscuro es ideal en sala de situación pero casi ilegible bajo el sol; el claro es de alto contraste, para uso en campo.
- **Unidades de viento**: km/h, nudos o mph. Los boletines del NHC usan nudos; el público en Venezuela piensa en km/h.
- **Modo bajo consumo**: reduce la rejilla de muestreo y alarga los intervalos de refresco. Pensado para datos móviles caros.
- **Hora local y UTC** simultáneas, porque los avisos oficiales se emiten en Zulu.
- **Enlace de vista** (🔗): copia una URL que reproduce exactamente el mapa actual (posición, zoom, capas y modo) para enviarla por WhatsApp.
- **Modo kiosko** (📺 o Ctrl+K): pantalla completa sin controles, rotando entre sistemas activos. Escape para salir.
- **Diagnóstico** (🩺): prueba cada fuente desde tu navegador y dice cuál falla y por qué, en vez de fallar en silencio.

## 🚀 Despliegue propio

1. Haz fork o descarga este repositorio.
2. Activa GitHub Pages: Settings → Pages → Deploy from branch → `main`.
3. *(Opcional, solo si confirmas error de CORS en consola)* Crea un proyecto en [script.google.com](https://script.google.com), pega `nhc-proxy.gs`, implementa como aplicación web ("Ejecutar como: yo" / "Acceso: cualquier usuario") y pega la URL `/exec` en la constante `NHC_PROXY` de `index.html`.
4. En cuanto haya un ciclón activo real, abre la ficha del sistema → "Ver JSON crudo" para confirmar los nombres de campo exactos del NHC y ajustar `normalizeStorm()` si hace falta.

Al actualizar `index.html`, incrementa `VERSION` en `sw.js` para que las instalaciones PWA se renueven.

## ⚠️ Estado del proyecto

Primera versión funcional (MVP). Pendiente de validar en vivo: comportamiento real de CORS, esquema exacto del JSON de NHC con un sistema activo, y pruebas en dispositivos móviles reales. Ver [issues](../../issues) para el resto de la hoja de ruta.

## 🗺 Hoja de ruta

- [ ] Confirmar CORS directo a NHC y al GIS de NOAA (o activar los proxys)
- [ ] Confirmar el TileMatrixSet correcto para la capa GOES-East casi en vivo (si no se ve nada con "Casi en vivo" activado, avisar para ajustar)
- [ ] Confirmar esquema real de campos con un sistema activo
- [ ] Íconos PWA definitivos (los actuales son un placeholder generado)
- [ ] Modo kiosko para pantalla de sala de situación (auto-rotación entre sistemas, sin interacción)
- [ ] Archivo histórico de eventos (Google Sheets + Telegram, como en SISMO·MONITOR) — requiere decidir infraestructura nueva antes de construirlo
- [ ] Capas de inundación/marejada ciclónica del NHC (Inundation, Tidal Mask) si se necesitan para uso costero
