"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import ExperienceCard from "@/components/ExperienceCard";
import { getStorageMode, listExperiences } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ExperienceWithStats } from "@/lib/types";

/** Dashboard: campaign cards with status, scan counts, and last-viewed time. */
export default function DashboardPage() {
  const { t } = useI18n();
  const [experiences, setExperiences] = useState<ExperienceWithStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<"supabase" | "local" | null>(null);

  useEffect(() => {
    listExperiences()
      .then(setExperiences)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
    getStorageMode().then(setStorage);
  }, []);

  const totalScans = experiences?.reduce((n, e) => n + e.analytics.totalViews, 0) ?? 0;
  const liveCount = experiences?.filter((e) => e.status === "published").length ?? 0;

  return (
    <AppShell>
      {storage === "local" && (
        <div className="animate-rise mb-6 flex items-start gap-3 rounded-xl border border-ember-400/25 bg-ember-400/8 px-4 py-3 text-xs text-ember-400">
          <span className="mt-0.5 font-bold uppercase tracking-wider">
            {t.dashboard.localModeTitle}
          </span>
          <span className="text-ember-400/90">{t.dashboard.localModeBody}</span>
        </div>
      )}
      <section className="animate-rise mb-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-aurora-300">
          {t.dashboard.kicker}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            {t.dashboard.headlinePre}{" "}
            <span className="text-aurora">{t.dashboard.headlineAccent}</span>
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link href="/scan" className="btn btn-ghost">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t.scan.navCta}
            </Link>
            <Link href="/create" className="btn btn-primary">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t.dashboard.newExperience}
            </Link>
          </div>
        </div>

        {experiences && experiences.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-md">
            {(
              [
                [t.dashboard.statExperiences, experiences.length],
                [t.dashboard.statLive, liveCount],
                [t.dashboard.statScans, totalScans],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="glass px-4 py-3">
                <p className="font-mono text-xl font-bold text-aurora-300">{value}</p>
                <p className="text-xs text-mist-500">{label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-danger-400/30 bg-danger-400/8 px-4 py-3 text-sm text-danger-400">
          {error}
        </div>
      )}

      {!experiences && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass h-64 animate-pulse" />
          ))}
        </div>
      )}

      {experiences && experiences.length === 0 && (
        <div className="glass flex flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-lg font-semibold">{t.dashboard.emptyTitle}</h2>
          <p className="max-w-sm text-sm text-mist-500">{t.dashboard.emptyBody}</p>
          <Link href="/create" className="btn btn-primary">
            {t.dashboard.emptyCta}
          </Link>
        </div>
      )}

      {experiences && experiences.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experiences.map((exp) => (
            <ExperienceCard key={exp.id} exp={exp} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
