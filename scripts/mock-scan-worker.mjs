/**
 * Mock reconstruction worker — for local end-to-end testing of the scan
 * pipeline WITHOUT a GPU. It speaks the exact same API contract as the real
 * worker (worker/run.py): claim a job, "reconstruct", upload a result GLB,
 * report completion. Instead of running photogrammetry it just returns the
 * bundled sample model, so the whole capture → job → ready → experience loop
 * can be verified in seconds.
 *
 * Usage:
 *   APP_URL=http://localhost:3100 WORKER_TOKEN=dev-token \
 *     node scripts/mock-scan-worker.mjs [--once]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const APP_URL = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
const TOKEN = process.env.WORKER_TOKEN ?? "dev-token";
const ONCE = process.argv.includes("--once");
const SAMPLE_GLB = path.join(process.cwd(), "public/samples/aurora-knot.glb");

const authHeaders = { "x-worker-token": TOKEN, "Content-Type": "application/json" };

async function claim() {
  const res = await fetch(`${APP_URL}/api/scan/worker/claim`, {
    method: "POST",
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`claim failed: ${res.status} ${await res.text()}`);
  return (await res.json()).job;
}

/** Upload a file through the app's public sign→PUT flow (same as the browser). */
async function uploadResult(bytes, name, kind, contentType) {
  const signRes = await fetch(`${APP_URL}/api/upload/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size: bytes.length, kind }),
  });
  if (!signRes.ok) throw new Error(`sign failed: ${signRes.status} ${await signRes.text()}`);
  const sign = await signRes.json();

  if (sign.mode === "supabase") {
    const put = await fetch(sign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": sign.contentType, "x-upsert": "false" },
      body: bytes,
    });
    if (!put.ok) throw new Error(`PUT failed: ${put.status} ${await put.text()}`);
    return sign.publicUrl;
  }
  // local dev — multipart to /api/upload
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: contentType }), name);
  form.append("kind", kind);
  const res = await fetch(`${APP_URL}/api/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`local upload failed: ${res.status} ${await res.text()}`);
  return (await res.json()).url;
}

async function complete(id, body) {
  const res = await fetch(`${APP_URL}/api/scan/worker/complete`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ id, ...body }),
  });
  if (!res.ok) throw new Error(`complete failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function processJob(job) {
  console.log(`[mock-worker] claimed ${job.id} — ${job.frameUrls.length} frames`);
  try {
    // Real worker runs COLMAP+OpenMVS here; the mock returns the sample model.
    const glb = await readFile(SAMPLE_GLB);
    const glbUrl = await uploadResult(glb, `scan-${job.id}.glb`, "model", "model/gltf-binary");
    const out = await complete(job.id, { glbUrl });
    console.log(`[mock-worker] done ${job.id} → experience ${out.experienceId}`);
  } catch (e) {
    console.error(`[mock-worker] failed ${job.id}:`, e.message);
    await complete(job.id, { error: String(e.message).slice(0, 300) }).catch(() => {});
  }
}

async function loop() {
  for (;;) {
    let job = null;
    try {
      job = await claim();
    } catch (e) {
      console.error("[mock-worker]", e.message);
    }
    if (job) {
      await processJob(job);
      if (ONCE) return;
    } else {
      if (ONCE) {
        console.log("[mock-worker] no queued job");
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
