# Multi-tenant Spin Platform

Convert the current single-shop app into a SaaS where any shop owner can sign up, brand their own spin page, and manage their own prizes, codes, and records — fully isolated. You get a super-admin panel.

## What customers/owners will see

- `/` — Marketing landing page with "Create your shop" and "Sign in" buttons.
- `/auth` — Email + password sign up / sign in for shop owners.
- `/dashboard` — Shop owner control panel (replaces today's `/admin`). Tabs: **Prizes**, **Access Codes**, **Records**, **Settings** (shop name, logo, slug).
- `/s/{shop-slug}` — Public customer page for that shop (replaces today's `/`). Shows the shop's own logo, name, and prizes; customer enters name + access code.
- `/s/{shop-slug}/spin` and `/s/{shop-slug}/result` — Spin and result pages branded per shop.
- `/super-admin` — Hidden page (5-second logo press on `/`, plus password) where you list all shops, view usage, suspend/enable, and delete.

## Data model (new tables, fully isolated per shop)

- `shops` — id, owner_user_id, name, slug (unique), logo_url, is_active, created_at.
- `user_roles` — for `super_admin` role (separate table per security rules).
- Existing `prizes` and `access_codes` get a `shop_id` column; all queries scoped by it.
- RLS: shop owners can only read/write rows where `shop_id` belongs to a shop they own. Public customer page reads prizes via a server function scoped by slug. Super-admin bypasses via `has_role(uid, 'super_admin')`.

## Auth

- Lovable Cloud email + password, plus Google sign-in (default per platform guidelines).
- On signup, owner picks a shop name and slug; a `shops` row is created and linked.
- `/dashboard` and `/super-admin` live under the managed `_authenticated` layout.

## Branding / customization

- Settings tab lets the owner upload a logo (stored as base64 in `shops.logo_url`, same approach as prizes today, 10 MB cap) and edit shop name + slug.
- Customer-facing pages read these from the `shops` row by slug.

## Super-admin panel

- Lists all shops with owner email, # codes, # spins, created date.
- Actions: suspend (sets `is_active=false`, customer page shows "unavailable"), reactivate, delete shop (cascades prizes/codes/records).
- Protected by `has_role(uid, 'super_admin')`. You'll grant yourself the role on first login.

## Migration of existing data

Your current Mas Mobile Zone prizes and any unused codes are migrated into a seed shop (`mas-mobile-zone` slug) owned by the first super-admin account you sign up with, so nothing is lost.

## Technical notes

- New routes: `/auth`, `/_authenticated/dashboard`, `/_authenticated/super-admin`, `/s/$slug`, `/s/$slug/spin`, `/s/$slug/result`. Old `/admin`, `/spin`, `/result`, `/` rewired or removed.
- Server functions split into `shops.functions.ts`, scoped `prizes.functions.ts`, scoped `access-codes.functions.ts` — all use `requireSupabaseAuth` + a `shop_id` check, except public `getPublicShop(slug)` and `validateAccessCode(slug, code)` which use the publishable-key server client with narrow `TO anon` policies.
- `ADMIN_PASSWORD` secret is no longer needed for shop owners (auth replaces it); kept only as a fallback for super-admin bootstrap if you want.

## Out of scope (ask later)

- Billing / paid plans
- Custom domains per shop
- Email notifications to owners
- Per-shop sound/theme customization beyond logo

Approve and I'll build it end-to-end.