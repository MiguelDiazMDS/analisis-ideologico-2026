"""
Pipeline reproducible para validar los datos del estudio ISID 2026,
calcular métricas y correlaciones, consolidar data/dashboard_data.json
y (opcionalmente) regenerar los gráficos HTML en charts/.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "ideologia_global_2026.csv"
RANKING_JSON_PATH = ROOT / "data" / "ranking_isid_2026.json"
DASHBOARD_JSON_PATH = ROOT / "data" / "dashboard_data.json"
CHARTS_DIR = ROOT / "charts"


def clean_num(val):
    if pd.isna(val):
        return None
    if isinstance(val, (np.floating, float)):
        return round(float(val), 4)
    if isinstance(val, (np.integer, int)):
        return int(val)
    return val


def build_data(rebuild_charts: bool = False) -> dict:
    df = pd.read_csv(CSV_PATH)
    ranking_meta = json.loads(RANKING_JSON_PATH.read_text(encoding="utf-8"))

    # Recalcular pilares y métricas base/sensibilidad
    df["p1_calc"] = (
        0.35 * df["heritage_2026"]
        + 0.35 * (df["fraser_2026"] * 10.0)
        + 0.30 * (df["fraser_tamano_estado"] * 10.0)
    )
    df["p2_calc"] = (
        0.50 * df["hofstede_idv_2023"]
        + 0.50 * (df["fraser_tamano_estado"] * 10.0)
    )
    df["p3_calc"] = df["gallup_ley_orden_2025"]
    df["isid_calc"] = (df["p1_calc"] + df["p2_calc"] + df["p3_calc"]) / 3.0
    df["isid_mercado_calc"] = (
        0.50 * df["p1_calc"] + 0.30 * df["p2_calc"] + 0.20 * df["p3_calc"]
    )
    df["isid_orden_calc"] = (
        0.25 * df["p1_calc"] + 0.20 * df["p2_calc"] + 0.55 * df["p3_calc"]
    )

    # Correlaciones sobre la muestra con datos de individualismo (n=33)
    cols_corr = [
        "heritage_2026",
        "fraser_2026",
        "hofstede_idv_2023",
        "gallup_ley_orden_2025",
        "eiu_democracia_2025",
        "confianza_social_wvs",
    ]
    corr_labels = {
        "heritage_2026": "Libertad Económica (Heritage)",
        "fraser_2026": "Libertad Económica (Fraser)",
        "hofstede_idv_2023": "Individualismo (Hofstede)",
        "gallup_ley_orden_2025": "Ley y Orden (Gallup)",
        "eiu_democracia_2025": "Democracia (EIU)",
        "confianza_social_wvs": "Confianza Social (WVS)",
    }
    df_corr_sample = df.dropna(subset=["hofstede_idv_2023"])
    corr_df = df_corr_sample[cols_corr].corr().round(3)

    # Mapear arquetipos y notas desde ranking_isid_2026.json
    top10_map = {item["pais"]: item for item in ranking_meta.get("top_10", [])}
    context_map = {
        item["pais"]: item for item in ranking_meta.get("referentes_contexto", [])
    }

    countries = []
    for _, row in df.iterrows():
        pais = str(row["pais"])
        top_info = top10_map.get(pais, {})
        ctx_info = context_map.get(pais, {})
        countries.append(
            {
                "country_en": str(row["country_en"]),
                "pais": pais,
                "region": str(row["region"]),
                "heritage_2026": clean_num(row["heritage_2026"]),
                "fraser_2026": clean_num(row["fraser_2026"]),
                "fraser_tamano_estado": clean_num(row["fraser_tamano_estado"]),
                "hofstede_idv_2023": clean_num(row["hofstede_idv_2023"]),
                "giem_wvs": clean_num(row["giem_wvs"]),
                "gallup_ley_orden_2025": clean_num(row["gallup_ley_orden_2025"]),
                "eiu_democracia_2025": clean_num(row["eiu_democracia_2025"]),
                "confianza_social_wvs": clean_num(row["confianza_social_wvs"]),
                "eje_cultural_iw": str(row["eje_cultural_iw"]),
                "pilar1_libre_mercado": clean_num(row["pilar1_libre_mercado"]),
                "pilar2_resp_individual": clean_num(row["pilar2_resp_individual"]),
                "pilar3_ley_orden": clean_num(row["pilar3_ley_orden"]),
                "isid_base": clean_num(row["isid_base"]),
                "isid_mercado": clean_num(row["isid_mercado"]),
                "isid_ley_orden": clean_num(row["isid_ley_orden"]),
                "isid_giem": clean_num(row["isid_giem"]),
                "cumple_filtro_antiestatista": bool(row["cumple_filtro_antiestatista"]),
                "ranking_isid_filtrado": clean_num(row["ranking_isid_filtrado"]),
                "arquetipo": top_info.get("arquetipo"),
                "nota": top_info.get("nota") or ctx_info.get("motivo"),
            }
        )

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "metadata": ranking_meta["metadata"],
        "summary": {
            "total_paises": len(df),
            "muestra_correlacion": int(len(df_corr_sample)),
            "paises_con_isid_completo": int(df["isid_calc"].notna().sum()),
            "paises_cumplen_filtro": int(df["cumple_filtro_antiestatista"].sum()),
            "media_global_gallup": 80,
            "regiones": sorted(df["region"].dropna().unique().tolist()),
        },
        "correlation_matrix": {
            "keys": cols_corr,
            "labels": [corr_labels[c] for c in cols_corr],
            "values": [
                [clean_num(corr_df.loc[r, c]) for c in cols_corr] for r in cols_corr
            ],
        },
        "top_10": ranking_meta["top_10"],
        "referentes_contexto": ranking_meta["referentes_contexto"],
        "countries": countries,
    }

    DASHBOARD_JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    if rebuild_charts:
        regenerate_charts(df)

    return payload


def regenerate_charts(df: pd.DataFrame) -> None:
    import plotly.express as px
    import plotly.graph_objects as go

    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

    # Gráfico 1
    df_g1 = df.dropna(subset=["heritage_2026", "eiu_democracia_2025"]).copy()
    df_g1["tamano_punto"] = df_g1["confianza_social_wvs"].fillna(30)
    fig1 = px.scatter(
        df_g1,
        x="heritage_2026",
        y="eiu_democracia_2025",
        color="region",
        size="tamano_punto",
        text="pais",
        hover_data=["fraser_2026", "gallup_ley_orden_2025", "confianza_social_wvs"],
        title="Libertad Económica (Heritage 2026) vs. Democracia (EIU 2025)",
        labels={
            "heritage_2026": "Libertad Económica Heritage 2026 (0-100)",
            "eiu_democracia_2025": "Índice de Democracia EIU 2025 (0-10)",
            "region": "Región",
        },
        template="plotly_white",
    )
    fig1.update_traces(textposition="top center", textfont_size=10)
    fig1.add_vline(x=70, line_dash="dash", line_color="#888888")
    fig1.add_hline(y=8.0, line_dash="dash", line_color="#888888")
    fig1.write_html(
        CHARTS_DIR / "01_mercado_democracia_confianza.html",
        include_plotlyjs="cdn",
    )

    # Gráfico 2
    df_g2 = df.dropna(subset=["fraser_tamano_estado", "hofstede_idv_2023"]).copy()
    df_g2["perfil"] = np.where(
        df_g2["fraser_tamano_estado"] < 6.0,
        "Individualismo Estatista (< 6.0)",
        np.where(
            df_g2["hofstede_idv_2023"] >= 60,
            "Individualismo de Estado Limitado",
            "Colectivismo Pro-Mercado",
        ),
    )
    fig2 = px.scatter(
        df_g2,
        x="fraser_tamano_estado",
        y="hofstede_idv_2023",
        color="perfil",
        text="pais",
        hover_data=["giem_wvs", "isid_calc"],
        title="Contención Fiscal del Estado vs. Individualismo Cultural (2023)",
        labels={
            "fraser_tamano_estado": "Fraser Área 1: Tamaño del Estado (mayor = Estado más limitado)",
            "hofstede_idv_2023": "Individualismo Cultural 2023 (0-100)",
            "perfil": "Cuadrante",
        },
        template="plotly_white",
    )
    fig2.update_traces(textposition="top center", marker_size=11)
    fig2.add_vline(
        x=6.0, line_dash="dash", line_color="#666666", annotation_text="Umbral 6.0"
    )
    fig2.add_hline(y=60, line_dash="dash", line_color="#666666")
    fig2.write_html(
        CHARTS_DIR / "02_individualismo_estado_giem.html",
        include_plotlyjs="cdn",
    )

    # Gráfico 3
    top10 = (
        df[(df["fraser_tamano_estado"] >= 6.0) & df["isid_calc"].notna()]
        .sort_values("isid_calc", ascending=False)
        .head(10)
        .iloc[::-1]
    )
    fig3 = go.Figure()
    fig3.add_trace(
        go.Bar(
            y=top10["pais"],
            x=top10["isid_calc"].round(2),
            orientation="h",
            name="ISID Equilibrado (33/33/33)",
            marker_color="#1A73E8",
            text=top10["isid_calc"].round(2),
            textposition="outside",
        )
    )
    fig3.add_trace(
        go.Scatter(
            y=top10["pais"],
            x=top10["isid_mercado_calc"].round(2),
            mode="markers",
            name="Énfasis Libre Mercado (50/30/20)",
            marker=dict(color="#12B5CB", size=10, symbol="diamond"),
        )
    )
    fig3.add_trace(
        go.Scatter(
            y=top10["pais"],
            x=top10["isid_orden_calc"].round(2),
            mode="markers",
            name="Énfasis Ley y Orden (25/20/55)",
            marker=dict(color="#FA903E", size=10, symbol="circle"),
        )
    )
    fig3.update_layout(
        title="Top 10 Países por Orientación de Derechas (ISID 2026) y Sensibilidad",
        xaxis=dict(title="Puntuación (0-100)", range=[65, 90]),
        yaxis=dict(title=""),
        template="plotly_white",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    fig3.write_html(
        CHARTS_DIR / "03_ranking_isid_sensibilidad.html",
        include_plotlyjs="cdn",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Construir datos del panel ISID 2026")
    parser.add_argument(
        "--rebuild-charts",
        action="store_true",
        help="Regenera también los 3 gráficos HTML en charts/",
    )
    args = parser.parse_args()
    data = build_data(rebuild_charts=args.rebuild_charts)
    print(
        f"OK: {DASHBOARD_JSON_PATH.relative_to(ROOT)} generado "
        f"({data['summary']['total_paises']} países, "
        f"{data['summary']['paises_cumplen_filtro']} cumplen filtro antiestatista)."
    )


if __name__ == "__main__":
    main()
