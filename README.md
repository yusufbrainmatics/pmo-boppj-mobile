# PMO BOPPJ Mobile — PWA Kontraktor

Aplikasi web mobile (PWA) untuk pelaporan progres harian proyek BOPPJ oleh kontraktor. Prototype oleh BrainDevs. **Seluruh data adalah data ilustratif (dummy) untuk keperluan demo, bukan data resmi BOPPJ** — disclaimer yang sama tampil di dalam aplikasi.

Stack: Svelte 5 (runes), Vite 8, vite-plugin-pwa, Leaflet dengan tile OpenStreetMap, hash router (`#/...`). Tanpa backend: seluruh data seed berupa JSON di `src/data`.

## Prasyarat

- Node.js ≥ 20
- pnpm ≥ 9 (`npm install -g pnpm@10`)
- Python 3 + `openpyxl` — hanya untuk regenerasi `src/data/proyek.json`
- Apple Silicon: binding `@rolldown/binding-darwin-arm64` sudah ada di devDependencies. Arsitektur lain perlu menambah binding rolldown yang sesuai saat `pnpm install` pertama.

## Menjalankan di lingkungan lokal

```bash
pnpm install
pnpm dev          # http://localhost:5173/m/
```

Login demo: `karno@braindevs.com` / `demo1234`. Seed sudah berisi satu laporan ditolak (`TOL-SMD-01`) untuk mendemokan alur revisi. Untuk uji offline: DevTools → Network → Offline (antrian laporan akan antre dan terkirim saat online kembali).

## Build untuk lingkungan produksi (domain bersama, path `/m/`)

```bash
pnpm build && pnpm preview
```

- Output build: `dist/`. Service worker (offline queue + cache) **hanya aktif di hasil build**, bukan di dev server.
- Base path default `/m/` mengikuti konvensi deployment di domain bersama (web admin menempati `/`). Variabel lingkungan `BASE` bisa meng-override base path untuk mount lain, mis. GitHub Pages.

## Deploy ke GitHub Pages

- Repository: <https://github.com/yusufbrainmatics/pmo-boppj-mobile>
- Aplikasi: <https://yusufbrainmatics.github.io/pmo-boppj-mobile/>

### CI/CD (utama)

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) berjalan otomatis setiap push ke `main`: `pnpm install` → `pnpm build:pages` (`BASE=/pmo-boppj-mobile/`) → deploy hasil `dist/` ke GitHub Pages (build type *workflow*, bukan branch). Trigger manual: tab **Actions** → *Deploy ke GitHub Pages* → **Run workflow**. Verifikasi hasil di URL aplikasi (propagasi biasanya < 2 menit).

Alur awal mengikuti tutorial [stroblp/svelte-gh-pages](https://github.com/stroblp/svelte-gh-pages) yang diadaptasi untuk Vite (output `dist/`, bukan `public/`).

### Rilis manual (fallback)

Jika CI tidak bisa dipakai, kembalikan Pages ke mode branch lalu rilis manual:

```bash
gh api -X PATCH repos/yusufbrainmatics/pmo-boppj-mobile/pages -f build_type=legacy
pnpm deploy:pages   # = build:pages (BASE=/pmo-boppj-mobile/) lalu push dist/ ke branch gh-pages
```

> Catatan: script sengaja dinamai `deploy:pages`, bukan `deploy` — `pnpm deploy` adalah perintah bawaan pnpm (workspace deploy) dan akan menimpa script dengan nama sama.

## Regenerasi data proyek

```bash
python3 scripts/xlsx-to-json.py [path/ke/BOPPJ_Daftar_Proyek_Prototype.xlsx]
```

Tanpa argumen, script mencari workbook di `references/` pada workspace induk (di luar repo ini). Pada clone standalone, berikan path file secara eksplisit. Tahap dan progres proyek berasal dari `src/data/tahap.json`, bukan dari workbook.

## Data

- `src/data/proyek.json` di-generate dari workbook Excel prototype BOPPJ (lihat bagian di atas).
- File seed lainnya (`laporan`, `isu`, `pengetahuan`, `kontraktor`) ditulis manual dan bersifat ilustratif.

## Penyimpanan

- Sesi dan laporan: `sessionStorage` (hilang saat tab ditutup).
- Foto: dikompres ke JPEG, disimpan di IndexedDB maksimal 5 menit (`TTL_MS` di `src/lib/photos.js`), lalu dibersihkan otomatis. Foto **tidak pernah** masuk cache service worker atau `localStorage`.

## Desain dan aksesibilitas

`DESIGN.md` adalah design system terkunci (tokens OKLCH di `src/tokens.css`, palet, daftar layar) — baca sebelum mengubah UI. Target interaksi 44px, `:focus-visible` selalu terlihat, tanpa scroll horizontal pada 320px, dan status tidak pernah hanya ditandai warna.
