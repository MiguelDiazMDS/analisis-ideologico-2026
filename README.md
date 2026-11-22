# Radiografía Ideológica Global y Ranking ISID 2026

Panel web interactivo, conjunto de datos verificados (2021–2026), cuaderno Jupyter reproducible e informe completo del **Índice Sintético de Orientación de Derechas (ISID 2026)** para 34 economías.

## Características del Panel Interactivo

- **Simulador de Ponderaciones en Vivo:** Ajusta el peso de los 3 pilares (*Libre Mercado*, *Responsabilidad Individual* y *Ley y Orden*) y el umbral antiestatista (`Fraser Área 1 ≥ 6.0`) para comprobar al instante la sensibilidad del Top 10.
- **Cuadros de Mando Interactivos (Plotly):**
  1. Libertad Económica (Heritage 2026) vs. Democracia (EIU 2025) y Confianza Social (WVS).
  2. Contención Fiscal del Estado (Fraser Área 1) vs. Individualismo Cultural (Hofstede 2023).
  3. Matriz de Correlaciones Empíricas entre los 6 ejes ideológicos (`n = 33`).
  4. Comparador Radar Multidimensional de hasta 4 países.
  5. Visor integrado de los 3 cuadros de mando HTML originales generados por `notebooks/analisis_isid_2026.ipynb`.
- **Explorador Completo de 34 Economías:** Búsqueda instantánea, filtros por región y estatus antiestatista, fichas detalladas de país y exportación de CSV/JSON.

## Estructura del Proyecto

```text
analisis-ideologico-2026/
├── index.html                                # Panel web interactivo principal
├── vercel.json                               # Configuración de despliegue estático en Vercel
├── informe_ideologia_global_2026.md          # Informe completo en Markdown
├── requirements.txt                          # Dependencias de Python
├── assets/
│   ├── styles.css                            # Diseño editorial responsivo (claro/oscuro)
│   └── app.js                                # Lógica interactiva, simulador y gráficos Plotly
├── data/
│   ├── ideologia_global_2026.csv             # Dataset completo (34 países, 21 columnas)
│   ├── ranking_isid_2026.json                # Ranking estructurado Top 10 y referentes
│   └── dashboard_data.json                   # Datos consolidados generados automáticamente
├── notebooks/
│   └── analisis_isid_2026.ipynb              # Cuaderno Jupyter reproducible
├── scripts/
│   ├── build_dashboard_data.py               # Reconstruye dashboard_data.json y charts/*.html
│   └── check_sources.py                      # Monitor de disponibilidad de fuentes oficiales
├── charts/
│   ├── 01_mercado_democracia_confianza.html  # Gráfico interactivo 1 (Jupyter/Plotly)
│   ├── 02_individualismo_estado_giem.html    # Gráfico interactivo 2 (Jupyter/Plotly)
│   └── 03_ranking_isid_sensibilidad.html     # Gráfico interactivo 3 (Jupyter/Plotly)
└── .github/workflows/
    └── periodic-update.yml                   # Pipeline mensual de actualización en GitHub Actions
```

## Ejecución Local

```bash
# 1. Instalar dependencias de Python
pip install -r requirements.txt

# 2. (Opcional) Reconstruir JSON del panel y gráficos HTML desde el CSV
python scripts/build_dashboard_data.py --rebuild-charts

# 3. Levantar el panel web localmente
python -m http.server 8000
# Abrir http://localhost:8000
```

## Actualización Periódica de Datos y Despliegue en Vercel

1. **Actualización periódica:** El flujo `.github/workflows/periodic-update.yml` se ejecuta el día 1 de cada mes (y bajo demanda mediante `workflow_dispatch`) para comprobar fuentes abiertas (`scripts/check_sources.py`) y regenerar automáticamente `data/dashboard_data.json` y `charts/*.html` cuando se actualiza `data/ideologia_global_2026.csv`.
2. **Despliegue continuo en Vercel:** El proyecto no requiere paso de compilación pesado (`static site`) y está listo para conectarse directamente desde GitHub a Vercel (plan gratuito Hobby con HTTPS global y despliegue automático en cada `push` a `main`).

## Fuentes Principales

- **The Heritage Foundation** — *Index of Economic Freedom 2026*
- **Fraser Institute** — *Economic Freedom of the World 2026*
- **The Culture Factor / Hofstede Insights** — *Individualism Score (2023)*
- **Cato Institute** — *Global Index of Economic Mentality (GIEM)* & *Human Freedom Index 2025*
- **Gallup** — *Global Safety Report 2026 (Law and Order Index 2025)*
- **Economist Intelligence Unit (EIU)** — *Democracy Index 2025*
- **World Values Survey (Ola 7) / IVS** vía *Our World in Data*
