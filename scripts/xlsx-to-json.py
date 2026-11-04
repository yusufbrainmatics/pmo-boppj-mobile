"""Rebuild src/data/proyek.json from the BOPPJ prototype workbook.

Names, groups, regions and WGS84 coordinates come from the Excel file.
Stage and progress are not in the workbook; they come from src/data/tahap.json
(taken from the dashboard mockup in the BD-PRODUCT document).

Usage: python3 scripts/xlsx-to-json.py [path/to/BOPPJ_Daftar_Proyek_Prototype.xlsx]
"""
import json, sys
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parent.parent
xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parents[2] / "references" / "BOPPJ_Daftar_Proyek_Prototype.xlsx"
tahap = json.loads((root / "src/data/tahap.json").read_text())

ws = openpyxl.load_workbook(xlsx, data_only=True).active
rows = [r for r in ws.iter_rows(values_only=True) if isinstance(r[0], int)]
out = []
for _, kode, nama, kel, kab, prov, lat, lng, *_ in rows:
    assert kode in tahap, f"{kode} missing in tahap.json"
    assert -11 < lat < -5 and 105 < lng < 115, f"{kode} coordinate outside Java: {lat},{lng}"
    out.append(dict(kode=kode, nama=nama, kelompok=kel, kabupaten=kab, provinsi=prov,
                    lat=lat, lng=lng, **tahap[kode]))
assert len(out) == 22, f"expected 22 projects, got {len(out)}"
(root / "src/data/proyek.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(out)} projects from {xlsx.name}")
