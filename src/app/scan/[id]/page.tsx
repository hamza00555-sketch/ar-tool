"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getScanJob } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ScanJob } from "@/lib/types";

const POLL_MS = 3000;
/** Show the "worker may be offline" hint after this long still queued. */
const OFFLINE_HINT_MS = 30000;

export default function ScanStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [job, setJob] = useState<ScanJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOfflineHint, setShowOfflineHint] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const j = await getScanJob(id);
        if (!active) return;
        setJob(j);
        if (j.status === "ready" && j.experienceId) {
          router.replace(`/experience/${j.experienceId}`);
          return;
        }
        if (j.status === "failed") return; // stop polling
        if (Date.now() - startedAt > OFFLINE_HINT_MS && j.status === "queued") {
          setShowOfflineHint(true);
        }
        timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : t.scan.notFound);
      }
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, router, t.scan.notFound]);

  const statusText =
    job?.status === "processing"
      ? t.scan.statusProcessing
      : job?.status === "ready"
        ? t.scan.statusReady
        : t.scan.statusQueued;

  return (
    <AppShell>
      <div className="animate-rise mx-auto flex max-w-lg flex-col items-center gap-5 py-10 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-danger-400">{t.scan.notFound}</h1>
            <p className="text-sm text-mist-500">{error}</p>
            <Link href="/scan" className="btn btn-primary">
              {t.scan.scanAgain}
            </Link>
          </>
        ) : job?.status === "failed" ? (
          <>
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-danger-400/40 bg-danger-400/10 text-2xl">
              ⚠️
            </div>
            <h1 className="text-lg font-bold">{t.scan.statusFailed}</h1>
            {job.error && <p className="text-sm text-mist-500">{job.error}</p>}
            <Link href="/scan" className="btn btn-primary">
              {t.scan.scanAgain}
            </Link>
          </>
        ) : (
          <>
            <span className="h-12 w-12 animate-spin rounded-full border-2 border-aurora-400 border-t-transparent" />
            <h1 className="text-xl font-bold tracking-tight">{t.scan.processingTitle}</h1>
            <p className="text-sm text-mist-300">{statusText}</p>
            <p className="max-w-sm text-xs text-mist-600">{t.scan.processingBody}</p>
            {showOfflineHint && (
              <p className="max-w-sm rounded-lg border border-ember-400/25 bg-ember-400/8 px-3 py-2 text-xs text-ember-400">
                {t.scan.workerOfflineNote}
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
