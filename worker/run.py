#!/usr/bin/env python3
"""
Holoform Studio — self-hosted 3D reconstruction worker.

Speaks the same API contract as the mock worker (scripts/mock-scan-worker.mjs):
it claims a queued scan job, downloads the captured frames, runs the
photogrammetry pipeline (COLMAP structure-from-motion -> OpenMVS dense mesh +
texture), converts the textured mesh to a GLB, uploads it through the app's
normal signed-upload flow, and reports completion. On any failure it reports
the error back so the job is marked failed (not stuck).

The heavy lifting is done by external binaries, so this stays a thin,
readable orchestrator:
  colmap            structure-from-motion (needs a CUDA GPU for feature work)
  OpenMVS           DensifyPointCloud / ReconstructMesh / TextureMesh
  obj2gltf (npm)    textured OBJ -> GLB

Run it on a machine with a GPU (see worker/README.md). It only needs outbound
HTTPS to the app — no inbound ports — so it works behind NAT.

Env:
  APP_URL         base URL of the deployed app (e.g. https://ar-tool.vercel.app)
  WORKER_TOKEN    shared secret, must match the app's WORKER_TOKEN
  POLL_SECONDS    idle poll interval (default 5)
  WORK_DIR        scratch dir (default ./_scan_work)
  COLMAP_BIN, OPENMVS_BIN_DIR, OBJ2GLTF_BIN   override binary locations
"""
import os
import sys
import time
import json
import shutil
import subprocess
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

APP_URL = os.environ.get("APP_URL", "http://localhost:3100").rstrip("/")
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "")
POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "5"))
WORK_DIR = Path(os.environ.get("WORK_DIR", "./_scan_work")).resolve()

COLMAP_BIN = os.environ.get("COLMAP_BIN", "colmap")
OPENMVS_BIN_DIR = os.environ.get("OPENMVS_BIN_DIR", "")  # dir holding DensifyPointCloud etc.
OBJ2GLTF_BIN = os.environ.get("OBJ2GLTF_BIN", "obj2gltf")

ONCE = "--once" in sys.argv


# --------------------------------------------------------------------------- #
# App API
# --------------------------------------------------------------------------- #
def _req(method, path, body=None, headers=None, token=True):
    url = path if path.startswith("http") else f"{APP_URL}{path}"
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    if token:
        hdrs["x-worker-token"] = WORKER_TOKEN
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode() or "{}")


def claim_job():
    return _req("POST", "/api/scan/worker/claim").get("job")


def complete_job(job_id, **fields):
    return _req("POST", "/api/scan/worker/complete", {"id": job_id, **fields})


def upload_result(data: bytes, name: str, kind: str, content_type: str) -> str:
    """Upload through the app's public sign->PUT flow (same as the browser)."""
    sign = _req(
        "POST", "/api/upload/sign",
        {"name": name, "size": len(data), "kind": kind}, token=False,
    )
    if sign.get("mode") == "supabase":
        put = urllib.request.Request(
            sign["uploadUrl"], data=data, method="PUT",
            headers={"Content-Type": sign["contentType"], "x-upsert": "false"},
        )
        urllib.request.urlopen(put, timeout=300).read()
        return sign["publicUrl"]
    # local dev fallback: multipart to /api/upload
    boundary = "----holoformworker"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{name}"\r\n'.encode()
    body += f"Content-Type: {content_type}\r\n\r\n".encode() + data + b"\r\n"
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="kind"\r\n\r\n' + kind.encode() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        f"{APP_URL}/api/upload", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=300) as res:
        return json.loads(res.read().decode())["url"]


# --------------------------------------------------------------------------- #
# Reconstruction pipeline
# --------------------------------------------------------------------------- #
def run(cmd, cwd=None):
    print("  $", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=cwd, check=True)


def openmvs(tool):
    return os.path.join(OPENMVS_BIN_DIR, tool) if OPENMVS_BIN_DIR else tool


def download_frames(frame_urls, images_dir: Path):
    images_dir.mkdir(parents=True, exist_ok=True)
    first = None
    for i, url in enumerate(frame_urls):
        full = url if url.startswith("http") else f"{APP_URL}{url}"
        dest = images_dir / f"frame_{i:04d}.jpg"
        urllib.request.urlretrieve(full, dest)
        if first is None:
            first = dest.read_bytes()
    return first


