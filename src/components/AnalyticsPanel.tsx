import type { ExperienceAnalytics } from "@/lib/types";

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
  const events = analytics.events;
  const n = events.length;
  const devices = tally(events.map((e) => e.device));
  const browsers = tally(events.map((e) => e.browser));
  const oses = tally(events.map((e) => e.os));
  const recent = [...events].reverse().slice(0, 12);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-mist-500">Total scans</p>
          <p className="mt-1 font-mono text-3xl font-bold text-aurora-300">
            {analytics.totalViews}
          </p>
        </div>
        <div className="glass p-4">
          <p className="text-xs uppercase tracking-wider text-mist-500">Last viewed</p>
          <p className="mt-1 text-sm font-medium text-mist-300">
            {analytics.lastViewedAt
              ? new Date(analytics.lastViewedAt).toLocaleString()
              : "Not scanned yet"}
          </p>
        </div>
      </div>

      {n === 0 ? (
        <p className="text-sm text-mist-500">
          No scans recorded yet — open the public link or scan the QR to see data here.
        </p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-3">
            {(
              [
                ["Device", devices],
                ["Browser", browsers],
                ["OS", oses],
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
              Recent scans
            </p>
            <div className="scroll-slim overflow-x-auto">
              <table className="w-full min-w-[30rem] text-start text-sm">
                <thead>
                  <tr className="text-xs text-mist-600">
                    <th className="pb-2 pe-4 text-start font-medium">When</th>
                    <th className="pb-2 pe-4 text-start font-medium">Device</th>
                    <th className="pb-2 pe-4 text-start font-medium">Browser</th>
                    <th className="pb-2 pe-4 text-start font-medium">OS</th>
                    <th className="pb-2 text-start font-medium">Referrer</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e, i) => (
                    <tr key={i} className="border-t border-white/6 text-mist-300">
                      <td className="py-2 pe-4 whitespace-nowrap font-mono text-xs">
                        {new Date(e.at).toLocaleString()}
                      </td>
                      <td className="py-2 pe-4 capitalize">{e.device}</td>
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
