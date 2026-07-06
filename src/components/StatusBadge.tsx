import type { ExperienceStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: ExperienceStatus }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wider ${
        published
          ? "bg-aurora-500/15 text-aurora-300 border border-aurora-500/30"
          : "bg-white/5 text-mist-500 border border-white/10"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          published ? "bg-aurora-400 animate-pulse-soft" : "bg-mist-600"
        }`}
      />
      {published ? "Live" : "Draft"}
    </span>
  );
}
