# Multi-Campaign + Full Wheel Theming

Big architectural change. I'll ship in 4 waves so each one is testable.

---

## Wave 1 — Small fixes (already done in this message)

- Removed near-miss "cheat" animation; spin is now a single smooth 9-second deceleration.
- Win-card background changed from dark navy to light cream → soft-blue gradient, navy text, navy logo ring.
- Demo-wheel-on-landing item dropped (you already have one).
- WhatsApp button labeling: I'll rename "Share Card" → "Send Prize Photo on WhatsApp" and keep the text-only `wa.me` button as "Send Text Receipt", so it's obvious which one carries the image. (`wa.me` cannot auto-attach images — that's a WhatsApp limitation, not a code limitation.)

---

## Wave 2 — Multi-campaign database + public routing

**New table `campaigns`:**

| column | type | notes |
|---|---|---|
| id | uuid | pk |
| shop_id | uuid | fk shops |
| name | text | "Diwali Spin", "Weekend Bonanza" |
| slug | text | URL slug, unique per shop |
| is_active | bool | live or paused |
| theme | jsonb | accent color, slice colors, pointer style, rim style, font, bg image, center logo override |
| created_at, updated_at | timestamptz | |

**`prizes` and `access_codes`: add `campaign_id` column.** Existing rows migrate into a default "Main Campaign" per shop so nothing breaks.

**Public routing:**
- `/s/{slug}` — landing page that lists all active campaigns as cards (customer picks one).
- `/s/{slug}/c/{campaignSlug}` — the actual spin page for that campaign.
- Per-campaign QR codes auto-generated in the dashboard.

**RLS:** campaigns table — owners full CRUD on their own; anon read of active campaigns only.

---

## Wave 3 — Campaign Hub UI in the dashboard

- Campaign list with "+ New Campaign" button, active/paused toggle, duplicate, delete.
- Per-campaign editor with tabs: Prizes · Wheel Design · QR Code · Settings.
- "Wheel Design" tab — full custom controls:
  - Accent color picker
  - Wheel background image upload (Lovable Assets)
  - Per-slice color overrides (default = auto-palette from accent)
  - Pointer style (classic, arrow, gem)
  - Rim style (dots, glow, smooth, none)
  - Font (3 preset choices)
  - Center logo override (per campaign)
- **Live interactive preview pane** — embeds the real public spin page in an iframe with `?preview=1`. Owner can click-spin; preview spins ignore access codes and never record stats.

---

## Wave 4 — Wheel renderer + theming engine

- Refactor `SpinWheel.tsx` to read a `WheelTheme` object instead of hardcoded navy/light-blue.
- New `auto-palette` util: given an accent hex, generate a balanced N-slice palette.
- Wheel background image renders behind the wheel SVG (with subtle blur/dim for legibility).
- New `BrandThemeProvider` so the spin page's CSS vars come from the active campaign's theme.

---

## Technical notes

- All schema changes go through one migration with GRANTs and RLS.
- Existing `validateAccessCode`, `spinAndRecord`, `prizesBySlug` server fns get a `campaignSlug` parameter (backward-compatible: falls back to the shop's default campaign).
- Storage bucket `wheel-backgrounds` (public, owner-write via RLS).
- No breaking changes to existing shops — auto-migrated to a "Main Campaign".

---

## What I need from you

Confirm and I'll start Wave 2 immediately. If you want to cut scope (e.g. skip per-slice colors, or ship single-campaign theming first), tell me now.
