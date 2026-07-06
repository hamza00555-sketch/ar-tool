"use client";

import type { ExperienceAnalytics } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

function tally(items: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i, (map.get(i) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function BreakdownRow({ name, count, total }: { name: string; count: number; total: number }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 truncate text-mist-300">{name}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-aurora-400 to-iris-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-end font-mono text-xs text-mist-500">{pct}%</span>
    </div>
  );
}

/** Scans total + device / browser / OS breakdowns + recent events table. */
export default function AnalyticsPanel({ analytics }: { analytics: ExperienceAnalytics }) {
  const { t, locale } = useI18n();
  const events = analytics.events;
  const n = events.length;
  const devices = tally(events.map((e) => t.analytics.devices[e.device]));
  const browsers = tally(events.map((e) => e.browser));
  const oses = tally(events.map((e) => e.os));
  const recent = [...events].reverse().slice(0, 12);
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === "ar" ? "ar" : "en-US");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-mist-500">
            {t.analytics.totalScans}
          </p>
          <p className="mt-1 font-mono text-3xl font-bold text-aurora-300">
            {analytics.totalViews}
          </p>
        </div>
        <div className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-mist-500">
            {t.analytics.lastViewed}
          </p>
          <p className="mt-1 text-sm font-medium text-mist-300">
            {analytics.lastViewedAt ? fmtDate(analytics.lastViewedAt) : t.analytics.notScanned}
          </p>
        </div>
      </div>

      {n === 0 ? (
        <p className="text-sm text-mist-500">{t.analytics.noScans}</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-3">
            {(
              [
                [t.analytics.device, devices],
                [t.analytics.browser, browsers],
                [t.analytics.os, oses],
              ] as const
            ).map(([title, rows]) => (
              <div key={title} className="flex flex-col gap-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-mist-500">
                  {title}
                </p>
                {rows.slice(0, 4).map(([name, count]) => (
                  <BreakdownRow key={name} name={name} count={count} total={n} />
                ))}
              </div>
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist-500">
              {t.analytics.recent}
            </p>
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-[30rem] text-start text-sm">
                <thead>
                  <tr className="text-xs text-mist-600">
                    <th className="pb-2 pe-4 text-start font-medium">{t.analytics.when}</th>
                    <th className="pb-2 pe-4 text-start font-medium">{t.analytics.device}</th>
                    <th className="pb-2 pe-4 text-start font-medium">{t.analytics.browser}</th>
                    <th className="pb-2 pe-4 text-start font-medium">{t.analytics.os}</th>
                    <th className="pb-2 text-start font-medium">{t.analytics.referrer}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e, i) => (
                    <tr key={i} className="border-t border-white/6 text-mist-300">
                      <td className="py-2 pe-4 whitespace-nowrap font-mono text-xs">
                        {fmtDate(e.at)}
                      </td>
                      <td className="py-2 pe-4">{t.analytics.devices[e.device]}</td>
                      <td className="py-2 pe-4">{e.browser}</td>
                      <td className="py-2 pe-4">{e.os}</td>
                      <td className="max-w-40 truncate py-2 text-mist-500">
                        {e.referrer || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
