"use client";

import { use, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import TypeIcon from "@/components/TypeIcon";
import QRPanel from "@/components/QRPanel";
import AnalyticsPanel from "@/components/AnalyticsPanel";
import LivePreview from "@/components/LivePreview";
import {
  deleteExperience,
  getExperience,
  isLocalShareUrl,
  shareUrl,
  updateExperience,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ExperienceWithStats } from "@/lib/types";

const noopSubscribe = () => () => {};

/** Manage one experience: edit details, toggle status, QR + share, analytics. */
export default function ExperienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useI18n();
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
  // Evaluated after hydration only (url depends on window.location in dev)
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const localUrl = mounted && isLocalShareUrl(shareUrl(id));
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
      setError(e instanceof Error ? e.message : t.detail.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!exp) return;
    if (!window.confirm(t.detail.confirmDelete(exp.title))) return;
    try {
      await deleteExperience(exp.id);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.detail.deleteFailed);
    }
  };

  if (error && !exp) {
    return (
      <AppShell>
        <div className="glass mx-auto max-w-md p-8 text-center">
          <h1 className="text-lg font-bold">{t.detail.notFound}</h1>
          <p className="mt-2 text-sm text-mist-500">{error}</p>
          <Link href="/" className="btn btn-ghost mt-4">
            {t.detail.backToDash}
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
          {t.detail.createdBanner}
        </div>
      )}

      <div className="animate-rise mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusBadge status={exp.status} />
            <span className="flex items-center gap-1.5 text-xs text-mist-500">
              <TypeIcon type={exp.type} className="h-3.5 w-3.5" />
              {t.types[exp.type].label}
            </span>
            <span className="font-mono text-xs text-mist-600" dir="ltr">
              /ar/{exp.id}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{exp.title}</h1>
        </div>
        <div className="flex gap-2">
          <a href={`/ar/${exp.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost">
            {t.detail.openViewer}
          </a>
          <button
            onClick={() => save({ status: exp.status === "published" ? "draft" : "published" })}
            disabled={saving}
            className={`btn ${exp.status === "published" ? "btn-ghost" : "btn-primary"}`}
          >
            {exp.status === "published" ? t.detail.unpublish : t.detail.publish}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Edit details */}
          <section className="glass p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-mist-500">
              {t.detail.details}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <span className="label">{t.wizard.titleLabel}</span>
                <input
                  className="field"
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <span className="label">{t.wizard.descLabel}</span>
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
                  {saving ? t.detail.saving : savedTick ? t.detail.saved : t.detail.save}
                </button>
                {error && <span className="text-sm text-danger-400">{error}</span>}
              </div>
            </div>
          </section>

          {/* Preview */}
          <section className="glass overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-500">
                {t.detail.preview}
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
              {t.detail.analytics}
            </h2>
            <AnalyticsPanel analytics={exp.analytics} />
          </section>

          <section className="flex justify-end">
            <button onClick={remove} className="btn btn-danger text-xs">
              {t.detail.deleteExp}
            </button>
          </section>
        </div>

        {/* Test-on-phone / QR side panel */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong p-6">
            <h2 className="mb-1 text-center text-sm font-semibold uppercase tracking-wider text-mist-500">
              {t.detail.testOnPhone}
            </h2>
            <p className="mb-4 text-center text-xs text-mist-600">{t.detail.scanHint}</p>
            <QRPanel url={url} />
          </div>
          {exp.status === "draft" && (
            <p className="rounded-xl border border-ember-400/25 bg-ember-400/8 px-4 py-3 text-xs text-ember-400">
              {t.detail.draftNote}
            </p>
          )}
          {localUrl && (
            <p className="rounded-xl border border-danger-400/30 bg-danger-400/8 px-4 py-3 text-xs text-danger-400">
              {t.detail.localhostWarning}
            </p>
          )}
          <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-xs text-mist-600">
            {t.detail.networkNote}{" "}
            <span className="font-mono" dir="ltr">
              http://192.168.x.x:3000
            </span>
            {t.detail.networkNoteEnd}
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
