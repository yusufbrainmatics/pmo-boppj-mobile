# DESIGN.md — PMO Kontraktor (PWA)

Locked design system for `apps/mobile`. Every page reads this file; amend it here before deviating in a page.

## Purpose and tone
A contractor reports daily progress on a Pantura project in under two minutes, one-handed, possibly offline, in sun glare. Every screen serves one decision: report, fix, or escalate.
Tone: firm and modern, semi-rigid. Genre: modern-minimal. Not a copy of the BD-PRODUCT mockups; those are the functional reference, this is the improved layout.

## Tokens (`src/tokens.css`, OKLCH, locked)
Pages reference `var(--color-*)`, `var(--space-*)`, `var(--text-*)`, `var(--radius-*)` only. Raw hex or rgb in a page or component is a defect (Leaflet reads tokens via `getComputedStyle`).

| Role | Token | Hex (source) | Use |
|---|---|---|---|
| Structure | `navy` / `navy-2` | `#002C75` / `#0B3F96` | Header, tab bar; navy-2 for header chips and wave motif |
| Action | `blue` / `blue-soft` | `#0351C0` / `#E6EDFA` | Primary buttons, links, progress fill, info tint |
| Accent (one) | `gold` | `#F5AD01` | The raised Input button and the "needs action" dot. Nothing else. |
| Surface | `paper` / `card` / `line` / `track` | `#F3F5F9` / `#FFF` / `#D5DBE6` / `#E1E6F0` | Page, cards, hairlines, bar tracks |
| Text | `ink` / `muted` | `#0F172A` / `#475569` | 17.9:1 / 6.9:1 on paper |
| On navy | `on-navy` / `on-navy-idle` | `#FFF` / `#B9C7E6` | 13:1 / 7.7:1 on navy |
| Status | `ok` `wait` `bad` (+ `-bg`) | `#1F6B10` `#8A4B00` `#B42318` | Always icon + word + colour |

Brand colours measured from `boppj.go.id` and the Dewan Pengarah logos. Contrast pairs verified with the antislop-human checker.

## Type
Inter Variable (self-hosted, Latin subset), tabular numerals. Roman only, no italics. Title 1.75rem/800, stat 2.25rem/800, body 1rem.

## Shell
- **Header, large (tab pages):** navy, 28px rounded bottom, brand chip + avatar row, big title, one-line subtitle, wave motif (the sea wall) in `navy-2` at low contrast. The first surface of the page overlaps the header (`main.tarik`).
- **Header, compact (detail pages):** sticky, round back button, title inline, 18px rounded bottom.
- **Tab bar:** navy, 28px rounded top, 26px icons, 12px/600 labels, single-line. Order: Proyek, Riwayat, **Input (raised 72px gold button)**, Pustaka, Lainnya. Input is the daily primary action, so it is the only enlarged item. "Pustaka" is the tab label for the Pengetahuan page so every label fits one line at 320px.
- Offline: a pill in the header, plus queued reports (`ANTRE`) that sync on reconnect.

## Shape and depth
Radius: 6 badges, 12 inputs/buttons, 18 cards, 28 header/tab bar, pill only for chips. Flat. One elevation: the raised Input button (and the map sheet). No glass, glow, or gradients.

## Screens (13)
Login · Proyek Saya (today summary + project cards with plan marker) · Detail Proyek (Kurva-S) · Input Progres (4 section cards, ±1% stepper) · Riwayat (grouped by date) · Detail Laporan · Revisi · Lapor Isu · Peta (full-bleed + sheet) · Pengetahuan (Pustaka) · Artikel · Tulis Pertanyaan · Lainnya.

## Data and storage
- JSON under `src/data` (illustrative, labelled). `proyek.json` is generated from the BOPPJ Excel (see README).
- Session and reports in `sessionStorage`. Photos: compressed JPEG ≤1280px in IndexedDB, 5-minute expiry, swept every 15s, never in the service worker cache.

## Human checks
Targets ≥44px, `:focus-visible` ring everywhere, labelled fields with inline text errors, `prefers-reduced-motion` honoured, no horizontal scroll at 320px, nav labels one line.
