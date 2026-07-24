# 3D Reconstruction Worker (self-hosted)

This is the second half of Holoform Studio's **3D Scan** feature. The web app
captures photos of a real object and queues a **scan job**; this worker turns
those photos into a 3D model (GLB) using open-source photogrammetry and reports
the result back. There is **no per-scan cloud cost** — you run it on your own
GPU machine.

```
 Browser (capture)  ──►  App /api/scan (queue)  ◄── poll ── Worker (this)
                                  ▲                              │
                                  └──── completes with GLB ◄─────┘
                                        (COLMAP → OpenMVS → GLB)
```

The worker only makes **outbound HTTPS** calls to the app, so it works behind
NAT / a home connection — no inbound ports, no public URL needed.

## What it runs

| Stage | Tool | Output |
|-------|------|--------|
| Structure-from-motion | **COLMAP** (CUDA) | camera poses + sparse points |
| Dense cloud + mesh + texture | **OpenMVS** | textured `.obj` |
| Mesh → GLB | **obj2gltf** | `model.glb` |

The GLB becomes a normal `model` experience in the app, so iOS Quick Look
(model-viewer converts the static GLB to USDZ on-device), Android Scene Viewer,
decorations, and audio all work on it automatically.

## Quickest start: free GPU on Google Colab

No server to own or pay for — run the worker in a Colab notebook (free CUDA
GPU) using the COLMAP-only pipeline. See **[COLAB.md](./COLAB.md)**. Best for
testing; use the Docker path below for always-on / heavy use.

## Requirements

- An **NVIDIA GPU** with recent drivers + the NVIDIA Container Toolkit
  (COLMAP's feature extraction/matching wants CUDA; CPU-only works but is slow).
- Docker, or a machine with COLMAP + OpenMVS + Node already installed.

## Run with Docker (easiest)

```bash
# from the repo root
docker build -t holoform-worker ./worker

docker run --gpus all --rm \
  -e APP_URL=https://your-app.vercel.app \
  -e WORKER_TOKEN=your-shared-secret \
  holoform-worker
```

`WORKER_TOKEN` **must match** the `WORKER_TOKEN` env var set on the app (Vercel).
That shared secret is the only thing authorizing the worker to claim jobs and
post results — keep it private, and rotate it if it leaks.

Leave the container running; it polls for jobs every few seconds. Scale by
running more than one container — jobs are claimed atomically (`SKIP LOCKED`),
so two workers never grab the same job.

## Run without Docker

If you already have COLMAP and OpenMVS built:

```bash
pip install --upgrade pip           # run.py uses only the Python stdlib
npm install -g obj2gltf

APP_URL=https://your-app.vercel.app \
WORKER_TOKEN=your-shared-secret \
COLMAP_BIN=colmap \
OPENMVS_BIN_DIR=/path/to/openMVS/bin \
python3 worker/run.py
```

Add `--once` to process a single job and exit (useful for testing).

## Environment variables

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `APP_URL` | ✅ | `http://localhost:3100` | Deployed app base URL |
| `WORKER_TOKEN` | ✅ | — | Shared secret; must match the app |
| `POLL_SECONDS` | | `5` | Idle poll interval |
| `WORK_DIR` | | `./_scan_work` | Scratch dir for each job |
| `COLMAP_BIN` | | `colmap` | COLMAP binary |
| `OPENMVS_BIN_DIR` | | (PATH) | Dir with `DensifyPointCloud`, … |
| `OBJ2GLTF_BIN` | | `obj2gltf` | obj2gltf binary (OpenMVS path) |
| `FORCE_COLMAP_ONLY` | | — | Set to `1` to skip OpenMVS and use COLMAP's own dense+Poisson mesh (needs `pip install trimesh`). Auto-used when OpenMVS isn't found. |

## Testing the pipeline without a GPU

Use the **mock worker** at `scripts/mock-scan-worker.mjs`. It speaks the exact
same API contract but returns the bundled sample model instead of running
photogrammetry — so you can verify the whole capture → job → experience loop
end-to-end locally:

```bash
APP_URL=http://localhost:3100 WORKER_TOKEN=dev-token \
  node scripts/mock-scan-worker.mjs
```

## Capture tips (for good reconstructions)

- 20–40 photos in a full circle; add a higher and a lower ring for the top/bottom.
- Bright, even lighting; keep the object filling the frame.
- Lots of overlap between consecutive shots (~70%).
- Matte, textured objects reconstruct best. Shiny, transparent, or plain
  single-colour surfaces give COLMAP too few features and the job will fail
  with a clear message.
