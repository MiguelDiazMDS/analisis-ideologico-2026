"""
Monitor de frescura de fuentes para actualización periódica del estudio ISID.

Comprueba disponibilidad y cabeceras Last-Modified / ETag de las fuentes
abiertas (Our World in Data para EIU Democracia y WVS Confianza Social) y
las páginas oficiales de informes anuales (Heritage, Fraser, Gallup, Cato,
Culture Factor), generando data/source_status.json.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "source_status.json"

SOURCES = [
    {
        "id": "owid_democracy_eiu",
        "nombre": "EIU Democracy Index (vía Our World in Data)",
        "cadencia": "Anual (febrero-marzo)",
        "automatizable": "Alta (CSV directo OWID)",
        "url": "https://ourworldindata.org/grapher/democracy-index-eiu.csv?v=1&csvType=filtered&useColumnShortNames=true",
    },
    {
        "id": "owid_trust_wvs",
        "nombre": "Confianza Interpersonal WVS/IVS (vía Our World in Data)",
        "cadencia": "Por oleadas (cada 3-5 años)",
        "automatizable": "Alta (CSV directo OWID)",
        "url": "https://ourworldindata.org/grapher/self-reported-trust-attitudes.csv?v=1&csvType=filtered&useColumnShortNames=true",
    },
    {
        "id": "heritage_ief",
        "nombre": "The Heritage Foundation — Index of Economic Freedom",
        "cadencia": "Anual (febrero-marzo)",
        "automatizable": "Media (descarga Excel/CSV anual)",
        "url": "https://www.heritage.org/index/",
    },
    {
        "id": "fraser_efw",
        "nombre": "Fraser Institute — Economic Freedom of the World",
        "cadencia": "Anual (septiembre-octubre)",
        "automatizable": "Media (descarga XLSX/CSV anual)",
        "url": "https://www.fraserinstitute.org/studies/economic-freedom",
    },
    {
        "id": "gallup_safety",
        "nombre": "Gallup — Global Safety Report (Law & Order Index)",
        "cadencia": "Anual (septiembre-noviembre)",
        "automatizable": "Baja (informe PDF / tabla web)",
        "url": "https://www.gallup.com/analytics/356963/gallup-global-law-and-order-report.aspx",
    },
    {
        "id": "cato_giem_hfi",
        "nombre": "Cato Institute — GIEM y Human Freedom Index",
        "cadencia": "Anual (HFI) / Periódico (GIEM)",
        "automatizable": "Media (dataset CSV descargable)",
        "url": "https://www.cato.org/human-freedom-index",
    },
    {
        "id": "culture_factor_idv",
        "nombre": "The Culture Factor / Hofstede — Individualism Score",
        "cadencia": "Discrecional (última revisión mayor: 2023)",
        "automatizable": "Baja (revisión manual)",
        "url": "https://www.theculturefactor.com/country-comparison-tool",
    },
]


def check_url(url: str) -> dict:
    req = Request(url, method="HEAD", headers={"User-Agent": "ISID-2026-Monitor/1.0"})
    try:
        with urlopen(req, timeout=15) as resp:
            return {
                "ok": True,
                "status": resp.status,
                "last_modified": resp.headers.get("Last-Modified"),
                "etag": resp.headers.get("ETag"),
            }
    except URLError as exc:
        return {"ok": False, "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def main() -> None:
    results = []
    for src in SOURCES:
        status = check_url(src["url"])
        results.append({**src, "check": status})

    report = {
        "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": results,
    }
    OUT_PATH.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    ok_count = sum(1 for r in results if r["check"].get("ok"))
    print(f"Fuentes verificadas: {ok_count}/{len(results)} accesibles -> {OUT_PATH}")


if __name__ == "__main__":
    main()
