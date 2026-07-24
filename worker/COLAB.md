# Run the reconstruction worker on a free GPU (Google Colab)

The easiest way to get **real** 3D reconstructions without owning or paying for
a server: run the worker in a Google Colab notebook, which gives you a free
CUDA GPU in the browser. Good for testing and light use. (For always-on or
heavy use, deploy the Docker image on a real GPU host — see `README.md`.)

This path uses the **COLMAP-only** pipeline (COLMAP's own CUDA dense stereo +
Poisson mesh → vertex-coloured GLB), so there's no OpenMVS build to wait for.

## One-time: set the shared secret on the app

1. Pick a long random string as your `WORKER_TOKEN` (e.g. run `openssl rand -hex 24`).
2. In **Vercel → your project → Settings → Environment Variables**, add
   `WORKER_TOKEN` = that string (Production). **Redeploy** so it takes effect.
3. You'll paste the **same** value into the notebook below.

## The notebook

1. Open <https://colab.research.google.com> → **New notebook**.
2. **Runtime → Change runtime type → Hardware accelerator: GPU → Save.**
3. Paste this into the first cell and run it (installs COLMAP + trimesh and
   downloads the worker):

   ```python
   !apt-get -qq update && apt-get -qq install -y colmap
   !pip -q install trimesh
   !wget -q https://raw.githubusercontent.com/hamza00555-sketch/ar-tool/claude/webar-qr-mvp-4kq7ri/worker/run.py -O run.py
   !nvidia-smi -L    # confirm a GPU is attached
   ```

4. Paste this into a second cell, **fill in your token**, and run it:

   ```python
   import os
   os.environ["APP_URL"] = "https://ar-tool-3sfz.vercel.app"
   os.environ["WORKER_TOKEN"] = "PASTE-THE-SAME-TOKEN-YOU-SET-ON-VERCEL"
   os.environ["FORCE_COLMAP_ONLY"] = "1"   # skip OpenMVS, use COLMAP's mesher
   !python3 run.py
   ```

That cell keeps running and polls for scan jobs. Capture a scan on your phone;
within a few seconds the worker claims it, you'll see COLMAP's progress in the
cell output, and when it finishes your phone's "Building your 3D model" screen
flips to the finished experience. Stop it with the cell's ■ button.

## Notes & troubleshooting

- **Keep the tab open** — closing it (or Colab's idle timeout) stops the worker.
  Scans you capture while it's stopped just wait in the queue until it's back.
- **`patch_match_stereo` says "not compiled with CUDA":** the apt COLMAP build
  lacks GPU support on that runtime. Easiest fix: use the Docker/RunPod path in
  `README.md` (the `colmap/colmap` image is CUDA-enabled), or a Colab COLMAP
  build with CUDA.
- **"COLMAP could not reconstruct":** too few overlapping photos or a shiny/
  plain object. Recapture with more overlap (~70%) and a matte, textured item.
- **Quality:** the COLMAP-only path gives a vertex-coloured mesh (no texture
  atlas). For sharper, textured results use the OpenMVS Docker image.
