(() => {
  "use strict";

  const PRESETS = {
    base: { p1: 33.3333, p2: 33.3333, p3: 33.3334, slider: [33, 33, 34] },
    mercado: { p1: 50, p2: 30, p3: 20, slider: [50, 30, 20] },
    orden: { p1: 25, p2: 20, p3: 55, slider: [25, 20, 55] },
  };

  const REGION_COLORS = {
    Europa: "#1d4ed8",
    "Asia-Pacífico": "#0d9488",
    Norteamérica: "#7c3aed",
    Latinoamérica: "#d97706",
    MENA: "#dc2626",
    Eurasia: "#0284c7",
    África: "#16a34a",
  };

  const RADAR_COLORS = ["#1d4ed8", "#0d9488", "#d97706", "#dc2626"];

  const state = {
    data: null,
    weights: { p1: 33.3333, p2: 33.3333, p3: 33.3334 },
    activePreset: "base",
    filterEnabled: true,
    threshold: 6.0,
    activeTab: "mercado",
    chart1Region: "ALL",
    tableSearch: "",
    tableRegion: "ALL",
    tableStatus: "ALL",
    sortKey: "ranking_isid_filtrado",
    sortDir: "asc",
    modalCountry: null,
    radarSelection: ["Suiza", "Singapur", "Estados Unidos", "Dinamarca"],
  };

  const $ = (id) => document.getElementById(id);

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function plotlyTheme() {
    const dark = isDark();
    return {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: {
        family: "Inter, system-ui, sans-serif",
        color: dark ? "#e2e8f0" : "#1e293b",
        size: 12,
      },
      gridcolor: dark ? "#24324d" : "#e2e8f0",
      linecolor: dark ? "#334155" : "#cbd5e1",
      muted: dark ? "#94a3b8" : "#64748b",
      hoverBg: dark ? "#0f172a" : "#ffffff",
      hoverBorder: dark ? "#334155" : "#cbd5e1",
    };
  }

  function fmt(val, decimals = 2, suffix = "") {
    if (val === null || val === undefined || Number.isNaN(val)) return "—";
    return Number(val).toFixed(decimals) + suffix;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getNormalizedWeights() {
    const total = state.weights.p1 + state.weights.p2 + state.weights.p3;
    if (total <= 0) return { p1: 1 / 3, p2: 1 / 3, p3: 1 / 3 };
    return {
      p1: state.weights.p1 / total,
      p2: state.weights.p2 / total,
      p3: state.weights.p3 / total,
    };
  }

  function computeRankedList() {
    const w = getNormalizedWeights();
    const eligible = state.data.countries.filter((c) => {
      const hasPillars =
        c.pilar1_libre_mercado !== null &&
        c.pilar2_resp_individual !== null &&
        c.pilar3_ley_orden !== null;
      if (!hasPillars) return false;
      if (!state.filterEnabled) return true;
      return (
        c.fraser_tamano_estado !== null &&
        c.fraser_tamano_estado >= state.threshold - 1e-9
      );
    });

    const scored = eligible.map((c) => {
      const liveIsid =
        w.p1 * c.pilar1_libre_mercado +
        w.p2 * c.pilar2_resp_individual +
        w.p3 * c.pilar3_ley_orden;
      return { ...c, live_isid: liveIsid };
    });

    scored.sort((a, b) => b.live_isid - a.live_isid);
    return scored.map((c, idx) => ({ ...c, live_rank: idx + 1 }));
  }

  /* =====================
     RENDER: SIMULADOR + TOP 10
     ===================== */
  function updateSimulatorUI() {
    const w = getNormalizedWeights();
    $("wP1Pct").textContent = `${(w.p1 * 100).toFixed(1)}%`;
    $("wP2Pct").textContent = `${(w.p2 * 100).toFixed(1)}%`;
    $("wP3Pct").textContent = `${(w.p3 * 100).toFixed(1)}%`;
    $("thresholdVal").textContent = state.threshold.toFixed(1);
    $("thresholdSlider").disabled = !state.filterEnabled;

    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.preset === state.activePreset);
    });

    const ranked = computeRankedList();
    const top10 = ranked.slice(0, 10);

    const filterTxt = state.filterEnabled
      ? `que cumplen el filtro antiestatista (Fraser Área 1 ≥ ${state.threshold.toFixed(1)})`
      : "sin filtro antiestatista (incluye Estados de bienestar de alta fiscalidad)";
    $("simSummaryText").textContent = `Mostrando Top ${top10.length} de ${ranked.length} economías con los 3 pilares completos ${filterTxt}.`;

    renderRankingChart(top10);
    renderTop10Cards(top10);
  }

  function renderRankingChart(top10) {
    if (!window.Plotly) return;
    const t = plotlyTheme();
    const reversed = [...top10].reverse();

    const labels = reversed.map((c) => c.pais);
    const liveScores = reversed.map((c) => Number(c.live_isid.toFixed(2)));
    const marketScores = reversed.map((c) =>
      c.isid_mercado !== null ? Number(c.isid_mercado.toFixed(2)) : null
    );
    const orderScores = reversed.map((c) =>
      c.isid_ley_orden !== null ? Number(c.isid_ley_orden.toFixed(2)) : null
    );

    const barColors = reversed.map((c) =>
      c.fraser_tamano_estado !== null && c.fraser_tamano_estado < 6.0
        ? "#d97706"
        : "#1d4ed8"
    );

    const traces = [
      {
        type: "bar",
        orientation: "h",
        y: labels,
        x: liveScores,
        name: "ISID Escenario Activo",
        marker: { color: barColors, opacity: 0.9, line: { width: 0 } },
        text: liveScores.map((v) => ` ${v.toFixed(2)} `),
        textposition: "inside",
        insidetextanchor: "end",
        textfont: { family: "JetBrains Mono, monospace", size: 11, color: "#ffffff" },
        hovertemplate:
          "<b>%{y}</b><br>ISID Activo: <b>%{x:.2f}</b><extra></extra>",
      },
      {
        type: "scatter",
        mode: "markers",
        y: labels,
        x: marketScores,
        name: "Énfasis Mercado (50/30/20)",
        marker: { color: "#0d9488", size: 9, symbol: "diamond" },
        hovertemplate: "<b>%{y}</b><br>Énfasis Mercado: %{x:.2f}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "markers",
        y: labels,
        x: orderScores,
        name: "Énfasis Ley y Orden (25/20/55)",
        marker: { color: "#f97316", size: 9, symbol: "circle" },
        hovertemplate: "<b>%{y}</b><br>Énfasis Ley y Orden: %{x:.2f}<extra></extra>",
      },
    ];

    const minVal = Math.min(...liveScores, ...marketScores.filter(Boolean), 65);
    const maxVal = Math.max(...liveScores, ...orderScores.filter(Boolean), 88);

    const layout = {
      paper_bgcolor: t.paper_bgcolor,
      plot_bgcolor: t.plot_bgcolor,
      font: t.font,
      margin: { l: 120, r: 46, t: 46, b: 44 },
      xaxis: {
        title: "Puntuación ISID (0–100)",
        range: [Math.max(55, Math.floor(minVal - 4)), Math.min(100, Math.ceil(maxVal + 4))],
        gridcolor: t.gridcolor,
        zeroline: false,
      },
      yaxis: {
        automargin: true,
        gridcolor: "transparent",
      },
      legend: {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "left",
        x: 0,
        font: { size: 11 },
      },
      hoverlabel: {
        bgcolor: t.hoverBg,
        bordercolor: t.hoverBorder,
        font: { color: t.font.color },
      },
    };

    Plotly.react("chartRanking", traces, layout, {
      responsive: true,
      displayModeBar: false,
    });
  }

  function renderTop10Cards(top10) {
    const container = $("top10Cards");
    if (!top10.length) {
      container.innerHTML =
        '<p class="card-sub" style="padding:1rem;">Ningún país cumple el umbral seleccionado. Reduce el valor mínimo de Fraser Área 1.</p>';
      return;
    }

    container.innerHTML = top10
      .map((c) => {
        let deltaHtml = "";
        if (c.ranking_isid_filtrado === null) {
          deltaHtml = '<span class="rank-delta delta-new">Excluido base</span>';
        } else {
          const diff = c.ranking_isid_filtrado - c.live_rank;
          if (diff > 0) {
            deltaHtml = `<span class="rank-delta delta-up">▲ +${diff}</span>`;
          } else if (diff < 0) {
            deltaHtml = `<span class="rank-delta delta-down">▼ ${diff}</span>`;
          }
        }

        const sub = c.arquetipo || c.eje_cultural_iw;
        return `
          <div class="rank-item" data-rank="${c.live_rank}" data-country="${escapeHtml(c.pais)}" tabindex="0" role="button" aria-label="Ver ficha de ${escapeHtml(c.pais)}">
            <div class="rank-pos">${c.live_rank}</div>
            <div class="rank-main">
              <div class="rank-name-row">
                <span class="rank-name">${escapeHtml(c.pais)}</span>
                ${deltaHtml}
              </div>
              <div class="rank-archetype" title="${escapeHtml(sub)}">${escapeHtml(sub)}</div>
              <div class="pillar-mini-bars">
                <div class="mini-bar-col">
                  <div class="mini-bar-label"><span>Mdo</span><span>${fmt(c.pilar1_libre_mercado, 1)}</span></div>
                  <div class="mini-bar-track"><div class="mini-bar-fill fill-p1" style="width:${Math.min(100, c.pilar1_libre_mercado)}%"></div></div>
                </div>
                <div class="mini-bar-col">
                  <div class="mini-bar-label"><span>Resp</span><span>${fmt(c.pilar2_resp_individual, 1)}</span></div>
                  <div class="mini-bar-track"><div class="mini-bar-fill fill-p2" style="width:${Math.min(100, c.pilar2_resp_individual)}%"></div></div>
                </div>
                <div class="mini-bar-col">
                  <div class="mini-bar-label"><span>Orden</span><span>${fmt(c.pilar3_ley_orden, 0)}</span></div>
                  <div class="mini-bar-track"><div class="mini-bar-fill fill-p3" style="width:${Math.min(100, c.pilar3_ley_orden)}%"></div></div>
                </div>
              </div>
            </div>
            <div class="rank-score-col">
              <span class="rank-score">${fmt(c.live_isid, 2)}</span>
              <span class="rank-meta-tiny">F1: ${fmt(c.fraser_tamano_estado, 2)}</span>
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".rank-item").forEach((el) => {
      const open = () => openCountryModal(el.dataset.country);
      el.addEventListener("click", open);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          open();
        }
      });
    });
  }

  /* =====================
     RENDER: CUADROS DE MANDO
     ===================== */
  function renderChartMercado() {
    if (!window.Plotly) return;
    const t = plotlyTheme();
    const rows = state.data.countries.filter(
      (c) =>
        c.heritage_2026 !== null &&
        c.eiu_democracia_2025 !== null &&
        (state.chart1Region === "ALL" || c.region === state.chart1Region)
    );

    const byRegion = {};
    rows.forEach((c) => {
      if (!byRegion[c.region]) byRegion[c.region] = [];
      byRegion[c.region].push(c);
    });

    const traces = Object.entries(byRegion).map(([region, items]) => ({
      type: "scatter",
      mode: "markers+text",
      name: region,
      x: items.map((c) => c.heritage_2026),
      y: items.map((c) => c.eiu_democracia_2025),
      text: items.map((c) => c.pais),
      textposition: "top center",
      textfont: { size: 10, color: t.font.color },
      marker: {
        color: REGION_COLORS[region] || "#64748b",
        size: items.map((c) => {
          const trust = c.confianza_social_wvs ?? 30;
          return 9 + trust * 0.34;
        }),
        opacity: 0.84,
        line: { width: 1, color: isDark() ? "#0b1120" : "#ffffff" },
      },
      customdata: items.map((c) => [
        fmt(c.fraser_2026, 2),
        fmt(c.gallup_ley_orden_2025, 0),
        c.confianza_social_wvs !== null ? `${c.confianza_social_wvs}%` : "n/d",
        c.isid_base !== null ? fmt(c.isid_base, 2) : "n/d",
      ]),
      hovertemplate:
        "<b>%{text}</b> (" +
        region +
        ")<br>Heritage 2026: <b>%{x:.1f}</b><br>Democracia EIU 2025: <b>%{y:.2f}</b>" +
        "<br>Fraser 2026: %{customdata[0]} · Orden: %{customdata[1]}" +
        "<br>Confianza WVS: %{customdata[2]} · ISID: %{customdata[3]}<extra></extra>",
    }));

    const layout = {
      paper_bgcolor: t.paper_bgcolor,
      plot_bgcolor: t.plot_bgcolor,
      font: t.font,
      margin: { l: 58, r: 24, t: 24, b: 56 },
      xaxis: {
        title: "Libertad Económica Heritage 2026 (0–100)",
        gridcolor: t.gridcolor,
        range: [44, 89],
      },
      yaxis: {
        title: "Índice de Democracia EIU 2025 (0–10)",
        gridcolor: t.gridcolor,
        range: [1.3, 10.6],
      },
      shapes: [
        {
          type: "line",
          x0: 70,
          x1: 70,
          y0: 1.3,
          y1: 10.6,
          line: { dash: "dash", color: t.muted, width: 1.2 },
        },
        {
          type: "line",
          x0: 44,
          x1: 89,
          y0: 8.0,
          y1: 8.0,
          line: { dash: "dash", color: t.muted, width: 1.2 },
        },
      ],
      annotations: [
        {
          x: 88,
          y: 10.35,
          text: "Democracia plena + Mercado libre",
          showarrow: false,
          xanchor: "right",
          font: { size: 11, color: t.muted },
        },
        {
          x: 88,
          y: 2.0,
          text: "Capitalismo de orden / no democrático",
          showarrow: false,
          xanchor: "right",
          font: { size: 11, color: t.muted },
        },
      ],
      legend: { orientation: "h", y: -0.18, x: 0 },
      hoverlabel: { bgcolor: t.hoverBg, bordercolor: t.hoverBorder, font: { color: t.font.color } },
    };

    Plotly.react("chartMercado", traces, layout, { responsive: true, displaylogo: false });
  }

  function renderChartEstado() {
    if (!window.Plotly) return;
    const t = plotlyTheme();
    const rows = state.data.countries.filter(
      (c) => c.fraser_tamano_estado !== null && c.hofstede_idv_2023 !== null
    );

    const groups = {
      "Individualismo de Estado Limitado": { color: "#1d4ed8", items: [] },
      "Individualismo Estatista (< 6.0)": { color: "#d97706", items: [] },
      "Colectivismo Pro-Mercado": { color: "#0d9488", items: [] },
    };

    rows.forEach((c) => {
      const key =
        c.fraser_tamano_estado < 6.0
          ? "Individualismo Estatista (< 6.0)"
          : c.hofstede_idv_2023 >= 60
          ? "Individualismo de Estado Limitado"
          : "Colectivismo Pro-Mercado";
      groups[key].items.push(c);
    });

    const traces = Object.entries(groups).map(([label, g]) => ({
      type: "scatter",
      mode: "markers+text",
      name: label,
      x: g.items.map((c) => c.fraser_tamano_estado),
      y: g.items.map((c) => c.hofstede_idv_2023),
      text: g.items.map((c) => c.pais),
      textposition: "top center",
      textfont: { size: 10.5, color: t.font.color },
      marker: {
        color: g.color,
        size: 13,
        opacity: 0.9,
        line: { width: 1.5, color: isDark() ? "#0b1120" : "#ffffff" },
      },
      customdata: g.items.map((c) => [
        c.giem_wvs !== null ? fmt(c.giem_wvs, 3) : "n/d",
        c.isid_base !== null ? fmt(c.isid_base, 2) : "n/d",
      ]),
      hovertemplate:
        "<b>%{text}</b><br>Fraser Tamaño Estado: <b>%{x:.2f}</b>" +
        "<br>Individualismo 2023: <b>%{y}</b>" +
        "<br>GIEM (WVS): %{customdata[0]} · ISID Base: %{customdata[1]}<extra></extra>",
    }));

    const layout = {
      paper_bgcolor: t.paper_bgcolor,
      plot_bgcolor: t.plot_bgcolor,
      font: t.font,
      margin: { l: 58, r: 24, t: 28, b: 56 },
      xaxis: {
        title: "Fraser Área 1: Tamaño del Estado (mayor = Estado más limitado)",
        gridcolor: t.gridcolor,
        range: [4.6, 8.0],
      },
      yaxis: {
        title: "Individualismo Cultural Hofstede 2023 (0–100)",
        gridcolor: t.gridcolor,
        range: [8, 108],
      },
      shapes: [
        {
          type: "line",
          x0: 6.0,
          x1: 6.0,
          y0: 8,
          y1: 108,
          line: { dash: "dash", color: "#dc2626", width: 1.5 },
        },
        {
          type: "line",
          x0: 4.6,
          x1: 8.0,
          y0: 60,
          y1: 60,
          line: { dash: "dash", color: t.muted, width: 1.2 },
        },
      ],
      annotations: [
        {
          x: 6.03,
          y: 105,
          text: "Umbral antiestatista (6.0)",
          showarrow: false,
          xanchor: "left",
          font: { size: 11, color: "#dc2626" },
        },
      ],
      legend: { orientation: "h", y: -0.18, x: 0 },
      hoverlabel: { bgcolor: t.hoverBg, bordercolor: t.hoverBorder, font: { color: t.font.color } },
    };

    Plotly.react("chartEstado", traces, layout, { responsive: true, displaylogo: false });
  }

  function renderChartCorr() {
    if (!window.Plotly) return;
    const t = plotlyTheme();
    const cm = state.data.correlation_matrix;
    const shortLabels = [
      "Heritage 26",
      "Fraser 26",
      "Individualismo 23",
      "Ley y Orden 25",
      "Democracia EIU",
      "Confianza WVS",
    ];

    const trace = {
      type: "heatmap",
      z: cm.values,
      x: shortLabels,
      y: shortLabels,
      zmin: -1,
      zmax: 1,
      colorscale: [
        [0, "#b91c1c"],
        [0.5, isDark() ? "#1e293b" : "#f8fafc"],
        [1, "#1d4ed8"],
      ],
      text: cm.values.map((row) => row.map((v) => v.toFixed(3))),
      texttemplate: "%{text}",
      textfont: { family: "JetBrains Mono, monospace", size: 12 },
      hovertemplate: "<b>%{y}</b> vs. <b>%{x}</b><br>r = %{z:.3f}<extra></extra>",
    };

    const layout = {
      paper_bgcolor: t.paper_bgcolor,
      plot_bgcolor: t.plot_bgcolor,
      font: t.font,
      margin: { l: 135, r: 30, t: 24, b: 95 },
      yaxis: { autorange: "reversed" },
      xaxis: { tickangle: -20 },
    };

    Plotly.react("chartCorr", [trace], layout, { responsive: true, displaylogo: false });
  }

  function renderChartRadar() {
    if (!window.Plotly) return;
    const t = plotlyTheme();
    const dims = [
      { label: "Libre Mercado", get: (c) => c.heritage_2026 },
      { label: "Estado Limitado", get: (c) => (c.fraser_tamano_estado !== null ? c.fraser_tamano_estado * 10 : null) },
      { label: "Individualismo", get: (c) => c.hofstede_idv_2023 },
      { label: "Ley y Orden", get: (c) => c.gallup_ley_orden_2025 },
      { label: "Democracia", get: (c) => (c.eiu_democracia_2025 !== null ? c.eiu_democracia_2025 * 10 : null) },
      { label: "Confianza Social", get: (c) => c.confianza_social_wvs },
    ];

    const selected = state.radarSelection
      .filter((name) => name && name !== "NONE")
      .map((name) => state.data.countries.find((c) => c.pais === name))
      .filter(Boolean);

    const traces = selected.map((c, idx) => {
      const vals = dims.map((d) => {
        const v = d.get(c);
        return v !== null ? Number(v.toFixed(1)) : 0;
      });
      const theta = [...dims.map((d) => d.label), dims[0].label];
      const r = [...vals, vals[0]];
      const color = RADAR_COLORS[idx % RADAR_COLORS.length];

      return {
        type: "scatterpolar",
        r,
        theta,
        fill: "toself",
        name: c.pais,
        line: { color, width: 2.2 },
        fillcolor: color + "24",
        hovertemplate: `<b>${c.pais}</b><br>%{theta}: %{r:.1f}<extra></extra>`,
      };
    });

    const layout = {
      paper_bgcolor: t.paper_bgcolor,
      plot_bgcolor: t.plot_bgcolor,
      font: t.font,
      margin: { l: 88, r: 92, t: 38, b: 48 },
      polar: {
        bgcolor: "rgba(0,0,0,0)",
        radialaxis: {
          visible: true,
          range: [0, 100],
          gridcolor: t.gridcolor,
          linecolor: t.linecolor,
          tickfont: { size: 10 },
        },
        angularaxis: {
          gridcolor: t.gridcolor,
          linecolor: t.linecolor,
        },
      },
      legend: { orientation: "h", y: -0.14, x: 0.1 },
    };

    Plotly.react("chartRadar", traces, layout, { responsive: true, displayModeBar: false });

    // Tabla comparativa lateral
    const wrap = $("radarComparisonTable");
    if (!selected.length) {
      wrap.innerHTML = "<p class='card-sub'>Selecciona al menos un país.</p>";
      return;
    }

    const headCols = selected.map((c) => `<th class="num">${escapeHtml(c.pais)}</th>`).join("");
    const rowsHtml = [
      { label: "ISID Base", fn: (c) => fmt(c.isid_base, 2) },
      { label: "Heritage 2026", fn: (c) => fmt(c.heritage_2026, 1) },
      { label: "Fraser 2026", fn: (c) => fmt(c.fraser_2026, 2) },
      { label: "Tamaño Estado (F1)", fn: (c) => fmt(c.fraser_tamano_estado, 2) },
      { label: "Individualismo 2023", fn: (c) => fmt(c.hofstede_idv_2023, 0) },
      { label: "GIEM (WVS)", fn: (c) => fmt(c.giem_wvs, 3) },
      { label: "Ley y Orden (Gallup)", fn: (c) => fmt(c.gallup_ley_orden_2025, 0) },
      { label: "Democracia (EIU 25)", fn: (c) => fmt(c.eiu_democracia_2025, 2) },
      { label: "Confianza Social", fn: (c) => (c.confianza_social_wvs !== null ? `${c.confianza_social_wvs}%` : "—") },
    ]
      .map(
        (metric) => `
        <tr>
          <td><strong>${metric.label}</strong></td>
          ${selected.map((c) => `<td class="num">${metric.fn(c)}</td>`).join("")}
        </tr>
      `
      )
      .join("");

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Indicador</th>${headCols}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

  /* =====================
     RENDER: EXCLUIDOS Y #11-#15
     ===================== */
  function renderContextCards() {
    const excluded = state.data.countries
      .filter((c) => !c.cumple_filtro_antiestatista && c.isid_base !== null)
      .sort((a, b) => b.isid_base - a.isid_base);

    $("excludedList").innerHTML = excluded
      .map(
        (c) => `
        <div class="mini-country-row" data-country="${escapeHtml(c.pais)}">
          <div>
            <strong>${escapeHtml(c.pais)}</strong>
            <small>Fraser Estado: ${fmt(c.fraser_tamano_estado, 2)} · IDV: ${fmt(c.hofstede_idv_2023, 0)}</small>
          </div>
          <div class="mono" style="text-align:right;">
            <strong>${fmt(c.isid_base, 2)}</strong>
            <small>sin filtro</small>
          </div>
        </div>
      `
      )
      .join("");

    const contenders = state.data.countries
      .filter((c) => c.ranking_isid_filtrado !== null && c.ranking_isid_filtrado > 10)
      .sort((a, b) => a.ranking_isid_filtrado - b.ranking_isid_filtrado);

    $("contendersList").innerHTML = contenders
      .map(
        (c) => `
        <div class="mini-country-row" data-country="${escapeHtml(c.pais)}">
          <div>
            <strong>#${c.ranking_isid_filtrado} ${escapeHtml(c.pais)}</strong>
            <small>${escapeHtml(c.nota || `Estado: ${fmt(c.fraser_tamano_estado, 2)} · Orden: ${fmt(c.gallup_ley_orden_2025, 0)}`)}</small>
          </div>
          <div class="mono" style="text-align:right;">
            <strong>${fmt(c.isid_base, 2)}</strong>
            <small>ISID base</small>
          </div>
        </div>
      `
      )
      .join("");

    document.querySelectorAll(".mini-country-row").forEach((el) => {
      el.addEventListener("click", () => openCountryModal(el.dataset.country));
    });
  }

  /* =====================
     RENDER: TABLA 34 PAÍSES
     ===================== */
  function getFilteredTableRows() {
    const q = state.tableSearch.trim().toLowerCase();
    const rows = state.data.countries.filter((c) => {
      if (state.tableRegion !== "ALL" && c.region !== state.tableRegion) return false;
      if (state.tableStatus === "PASS" && !c.cumple_filtro_antiestatista) return false;
      if (
        state.tableStatus === "EXCLUDED" &&
        !(!c.cumple_filtro_antiestatista && c.isid_base !== null)
      )
        return false;
      if (state.tableStatus === "PARTIAL" && c.isid_base !== null) return false;

      if (q) {
        const hay = `${c.pais} ${c.country_en} ${c.region} ${c.eje_cultural_iw} ${c.arquetipo || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const key = state.sortKey;
    const dir = state.sortDir === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      const aNull = va === null || va === undefined;
      const bNull = vb === null || vb === undefined;
      if (aNull && bNull) return a.pais.localeCompare(b.pais, "es");
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof va === "string") return va.localeCompare(vb, "es") * dir;
      return (va - vb) * dir;
    });

    return rows;
  }

  function renderTable() {
    const rows = getFilteredTableRows();
    const tbody = $("countriesTbody");

    tbody.innerHTML = rows
      .map((c) => {
        const dotClass = c.cumple_filtro_antiestatista
          ? "dot-pass"
          : c.isid_base !== null
          ? "dot-fail"
          : "dot-na";
        const pos = c.ranking_isid_filtrado !== null ? `#${c.ranking_isid_filtrado}` : "—";
        return `
          <tr data-country="${escapeHtml(c.pais)}">
            <td class="mono">${pos}</td>
            <td><span class="status-dot ${dotClass}"></span><strong>${escapeHtml(c.pais)}</strong></td>
            <td>${escapeHtml(c.region)}</td>
            <td class="num"><strong>${fmt(c.isid_base, 2)}</strong></td>
            <td class="num">${fmt(c.pilar1_libre_mercado, 2)}</td>
            <td class="num">${fmt(c.pilar2_resp_individual, 2)}</td>
            <td class="num">${fmt(c.pilar3_ley_orden, 0)}</td>
            <td class="num">${fmt(c.heritage_2026, 1)}</td>
            <td class="num">${fmt(c.fraser_tamano_estado, 2)}</td>
            <td class="num">${fmt(c.hofstede_idv_2023, 0)}</td>
            <td class="num">${fmt(c.giem_wvs, 3)}</td>
            <td class="num">${fmt(c.eiu_democracia_2025, 2)}</td>
            <td class="num">${c.confianza_social_wvs !== null ? `${c.confianza_social_wvs}%` : "—"}</td>
          </tr>
        `;
      })
      .join("");

    $("tableCountText").textContent = `Mostrando ${rows.length} de ${state.data.countries.length} países`;

    document.querySelectorAll("#countriesTable th.sortable").forEach((th) => {
      th.classList.remove("sorted-asc", "sorted-desc");
      if (th.dataset.sort === state.sortKey) {
        th.classList.add(state.sortDir === "asc" ? "sorted-asc" : "sorted-desc");
      }
    });

    tbody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => openCountryModal(tr.dataset.country));
    });
  }

  function exportFilteredCsv() {
    const rows = getFilteredTableRows();
    const cols = [
      "ranking_isid_filtrado",
      "pais",
      "country_en",
      "region",
      "isid_base",
      "isid_mercado",
      "isid_ley_orden",
      "isid_giem",
      "pilar1_libre_mercado",
      "pilar2_resp_individual",
      "pilar3_ley_orden",
      "heritage_2026",
      "fraser_2026",
      "fraser_tamano_estado",
      "hofstede_idv_2023",
      "giem_wvs",
      "gallup_ley_orden_2025",
      "eiu_democracia_2025",
      "confianza_social_wvs",
      "eje_cultural_iw",
      "cumple_filtro_antiestatista",
    ];
    const csvLines = [
      cols.join(","),
      ...rows.map((r) =>
        cols
          .map((k) => {
            const v = r[k];
            if (v === null || v === undefined) return "";
            const s = String(v);
            return s.includes(",") || s.includes('"') ? `"${s.replaceAll('"', '""')}"` : s;
          })
          .join(",")
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "isid_2026_filtrado.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* =====================
     MODAL FICHA DE PAÍS
     ===================== */
  function openCountryModal(paisName) {
    const c = state.data.countries.find((x) => x.pais === paisName);
    if (!c) return;
    state.modalCountry = c.pais;

    $("modalCountryRegion").textContent = `${c.region} · ${c.country_en}`;
    $("modalCountryTitle").textContent = c.pais;
    $("modalCountrySubtitle").textContent = c.arquetipo
      ? `${c.arquetipo} · Eje cultural: ${c.eje_cultural_iw}`
      : `Eje cultural: ${c.eje_cultural_iw}`;

    const badgeText = c.cumple_filtro_antiestatista
      ? `Cumple filtro antiestatista (Posición #${c.ranking_isid_filtrado})`
      : c.isid_base !== null
      ? "Excluido por Estado expansivo (Fraser Área 1 < 6.0)"
      : "País referente de contexto (sin serie completa de Área 1 / IDV)";

    $("modalBody").innerHTML = `
      <div style="margin-bottom:0.9rem;">
        <span class="badge ${c.cumple_filtro_antiestatista ? "badge-blue" : "badge-warn"}">${badgeText}</span>
      </div>
      <div class="modal-metrics-grid">
        <div class="modal-metric"><span>ISID Base (33/33/33)</span><strong>${fmt(c.isid_base, 2)}</strong></div>
        <div class="modal-metric"><span>ISID Énfasis Mercado</span><strong>${fmt(c.isid_mercado, 2)}</strong></div>
        <div class="modal-metric"><span>ISID Énfasis Orden</span><strong>${fmt(c.isid_ley_orden, 2)}</strong></div>
        <div class="modal-metric"><span>Pilar 1 · Libre Mercado</span><strong>${fmt(c.pilar1_libre_mercado, 2)}</strong></div>
        <div class="modal-metric"><span>Pilar 2 · Resp. Individual</span><strong>${fmt(c.pilar2_resp_individual, 2)}</strong></div>
        <div class="modal-metric"><span>Pilar 3 · Ley y Orden</span><strong>${fmt(c.pilar3_ley_orden, 0)}</strong></div>
        <div class="modal-metric"><span>Heritage 2026</span><strong>${fmt(c.heritage_2026, 1)}</strong></div>
        <div class="modal-metric"><span>Fraser 2026 / Área 1</span><strong>${fmt(c.fraser_2026, 2)} / ${fmt(c.fraser_tamano_estado, 2)}</strong></div>
        <div class="modal-metric"><span>Hofstede IDV 2023</span><strong>${fmt(c.hofstede_idv_2023, 0)}</strong></div>
        <div class="modal-metric"><span>GIEM (WVS / Cato)</span><strong>${fmt(c.giem_wvs, 3)}</strong></div>
        <div class="modal-metric"><span>Democracia EIU 2025</span><strong>${fmt(c.eiu_democracia_2025, 2)}</strong></div>
        <div class="modal-metric"><span>Confianza Social WVS</span><strong>${c.confianza_social_wvs !== null ? c.confianza_social_wvs + "%" : "—"}</strong></div>
      </div>
      ${c.nota ? `<div class="modal-note"><strong>Nota del estudio:</strong> ${escapeHtml(c.nota)}</div>` : ""}
    `;

    $("countryModal").hidden = false;
  }

  function closeModal() {
    $("countryModal").hidden = true;
  }

  /* =====================
     CONTROLES Y EVENTOS
     ===================== */
  function populateSelectors() {
    const regions = state.data.summary.regiones;
    ["regionFilterChart1", "tableRegionFilter"].forEach((id) => {
      const sel = $(id);
      regions.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r;
        sel.appendChild(opt);
      });
    });

    const sortedCountries = [...state.data.countries].sort((a, b) =>
      a.pais.localeCompare(b.pais, "es")
    );

    ["radarCountry1", "radarCountry2", "radarCountry3", "radarCountry4"].forEach(
      (id, idx) => {
        const sel = $(id);
        if (idx >= 2) {
          const noneOpt = document.createElement("option");
          noneOpt.value = "NONE";
          noneOpt.textContent = "— Ninguno —";
          sel.appendChild(noneOpt);
        }
        sortedCountries.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.pais;
          opt.textContent = c.pais;
          sel.appendChild(opt);
        });
        sel.value = state.radarSelection[idx];
        sel.addEventListener("change", () => {
          state.radarSelection[idx] = sel.value;
          renderChartRadar();
        });
      }
    );
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll(".tab-btn").forEach((b) => {
      const active = b.dataset.tab === tabName;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${tabName}`);
    });

    requestAnimationFrame(() => {
      if (tabName === "mercado") renderChartMercado();
      if (tabName === "estado") renderChartEstado();
      if (tabName === "correlaciones") renderChartCorr();
      if (tabName === "radar") renderChartRadar();
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("isid_theme", theme);
    } catch (_) {}
    if (state.data) {
      updateSimulatorUI();
      if (state.activeTab === "mercado") renderChartMercado();
      if (state.activeTab === "estado") renderChartEstado();
      if (state.activeTab === "correlaciones") renderChartCorr();
      if (state.activeTab === "radar") renderChartRadar();
    }
  }

  function bindEvents() {
    // Theme
    $("themeToggle").addEventListener("click", () => {
      applyTheme(isDark() ? "light" : "dark");
    });

    // Presets
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset;
        const p = PRESETS[key];
        if (!p) return;
        state.activePreset = key;
        state.weights = { p1: p.p1, p2: p.p2, p3: p.p3 };
        $("wP1").value = p.slider[0];
        $("wP2").value = p.slider[1];
        $("wP3").value = p.slider[2];
        updateSimulatorUI();
      });
    });

    // Sliders
    ["wP1", "wP2", "wP3"].forEach((id) => {
      $(id).addEventListener("input", () => {
        state.activePreset = "custom";
        state.weights = {
          p1: Number($("wP1").value),
          p2: Number($("wP2").value),
          p3: Number($("wP3").value),
        };
        updateSimulatorUI();
      });
    });

    // Filter toggle & threshold
    $("filterToggle").addEventListener("change", (e) => {
      state.filterEnabled = e.target.checked;
      updateSimulatorUI();
    });

    $("thresholdSlider").addEventListener("input", (e) => {
      state.threshold = Number(e.target.value);
      updateSimulatorUI();
    });

    $("resetSimBtn").addEventListener("click", () => {
      state.activePreset = "base";
      state.weights = { ...PRESETS.base };
      state.filterEnabled = true;
      state.threshold = 6.0;
      $("wP1").value = 33;
      $("wP2").value = 33;
      $("wP3").value = 34;
      $("filterToggle").checked = true;
      $("thresholdSlider").value = 6.0;
      updateSimulatorUI();
    });

    // CTA sin filtro desde sección 4
    $("tryWithoutFilterBtn").addEventListener("click", () => {
      state.filterEnabled = false;
      $("filterToggle").checked = false;
      updateSimulatorUI();
      $("simulador").scrollIntoView({ behavior: "smooth" });
    });

    // Tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Chart 1 region filter
    $("regionFilterChart1").addEventListener("change", (e) => {
      state.chart1Region = e.target.value;
      renderChartMercado();
    });

    // Notebook iframe switcher
    $("notebookChartSelect").addEventListener("change", (e) => {
      $("notebookIframe").src = e.target.value;
      $("notebookChartExternal").href = e.target.value;
    });

    // Explorer controls
    $("tableSearch").addEventListener("input", (e) => {
      state.tableSearch = e.target.value;
      renderTable();
    });
    $("tableRegionFilter").addEventListener("change", (e) => {
      state.tableRegion = e.target.value;
      renderTable();
    });
    $("tableStatusFilter").addEventListener("change", (e) => {
      state.tableStatus = e.target.value;
      renderTable();
    });
    $("downloadCsvBtn").addEventListener("click", exportFilteredCsv);

    document.querySelectorAll("#countriesTable th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "pais" || key === "region" || key === "ranking_isid_filtrado" ? "asc" : "desc";
        }
        renderTable();
      });
    });

    // Modal
    $("closeModalBtn").addEventListener("click", closeModal);
    $("closeModalFooterBtn").addEventListener("click", closeModal);
    $("countryModal").addEventListener("click", (e) => {
      if (e.target === $("countryModal")) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("countryModal").hidden) closeModal();
    });

    $("compareCountryBtn").addEventListener("click", () => {
      if (!state.modalCountry) return;
      if (!state.radarSelection.includes(state.modalCountry)) {
        state.radarSelection[3] = state.modalCountry;
        $("radarCountry4").value = state.modalCountry;
      }
      closeModal();
      switchTab("radar");
      $("cuadros").scrollIntoView({ behavior: "smooth" });
    });
  }

  async function init() {
    const savedTheme = (() => {
      try {
        return localStorage.getItem("isid_theme");
      } catch (_) {
        return null;
      }
    })();
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }

    bindEvents();

    try {
      const resp = await fetch("data/dashboard_data.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      state.data = await resp.json();

      if (state.data.generated_at) {
        const dateStr = state.data.generated_at.slice(0, 10);
        $("generatedAtBadge").textContent = `Datos verificados · ${dateStr}`;
      }

      populateSelectors();
      updateSimulatorUI();
      renderChartMercado();
      renderContextCards();
      renderTable();
    } catch (err) {
      console.error("Error cargando dashboard_data.json:", err);
      $("top10Cards").innerHTML =
        '<p class="card-sub" style="padding:1rem;color:var(--danger);">Error cargando los datos del estudio. Si abres el archivo directamente con file://, ejecútalo mediante un servidor web local (ej. <code>python -m http.server</code>) o en Vercel.</p>';
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
