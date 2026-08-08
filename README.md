# 🌀 CICLÓN·MONITOR

**Monitoreo de ciclones tropicales y huracanes en tiempo real** — mapa con sistemas activos, trayectoria y cono de incertidumbre, ficha por sistema, capa experimental de IA (WeatherNext) y foco en Venezuela y el Caribe.

> Plataforma hermana de [SISMO·MONITOR](https://github.com/ehyenmanft/monitor-sismico), nacida de la misma filosofía: gratuita, en español, y con la información de riesgo natural que ninguna app internacional muestra para Venezuela.

---

## ✨ Características (versión actual)

### Modo Ciclones
- **Mapa oscuro** (Leaflet + teselas CARTO): sistemas activos con color por categoría Saffir-Simpson.
- **Ficha por sistema**: categoría, vientos máximos, presión central, movimiento, hora de última actualización, enlace directo al aviso oficial del NHC.
- **Parseo defensivo**: valida los campos del JSON de NHC por contenido (rango numérico + pista en el nombre), no por nombre exacto de campo — para sobrevivir a cambios de formato sin aviso.
- **Capa experimental WeatherNext** (Google DeepMind, vía Open-Meteo): dispersión del ensamble de 64 miembros de viento/presión en el punto del sistema. Etiquetada explícitamente como experimental — nunca se usa como fuente de la posición del ciclón.
- **Proximidad a Venezuela**: distancia calculada al sistema, con enlaces directos a INAMEH y Protección Civil (no hay integración de datos porque INAMEH no publica API).
- **Modo demo**: sistema de ejemplo, claramente etiquetado, para probar la interfaz cuando no hay ciclones activos reales.

### Modo Clima
- **Búsqueda global** (geocoding Open-Meteo) + **geolocalización del navegador** + acceso rápido a 8 ciudades de Venezuela.
- **Condiciones actuales**: temperatura, sensación térmica, humedad, viento, ráfagas, presión, nubosidad, precipitación.
- **Próximas 24 horas**: franja horaria con ícono, temperatura y probabilidad de precipitación.
- **Pronóstico de 7 días**: máx/mín, ícono y probabilidad de lluvia por día.
- **Calidad del aire**: AQI europeo y de EE.UU. en tiempo real.
- A diferencia del módulo Ciclones, aquí la fuente (API general de Open-Meteo) está bien documentada y es estable, así que se usan nombres de campo exactos sin necesidad de parseo defensivo.

### General
- **Honestidad de fuente**: si una fuente no responde, se muestra un aviso explícito con la hora del último dato confirmado — nunca datos viejos como si fueran actuales.
- **Bilingüe** español/inglés. **Responsive**: hojas deslizables y navegación inferior en móvil. **PWA instalable**.

## 🔌 Fuentes de datos

| Fuente | Cobertura | Acceso |
|---|---|---|
| [NHC/NOAA](https://www.nhc.noaa.gov) — `CurrentStorms.json` | Atlántico, Pacífico oriental y central | JSON público, sin clave |
| [Google WeatherNext 2](https://open-meteo.com/en/docs/google-weathernext-api) vía Open-Meteo | Global, capa experimental | JSON público, sin clave |
| [Open-Meteo Forecast API](https://open-meteo.com/en/docs) | Global, clima general | JSON público, sin clave |
| [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Global, búsqueda de ciudades | JSON público, sin clave |
| [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Global, calidad del aire | JSON público, sin clave |
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

- [ ] Confirmar CORS directo a NHC (o activar proxy)
- [ ] Confirmar esquema real de campos con un sistema activo
- [ ] Cono de incertidumbre oficial (geometría GIS del NHC), no solo el punto
- [ ] Íconos PWA definitivos (los actuales son un placeholder generado)
- [ ] Modo kiosko / vista satelital (como SISMO·MONITOR)