def reconstruct(job, work: Path) -> Path:
    """Run COLMAP + OpenMVS. Returns the path to a textured GLB."""
    images = work / "images"
    first_frame = download_frames(job["frameUrls"], images)
    print(f"  downloaded {len(list(images.glob('*.jpg')))} frames", flush=True)

    db = work / "database.db"
    sparse = work / "sparse"
    dense = work / "dense"
    sparse.mkdir(exist_ok=True)
    dense.mkdir(exist_ok=True)

    # 1) COLMAP structure-from-motion
    run([COLMAP_BIN, "feature_extractor",
         "--database_path", db, "--image_path", images,
         "--ImageReader.single_camera", "1"])
    run([COLMAP_BIN, "exhaustive_matcher", "--database_path", db])
    run([COLMAP_BIN, "mapper",
         "--database_path", db, "--image_path", images, "--output_path", sparse])
    # mapper writes sparse/0
    model0 = sparse / "0"
    if not model0.exists():
        raise RuntimeError("COLMAP could not reconstruct — too few overlapping frames "
                           "or weak texture. Recapture with more overlap and detail.")
    run([COLMAP_BIN, "image_undistorter",
         "--image_path", images, "--input_path", model0,
         "--output_path", dense, "--output_type", "COLMAP"])

    # 2) OpenMVS dense mesh + texture
    run([openmvs("InterfaceCOLMAP"), "-i", dense, "-o", dense / "scene.mvs",
         "--image-folder", dense / "images"])
    run([openmvs("DensifyPointCloud"), dense / "scene.mvs"], cwd=dense)
    run([openmvs("ReconstructMesh"), dense / "scene_dense.mvs",
         "--decimate", "0.5"], cwd=dense)
    run([openmvs("TextureMesh"), dense / "scene_dense_mesh.mvs",
         "--export-type", "obj", "-o", dense / "model.obj"], cwd=dense)

    obj = dense / "model.obj"
    if not obj.exists():
        raise RuntimeError("OpenMVS did not produce a textured mesh.")

    # 3) OBJ (+ mtl + texture) -> GLB
    glb = work / "model.glb"
    run([OBJ2GLTF_BIN, "-i", obj, "-o", glb, "--binary"])
    if not glb.exists():
        raise RuntimeError("obj2gltf did not produce a GLB.")

    # stash the first frame as a thumbnail
    if first_frame:
        (work / "thumb.jpg").write_bytes(first_frame)
    return glb


# --------------------------------------------------------------------------- #
# Job loop
# --------------------------------------------------------------------------- #
def process(job):
    job_id = job["id"]
    print(f"[worker] claimed {job_id} — {len(job['frameUrls'])} frames", flush=True)
    work = Path(tempfile.mkdtemp(prefix=f"scan_{job_id}_", dir=WORK_DIR))
    try:
        glb = reconstruct(job, work)
        glb_url = upload_result(glb.read_bytes(), f"scan-{job_id}.glb",
                                "model", "model/gltf-binary")
        thumb_url = None
        thumb = work / "thumb.jpg"
        if thumb.exists():
            thumb_url = upload_result(thumb.read_bytes(), f"scan-{job_id}.jpg",
                                      "image", "image/jpeg")
        out = complete_job(job_id, glbUrl=glb_url, thumbnailUrl=thumb_url)
        print(f"[worker] done {job_id} -> experience {out.get('experienceId')}", flush=True)
    except subprocess.CalledProcessError as e:
        msg = f"Reconstruction step failed: {e}"
        print(f"[worker] FAILED {job_id}: {msg}", flush=True)
        complete_job(job_id, error=msg[:400])
    except Exception as e:  # noqa: BLE001 — report anything back so the job isn't stuck
        print(f"[worker] FAILED {job_id}: {e}", flush=True)
        complete_job(job_id, error=str(e)[:400])
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main():
    if not WORKER_TOKEN:
        sys.exit("WORKER_TOKEN is required (must match the app's WORKER_TOKEN).")
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[worker] polling {APP_URL} every {POLL_SECONDS}s", flush=True)
    while True:
        try:
            job = claim_job()
        except urllib.error.HTTPError as e:
            print(f"[worker] claim HTTP {e.code}: {e.read().decode()[:200]}", flush=True)
            job = None
        except Exception as e:  # noqa: BLE001
            print(f"[worker] claim error: {e}", flush=True)
            job = None

        if job:
            process(job)
            if ONCE:
                return
        else:
            if ONCE:
                print("[worker] no queued job", flush=True)
                return
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
