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


def has_openmvs() -> bool:
    """OpenMVS present? If not, we fall back to COLMAP's own dense+mesh path."""
    if os.environ.get("FORCE_COLMAP_ONLY"):
        return False
    return shutil.which(openmvs("DensifyPointCloud")) is not None


def colmap_sfm(images: Path, work: Path) -> Path:
    """Shared front half: features -> match -> map -> undistort. Returns dense dir."""
    db = work / "database.db"
    sparse = work / "sparse"
    dense = work / "dense"
    sparse.mkdir(exist_ok=True)
    dense.mkdir(exist_ok=True)

    run([COLMAP_BIN, "feature_extractor",
         "--database_path", db, "--image_path", images,
         "--ImageReader.single_camera", "1"])
    run([COLMAP_BIN, "exhaustive_matcher", "--database_path", db])
    run([COLMAP_BIN, "mapper",
         "--database_path", db, "--image_path", images, "--output_path", sparse])
    model0 = sparse / "0"
    if not model0.exists():
        raise RuntimeError("COLMAP could not reconstruct — too few overlapping frames "
                           "or weak texture. Recapture with more overlap and detail.")
    run([COLMAP_BIN, "image_undistorter",
         "--image_path", images, "--input_path", model0,
         "--output_path", dense, "--output_type", "COLMAP"])
    return dense


def reconstruct_openmvs(dense: Path, work: Path) -> Path:
    """Best quality: OpenMVS dense cloud + mesh + texture -> textured GLB."""
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
    glb = work / "model.glb"
    run([OBJ2GLTF_BIN, "-i", obj, "-o", glb, "--binary"])
    if not glb.exists():
        raise RuntimeError("obj2gltf did not produce a GLB.")
    return glb


def reconstruct_colmap_only(dense: Path, work: Path) -> Path:
    """
    Easier to install (no OpenMVS build — great for Colab/RunPod): COLMAP's
    own CUDA dense stereo + Poisson mesh, then PLY (vertex colours) -> GLB via
    trimesh. Needs a CUDA-enabled COLMAP for patch_match_stereo.
    """
    run([COLMAP_BIN, "patch_match_stereo",
         "--workspace_path", dense, "--workspace_format", "COLMAP",
         "--PatchMatchStereo.geom_consistency", "true"])
    fused = dense / "fused.ply"
    run([COLMAP_BIN, "stereo_fusion",
         "--workspace_path", dense, "--workspace_format", "COLMAP",
         "--input_type", "geometric", "--output_path", fused])
    mesh = dense / "meshed-poisson.ply"
    run([COLMAP_BIN, "poisson_mesher",
         "--input_path", fused, "--output_path", mesh])
    if not mesh.exists():
        raise RuntimeError("COLMAP meshing produced no surface.")

    # PLY (with vertex colours) -> GLB. trimesh keeps the colours as COLOR_0.
    import trimesh  # lazy: only the COLMAP-only path needs it
    glb = work / "model.glb"
    scene = trimesh.load(str(mesh))
    scene.export(str(glb))
    if not glb.exists() or glb.stat().st_size == 0:
        raise RuntimeError("PLY -> GLB conversion failed.")
    return glb


def reconstruct(job, work: Path) -> Path:
    """Full pipeline. Returns the path to a GLB (textured or vertex-coloured)."""
    images = work / "images"
    first_frame = download_frames(job["frameUrls"], images)
    print(f"  downloaded {len(list(images.glob('*.jpg')))} frames", flush=True)

    dense = colmap_sfm(images, work)
    if has_openmvs():
        print("  reconstructing with OpenMVS (textured)", flush=True)
        glb = reconstruct_openmvs(dense, work)
    else:
        print("  reconstructing with COLMAP dense+Poisson (vertex colours)", flush=True)
        glb = reconstruct_colmap_only(dense, work)

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
