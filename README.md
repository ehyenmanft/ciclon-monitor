# 🌀 CICLÓN·MONITOR

**Monitoreo de ciclones tropicales y huracanes en tiempo real** — mapa con sistemas activos, trayectoria y cono de incertidumbre, ficha por sistema, capa experimental de IA (WeatherNext) y foco en Venezuela y el Caribe.

> Plataforma hermana de [SISMO·MONITOR](https://github.com/ehyenmanft/monitor-sismico), nacida de la misma filosofía: gratuita, en español, y con la información de riesgo natural que ninguna app internacional muestra para Venezuela.

---

## ✨ Características (versión actual — MVP)

- **Mapa oscuro** (Leaflet + teselas CARTO): sistemas activos con color por categoría Saffir-Simpson.
- **Ficha por sistema**: categoría, vientos máximos, presión central, movimiento, hora de última actualización, enlace directo al aviso oficial del NHC.
- **Parseo defensivo**: valida los campos del JSON de NHC por contenido (rango numérico + pista en el nombre), no por nombre exacto de campo — para sobrevivir a cambios de formato sin aviso.
- **Capa experimental WeatherNext** (Google DeepMind, vía Open-Meteo): dispersión del ensamble de 64 miembros de viento/presión en el punto del sistema. Etiquetada explícitamente como experimental — nunca se usa como fuente de la posición del ciclón.
- **Proximidad a Venezuela**: distancia calculada al sistema, con enlaces directos a INAMEH y Protección Civil (no hay integración de datos porque INAMEH no publica API).
- **Honestidad de fuente**: si el NHC no responde, se muestra un aviso explícito con la hora del último dato confirmado — nunca datos viejos como si fueran actuales.
- **Bilingüe** español/inglés. **Responsive**: hojas deslizables y navegación inferior en móvil. **PWA instalable**.
- **Modo demo**: sistema de ejemplo, claramente etiquetado, para probar la interfaz cuando no hay ciclones activos reales.

## 🔌 Fuentes de datos

| Fuente | Cobertura | Acceso |
|---|---|---|
| [NHC/NOAA](https://www.nhc.noaa.gov) — `CurrentStorms.json` | Atlántico, Pacífico oriental y central | JSON público, sin clave |
| [Google WeatherNext 2](https://open-meteo.com/en/docs/google-weathernext-api) vía Open-Meteo | Global, capa experimental | JSON público, sin clave |
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
