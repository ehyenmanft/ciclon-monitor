# 🌀 CICLÓN·MONITOR

**Monitoreo de ciclones tropicales y huracanes en tiempo real** — mapa con sistemas activos, trayectoria y cono de incertidumbre, ficha por sistema, capa experimental de IA (WeatherNext) y foco en Venezuela y el Caribe.

> Plataforma hermana de [SISMO·MONITOR](https://github.com/ehyenmanft/monitor-sismico), nacida de la misma filosofía: gratuita, en español, y con la información de riesgo natural que ninguna app internacional muestra para Venezuela.

---

## ✨ Características (versión actual)

### Modo Ciclones
- **Mapa oscuro** (Leaflet + teselas CARTO): sistemas activos con color por categoría Saffir-Simpson.
- **Trayectoria y cono oficiales del NHC**: trayecto recorrido, pronóstico y cono de incertidumbre reales, vía el GIS oficial de NOAA (ArcGIS REST) — no una aproximación.
- **Watch/Warning oficiales**: tramos de costa bajo aviso o alerta de tormenta tropical/huracán, coloreados por tipo.
- **Alerta destacada Venezuela**: banner permanente en la parte superior si algún sistema activo pone a Venezuela bajo watch/warning oficial o llegada probable de vientos de tormenta — con enlaces directos al NHC y a Protección Civil Venezuela.
- **Ficha por sistema**: categoría, vientos máximos, presión central, movimiento, hora de última actualización, enlace directo al aviso oficial del NHC.
- **Parseo defensivo**: valida los campos del JSON de NHC por contenido (rango numérico + pista en el nombre), no por nombre exacto de campo — para sobrevivir a cambios de formato sin aviso.
- **Capa experimental WeatherNext** (Google DeepMind, vía Open-Meteo): dispersión del ensamble de 64 miembros de viento/presión en el punto del sistema. Etiquetada explícitamente como experimental — nunca se usa como fuente de la posición del ciclón.
- **Modo demo**: sistema de ejemplo, claramente etiquetado, para probar la interfaz cuando no hay ciclones activos reales.

### Modo Clima
- **Búsqueda global** (geocoding Open-Meteo) + **geolocalización del navegador** + acceso rápido a 9 ciudades de Venezuela.
- **Condiciones actuales**: temperatura, sensación térmica, humedad, viento, ráfagas, presión, nubosidad, precipitación.
- **Próximas 24 horas** y **pronóstico de 7 días**, más **calidad del aire** (AQI europeo/EE.UU.).

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
| INAMEH (Venezuela) | — | Sin API pública — se enlaza directo a sus canales oficiales |

### El problema CORS de NHC (posible, sin confirmar aún)

`www.nhc.noaa.gov` es el sitio web del NHC, no una API dedicada como `api.weather.gov` — no está confirmado que envíe cabecera CORS para lectura directa desde el navegador. Si `index.html` reporta error de red en consola al leer `CurrentStorms.json`:

- **`nhc-proxy.gs`** — mismo patrón que `funvisis-proxy.gs` de SISMO·MONITOR: Google Apps Script que lee la fuente oficial, la cachea 3 minutos y la sirve sin problema de CORS.

## 🏗 Arquitectura

```
Navegador (index.html — archivo único, sin build)
 ├── NHC ──────── directo (CurrentStorms.json) ── o vía proxy Apps Script si CORS falla
 └── WeatherNext ─ directo (Open-Meteo, sin clave) — capa experimental en el punto del sistema
```

Todo corre en infraestructura gratuita: GitHub Pages + (opcionalmente) Google Apps Script. Sin servidores, sin claves de API, sin costos.

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
