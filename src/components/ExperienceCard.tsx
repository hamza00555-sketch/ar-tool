import Link from "next/link";
import type { ExperienceWithStats } from "@/lib/types";
import { CONTENT_TYPE_META } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import TypeIcon from "./TypeIcon";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Campaign card: thumbnail, status, scan count, last viewed. */
export default function ExperienceCard({ exp }: { exp: ExperienceWithStats }) {
  return (
    <Link
      href={`/experience/${exp.id}`}
      className="glass card-hover animate-rise flex flex-col overflow-hidden"
    >
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-ink-800 to-ink-900">
        {exp.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- user data-URL thumbnails
          <img src={exp.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-400/15 to-iris-500/15 text-aurora-300">
            <TypeIcon type={exp.type} className="h-8 w-8" />
          </div>
        )}
        <span className="absolute top-3 start-3">
          <StatusBadge status={exp.status} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-mist-500">
          <TypeIcon type={exp.type} className="h-3.5 w-3.5" />
          {CONTENT_TYPE_META[exp.type].label}
        </div>
        <h3 className="line-clamp-1 font-semibold">{exp.title}</h3>
        {exp.description && (
          <p className="line-clamp-2 text-sm text-mist-500">{exp.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-white/8 pt-3 text-xs text-mist-500">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
            <span className="font-mono font-semibold text-mist-300">
              {exp.analytics.totalViews}
            </span>
            scans
          </span>
          <span>viewed {timeAgo(exp.analytics.lastViewedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
