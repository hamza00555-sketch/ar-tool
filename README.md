# Holoform Studio

A WebAR creator studio: build AR experiences, generate a QR code, scan it with a
phone, and the experience opens **directly in the browser** — no app install.

Built with Next.js (App Router) + TypeScript + Tailwind CSS v4, `<model-viewer>`
for 3D-model AR, and Three.js/WebXR for image, video, and 3D-text AR.

## Features

- **Creator dashboard** — campaign cards with live/draft status, scan counts, and last-viewed time.
- **3-step creation wizard** with template presets (Product Packaging, Exhibition, Business Card, Poster, Training Guide) and a **live 3D preview** while you build.
- **Four content types**: 3D model (.glb/.gltf, optional .usdz for iOS), image/poster, video (upload or hosted URL), and styled 3D text.
- **Public viewer** at `/ar/[id]` — mobile-first start screen, native AR entry where supported, interactive 3D preview + QR prompt as fallback.
- **QR codes** for every experience — PNG and SVG download, copy-link.
- **Analytics** — scans, device / browser / OS breakdowns, recent-scan log, referrer.
- A **bundled sample 3D model** (`public/samples/aurora-knot.glb`, generated procedurally by `scripts/generate-sample-model.mjs`) so you can test AR before uploading anything.
- **Arabic / English UI** — a language toggle in the header (and on the public viewer) switches the whole app, including full RTL layout. The choice persists in the browser. Arabic 3D-text experiences render through a canvas-texture path so the script is shaped correctly.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. A sample experience ("Aurora Knot") is seeded on
first run.

### Testing the full flow

1. Open the dashboard → **New experience**.
2. Pick a type (or a template), add content — upload a file, paste a video URL,
   or type 3D text. Watch the live preview.
3. Fill in title/description → **Create experience**.
4. On the detail page, scan the **Test on phone** QR with your phone camera.
5. The AR viewer opens on the phone; tap **Start AR**.
6. Return to the detail page — the scan appears under **Analytics**.

> **Phone can't open the QR?** The QR encodes the origin you're browsing from.
> `localhost` is unreachable from a phone — run `npm run dev` and open the
> studio via your machine's LAN IP (e.g. `http://192.168.1.20:3000`), or deploy
> to a public URL. Note: iOS camera-AR features generally require HTTPS.

## AR support matrix

| Device / browser | 3D model | Image / video / text |
| --- | --- | --- |
| Android Chrome | Native AR via Scene Viewer / WebXR | WebXR immersive-ar |
| iOS Safari | Quick Look **if a .usdz is attached**, else 3D preview | 3D preview (WebXR AR unavailable in iOS Safari) |
| Desktop | Interactive 3D preview + QR prompt | Interactive 3D preview + QR prompt |

## Architecture

```
src/
  lib/
    types.ts        # Domain types, template preset ids
    i18n.ts         # EN/AR dictionary, locale store, RTL handling
    store.ts        # ExperienceStore interface + JSON-file implementation
    ua.ts           # User-agent → device/browser/OS for analytics
    api.ts          # Client fetch helpers
  app/
    page.tsx                  # Dashboard
    create/page.tsx           # Creation wizard (3 steps + live preview)
    experience/[id]/page.tsx  # Edit, QR / test-on-phone, analytics
    ar/[id]/page.tsx          # Public AR viewer (what the QR opens)
    api/                      # experiences CRUD, upload, file serving, track
  components/
    ARViewerShell.tsx         # Viewer logic: capability detection, fallbacks
    viewers/ModelViewerClient.tsx  # <model-viewer> wrapper (GLB/glTF + AR)
    viewers/PlaneViewer.tsx        # Three.js viewer (image/video/text + WebXR)
    QRPanel.tsx, UploadDropzone.tsx, AnalyticsPanel.tsx, ...
```

**Persistence** is a JSON file (`data/db.json`) behind the `ExperienceStore`
interface; uploads land in `data/uploads/` and are served via `/api/files/*`.
To move to Supabase (or any backend), implement `ExperienceStore` against it
and swap the instance returned by `getStore()` — no UI changes needed.

## Limitations (MVP)

- Single-user, no auth — anyone who can reach the server can edit.
- File-backed storage: works on a single server / local machine; serverless
  platforms with read-only or ephemeral filesystems need the Supabase-style
  store swap first.
- No GLB→USDZ conversion — upload a USDZ manually for iOS native AR on model
  experiences; other types fall back to 3D preview on iOS.
- WebXR plane content floats ~1.3 m in front of you (no tap-to-place yet).
- Analytics events are capped at the 500 most recent per experience
  (totals stay accurate).
- Videos start muted (browser autoplay policy); viewers can unmute in the UI.
- Arabic 3D text renders as a crisp textured plane (browser text shaping)
  rather than extruded geometry — the bundled extrusion font is Latin-only.
