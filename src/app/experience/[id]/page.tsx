"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import TypeIcon from "@/components/TypeIcon";
import QRPanel from "@/components/QRPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import LivePreview from "@/components/LivePreview";
import { deleteExperience, getExperience, shareUrl, updateExperience } from "@/lib/api";
import { CONTENT_TYPE_META, type ExperienceWithStats } from "@/lib/types";

/** Manage one experience: edit details, toggle status, QR + share, analytics. */
export default function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const justCreated = useSearchParams().get("created") === "1";

  const [exp, setExp] = useState<ExperienceWithStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    getExperience(id)
      .then((e) => {
        setExp(e);
        setTitle(e.title);
        setDescription(e.description);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  const url = useMemo(() => shareUrl(id), [id]);
  const dirty = exp ? title !== exp.title || description !== exp.description : false;

  const save = async (patch: Parameters<typeof updateExperience>[1]) => {
    if (!exp) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateExperience(exp.id, patch);
      setExp({ ...exp, ...updated });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!exp) return;
    if (!window.confirm(`Delete “${exp.title}”? This can’t be undone.`)) return;
    try {
      await deleteExperience(exp.id);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (error && !exp) {
    return (
      <AppShell>
        <div className="glass mx-auto max-w-md p-8 text-center">
          <h1 className="text-lg font-bold">Experience not found</h1>
          <p className="mt-2 text-sm text-mist-500">{error}</p>
          <Link href="/" className="btn btn-ghost mt-4">
            Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!exp) {
    return (
      <AppShell>
        <div className="glass h-96 animate-pulse" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {justCreated && (
        <div className="animate-rise mb-6 rounded-xl border border-aurora-500/30 bg-aurora-500/10 px-4 py-3 text-sm text-aurora-300">
          ✦ Experience created — scan the QR code below with your phone to test it.
        </div>
      )}

      <div className="animate-rise mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusBadge status={exp.status} />
            <span className="flex items-center gap-1.5 text-xs text-mist-500">
              <TypeIcon type={exp.type} className="h-3.5 w-3.5" />
              {CONTENT_TYPE_META[exp.type].label}
            </span>
            <span className="font-mono text-xs text-mist-600">/ar/{exp.id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{exp.title}</h1>
        </div>
        <div className="flex gap-2">
          <a href={`/ar/${exp.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost">
            Open viewer ↗
          </a>
          <button
            onClick={() => save({ status: exp.status === "published" ? "draft" : "published" })}
            disabled={saving}
            className={`btn ${exp.status === "published" ? "btn-ghost" : "btn-primary"}`}
          >
            {exp.status === "published" ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {/* Edit details */}
          <section className="glass p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-mist-500">
              Details
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <span className="label">Title</span>
                <input
                  className="field"
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <span className="label">Description</span>
                <textarea
                  className="field min-h-20 resize-y"
                  value={description}
                  maxLength={280}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => save({ title, description })}
                  disabled={!dirty || saving}
                  className="btn btn-primary"
                >
                  {saving ? "Saving…" : savedTick ? "Saved ✓" : "Save changes"}
                </button>
                {error && <span className="text-sm text-danger-400">{error}</span>}
              </div>
            </div>
          </section>

          {/* Preview */}
          <section className="glass overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-500">
                Preview
              </h2>
              <span className="text-xs text-mist-600">
                {exp.content.assetName ?? (exp.type === "text" ? `“${exp.content.text}”` : "")}
              </span>
            </div>
            <div className="mt-3 h-80">
              <LivePreview type={exp.type} content={exp.content} />
            </div>
          </section>

          {/* Analytics */}
          <section className="glass p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-mist-500">
              Analytics
            </h2>
            <AnalyticsPanel analytics={exp.analytics} />
          </section>

          <section className="flex justify-end">
            <button onClick={remove} className="btn btn-danger text-xs">
              Delete experience
            </button>
          </section>
        </div>

        {/* Test-on-phone / QR side panel */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong p-6">
            <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wider text-mist-500">
              Test on phone
            </h2>
            <p className="mb-4 text-center text-xs text-mist-600">
              Scan with your phone camera to open the AR viewer.
            </p>
            <QRPanel url={url} />
          </div>
          {exp.status === "draft" && (
            <p className="rounded-xl border border-ember-400/25 bg-ember-400/8 px-4 py-3 text-xs text-ember-400">
              This experience is a draft — the link works for testing, but consider
              publishing before sharing the QR publicly.
            </p>
          )}
          <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-mist-600">
            Phones must be able to reach this address. When running locally, open
            the studio via your computer’s network IP (e.g.{" "}
            <span className="font-mono">http://192.168.x.x:3000</span>) so the QR
            works on your phone.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
