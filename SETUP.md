# Holoform Studio — Production Setup Guide

This app runs in one of two storage modes, selected automatically by
environment variables:

| Mode | When | Data | Uploads | Works on Vercel? |
|---|---|---|---|---|
| **supabase** (production) | `SUPABASE_URL` + `SUPABASE_SECRET_KEY` set | Postgres (`experiences`, `scans`) | Supabase Storage bucket, direct browser→Storage uploads | ✅ |
| **local** (development) | no Supabase vars | `data/db.json` on disk | `data/uploads/` on disk | ❌ — serverless filesystems are read-only and ephemeral |

The dashboard shows an amber **"Local dev mode"** banner whenever the app is
not connected to Supabase.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project** (any name, e.g.
   `holoform-ar`). The free tier is enough for an MVP.
   *Free-tier note: an organization can have at most 2 active free projects.*
2. Wait for the project to finish provisioning.

## 2. Create the tables + storage bucket

Open **SQL Editor** in the Supabase dashboard, paste the contents of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.

That single script creates:

- **`experiences`** — id, title, description, `type`
  (`model3d`/`image`/`video`/`text3d`), `status` (`draft`/`published`),
  `asset_url`, `asset_type`, `usdz_url`, `thumbnail_url`, `config jsonb`
  (3D-text content/styling + original filename), denormalized `total_views`
  and `last_viewed_at`, timestamps.
- **`scans`** — one row per public AR-page view: `experience_id`,
  `device_type`, `os`, `browser`, `referrer`, `user_agent`, `created_at`.
- **`record_scan()`** — function that inserts a scan and bumps the counters
  atomically.
- **`ar-assets`** storage bucket — public read, 50 MB per-file limit.
- **RLS enabled** on both tables with **no anon policies**: the server talks
  to the database with the secret key only, so browser-held keys can never
  read or write your data. (When you add user accounts later, replace this
  with per-owner policies.)

## 3. Environment variables

Copy `.env.example` to `.env.local` (for local dev) and set the same values
in Vercel → Project → Settings → Environment Variables:

| Variable | Where to find it | Notes |
|---|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | Project Settings → API keys | The `sb_secret_…` secret key, or the legacy `service_role` JWT. **Server-only — never `NEXT_PUBLIC_`.** |
| `SUPABASE_STORAGE_BUCKET` | — | `ar-assets` (default; only set if you renamed it) |
| `NEXT_PUBLIC_APP_URL` | Your deployed domain | e.g. `https://holoform.vercel.app`. QR codes/share links use this. Must be HTTPS. |

## 4. Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

- **Without** `.env.local` → local dev mode (JSON file). Fine for building
  experiences and previewing in 3D on this machine.
- **With** `.env.local` → full production behavior against your Supabase
  project, including direct-to-Storage uploads.

## 5. Deploy to Vercel

```bash
npx vercel        # or connect the GitHub repo in the Vercel dashboard
```

1. Import the repo in <https://vercel.com/new> (framework auto-detected:
   Next.js).
2. Add the four environment variables above (Production + Preview).
3. Deploy. Set `NEXT_PUBLIC_APP_URL` to the resulting domain and redeploy
   once so QR codes embed the final URL.

## 6. Test with a real phone

1. Open the deployed dashboard on your laptop.
2. Create an experience (use **"Use the bundled sample model"** for an
   instant 3D model).
3. On the experience page, scan the **Test on phone** QR with the phone
   camera.
4. Phone opens `https://…/ar/<id>` → tap **Start AR**.
   - **Android (Chrome)** → real AR via Scene Viewer / WebXR.
   - **iPhone/iPad (Safari)** → Quick Look AR for 3D models (best with an
     uploaded USDZ; without one, model-viewer attempts on-device conversion);
     image/video/text fall back to an interactive 3D preview (iOS Safari has
     no WebXR).
5. Refresh the experience page on the laptop — the scan appears under
   **Analytics** (stored in the `scans` table).

> **Why HTTPS matters:** browsers only expose the camera and WebXR
> (`navigator.xr`) in a secure context. `http://localhost` from another
> device is not reachable *and* not secure — a deployed URL (or a tunnel
> like `ngrok`/`cloudflared`) is required for phone testing.

## Current limitations

- **No authentication** — anyone with the dashboard URL can create/edit.
  RLS protects against direct DB access, but the app's own API is open.
  Add Supabase Auth before sharing the dashboard URL publicly.
- **GLB→USDZ conversion** is not automatic; upload a USDZ for guaranteed
  native iOS AR on model experiences.
- **iOS image/video/text** experiences show a 3D preview (no WebXR in iOS
  Safari; true AR for those types needs USDZ generation or a commercial
  WebAR SDK).
- **50 MB per file** (bucket limit; also the Supabase free-tier default cap).
- WebXR plane content floats ~1.3 m ahead (no tap-to-place hit-test yet).
- Analytics counts every page view, including your own previews.
