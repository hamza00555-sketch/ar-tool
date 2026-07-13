"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TypeIcon from "@/components/TypeIcon";
import UploadDropzone from "@/components/UploadDropzone";
import LivePreview from "@/components/LivePreview";
import { createExperience, uploadFile } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  SAMPLE_MODEL_NAME,
  SAMPLE_MODEL_URL,
  TEMPLATE_PRESETS,
  type ARContentType,
  type BannerAnimation,
  type ExperienceContent,
  type SceneConfig,
  type TextStyle,
} from "@/lib/types";

const CONTENT_TYPES: ARContentType[] = ["model", "image", "video", "text", "tracked"];
type OverlayKind = "model" | "video" | "image";
const SCENE_COLORS = ["#ffc94d", "#7ef4dc", "#a48bfa", "#ff7d94", "#f2f5fb"];
const BANNER_ANIMS: BannerAnimation[] = ["float", "pulse", "spin", "none"];
const TEXT_COLORS = ["#7ef4dc", "#a48bfa", "#ffb26b", "#f2f5fb", "#ff7d94"];
const TEXT_FINISHES: TextStyle["finish"][] = ["metal", "matte", "neon"];

/** Three-step creation wizard with a live 3D preview from step 2 onward. */
export default function CreatePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ARContentType | null>(null);
  const [content, setContent] = useState<ExperienceContent>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [thumbnail, setThumbnail] = useState<string | undefined>();
  const [videoUrlDraft, setVideoUrlDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [overlayKind, setOverlayKind] = useState<OverlayKind>("model");
  const [compilePct, setCompilePct] = useState<number | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);

  const textStyle: TextStyle = content.textStyle ?? { color: "#7ef4dc", finish: "metal" };

  const contentReady = useMemo(() => {
    if (!type) return false;
    if (type === "text") return Boolean(content.text?.trim());
    if (type === "tracked")
      return Boolean(content.targetImageUrl && content.mindUrl && content.assetUrl);
    return Boolean(content.assetUrl);
  }, [type, content]);

  const scene = content.scene;
  const patchScene = (patch: Partial<SceneConfig>) =>
    setContent((c) => ({ ...c, scene: { ...c.scene, ...patch } }));
  const pickTheme = (theme: "" | "birthday") => {
    if (theme === "") {
      setContent((c) => ({ ...c, scene: undefined }));
      return;
    }
    setContent((c) => ({
      ...c,
      scene: {
        theme,
        bannerText: c.scene?.bannerText ?? t.wizard.bannerDefault,
        bannerColor: c.scene?.bannerColor ?? "#ffc94d",
        bannerAnimation: c.scene?.bannerAnimation ?? "float",
        balloons: c.scene?.balloons ?? true,
        confetti: c.scene?.confetti ?? true,
      },
    }));
  };

  /** Target image uploaded → analyze its features in-browser, store the .mind file */
  const onTargetUploaded = async (f: { url: string; originalName: string }) => {
    setContent((c) => ({ ...c, targetImageUrl: f.url, mindUrl: undefined }));
    setCompileError(null);
    setCompilePct(0);
    try {
      const { compileTargetImage } = await import("@/lib/compile-target");
      const blob = await compileTargetImage(f.url, setCompilePct);
      const up = await uploadFile(new File([blob], "targets.mind"), "mind");
      setContent((c) => ({ ...c, mindUrl: up.url }));
    } catch {
      setCompileError(t.wizard.compileFailed);
    } finally {
      setCompilePct(null);
    }
  };

  const applyTemplate = (presetId: string) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setType(preset.type);
    setTitle(t.templates[preset.id].titleHint);
    setDescription(t.templates[preset.id].descriptionHint);
    setStep(1);
  };

  const pickType = (picked: ARContentType) => {
    setType(picked);
    setContent({});
    setPreviewError(null);
    setStep(1);
  };

  const submit = async () => {
    if (!type) return;
    setSaving(true);
    setError(null);
    try {
      const exp = await createExperience({
        title: title || t.types[type].label,
        description,
        type,
        status: publishNow ? "published" : "draft",
        thumbnail,
        content: type === "text" ? { ...content, textStyle } : content,
      });
      router.push(`/experience/${exp.id}?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.wizard.saveFailed);
      setSaving(false);
    }
  };

  return (
    <AppShell>
      {/* Step indicator */}
      <div className="animate-rise mb-8 flex items-center gap-1.5">
        {t.wizard.steps.map((s, i) => (
          <button
            key={s}
            disabled={i > step || (i > 0 && !type)}
            onClick={() => setStep(i)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              i === step
                ? "bg-aurora-500/15 text-aurora-300 border border-aurora-500/35"
                : i < step
                  ? "text-mist-300 border border-white/10 bg-white/5"
                  : "text-mist-600 border border-transparent"
            }`}
          >
            <span className="font-mono">{i + 1}</span> {s}
          </button>
        ))}
      </div>

      {/* STEP 1 — choose type / template */}
      {step === 0 && (
        <div className="animate-rise flex flex-col gap-10">
          <section>
            <h1 className="mb-1 text-2xl font-bold tracking-tight">{t.wizard.typeTitle}</h1>
            <p className="mb-6 text-sm text-mist-500">{t.wizard.typeSub}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct}
                  onClick={() => pickType(ct)}
                  className="glass card-hover flex flex-col items-start gap-3 p-5 text-start"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-400/15 to-iris-500/15 text-aurora-300">
                    <TypeIcon type={ct} className="h-5.5 w-5.5" />
                  </span>
                  <span className="font-semibold">{t.types[ct].label}</span>
                  <span className="text-xs text-mist-500">{t.types[ct].blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-mist-500">
              {t.wizard.orTemplate}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {TEMPLATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyTemplate(p.id)}
                  className="glass card-hover flex flex-col gap-1.5 p-4 text-start"
                >
                  <span className="text-sm font-semibold">{t.templates[p.id].name}</span>
                  <span className="text-xs text-mist-500">{t.templates[p.id].tagline}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-aurora-300">
                    <TypeIcon type={p.type} className="h-3 w-3" />
                    {t.types[p.type].label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* STEP 2 — content + live preview */}
      {step === 1 && type && (
        <div className="animate-rise grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight">
                {t.wizard.contentTitle(t.types[type].label)}
              </h1>
              <p className="text-sm text-mist-500">{t.wizard.contentSub}</p>
            </div>

            {type === "model" && (
              <div className="flex flex-col gap-4">
                <UploadDropzone
                  kind="model"
                  hint={t.wizard.modelHint}
                  currentName={content.assetName}
                  onUploaded={(f) =>
                    setContent((c) => ({ ...c, assetUrl: f.url, assetName: f.originalName }))
                  }
                />
                <button
                  onClick={() =>
                    setContent((c) => ({
                      ...c,
                      assetUrl: SAMPLE_MODEL_URL,
                      assetName: SAMPLE_MODEL_NAME,
                    }))
                  }
                  className="btn btn-ghost self-start text-xs"
                >
                  {t.wizard.useSample}
                </button>
                <div>
                  <span className="label">{t.wizard.iosLabel}</span>
                  <UploadDropzone
                    kind="usdz"
                    hint={t.wizard.usdzHint}
                    currentName={content.usdzUrl ? t.wizard.usdzAttached : undefined}
                    onUploaded={(f) => setContent((c) => ({ ...c, usdzUrl: f.url }))}
                  />
                </div>
              </div>
            )}

            {type === "image" && (
              <UploadDropzone
                kind="image"
                hint={t.wizard.imageHint}
                currentName={content.assetName}
                onUploaded={(f) =>
                  setContent((c) => ({ ...c, assetUrl: f.url, assetName: f.originalName }))
                }
              />
            )}

            {type === "video" && (
              <div className="flex flex-col gap-4">
                <UploadDropzone
                  kind="video"
                  hint={t.wizard.videoHint}
                  currentName={content.assetName}
                  onUploaded={(f) =>
                    setContent((c) => ({ ...c, assetUrl: f.url, assetName: f.originalName }))
                  }
                />
                <div>
                  <span className="label">{t.wizard.orLinkVideo}</span>
                  <div className="flex gap-2">
                    <input
                      className="field"
                      dir="ltr"
                      placeholder="https://example.com/video.mp4"
                      value={videoUrlDraft}
                      onChange={(e) => setVideoUrlDraft(e.target.value)}
                    />
                    <button
                      className="btn btn-ghost"
                      disabled={!/^https?:\/\/.+/.test(videoUrlDraft)}
                      onClick={() =>
                        setContent((c) => ({
                          ...c,
                          assetUrl: videoUrlDraft,
                          assetName: t.wizard.linkedVideo,
                        }))
                      }
                    >
                      {t.wizard.useLink}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-mist-600">{t.wizard.linkHint}</p>
                </div>
              </div>
            )}

            {type === "text" && (
              <div className="flex flex-col gap-4">
                <div>
                  <span className="label">{t.wizard.yourText}</span>
                  <input
                    className="field text-lg"
                    maxLength={40}
                    placeholder={t.wizard.textPlaceholder}
                    value={content.text ?? ""}
                    onChange={(e) => setContent((c) => ({ ...c, text: e.target.value }))}
                  />
                </div>
                <div>
                  <span className="label">{t.wizard.color}</span>
                  <div className="flex gap-2">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() =>
                          setContent((prev) => ({
                            ...prev,
                            textStyle: { ...textStyle, color: c },
                          }))
                        }
                        className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                          textStyle.color === c ? "border-white" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">{t.wizard.finish}</span>
                  <div className="flex gap-2">
                    {TEXT_FINISHES.map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          setContent((prev) => ({
                            ...prev,
                            textStyle: { ...textStyle, finish: f },
                          }))
                        }
                        className={`btn text-xs ${
                          textStyle.finish === f ? "btn-primary" : "btn-ghost"
                        }`}
                      >
                        {t.wizard.finishes[f]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {type === "tracked" && (
              <div className="flex flex-col gap-5">
                {/* Target image + feature compilation */}
                <div>
                  <span className="label">{t.wizard.targetLabel}</span>
                  <UploadDropzone
                    kind="image"
                    hint={t.wizard.targetHint}
                    currentName={
                      content.mindUrl
                        ? t.wizard.targetReady
                        : content.targetImageUrl && compilePct === null
                          ? undefined
                          : undefined
                    }
                    onUploaded={onTargetUploaded}
                  />
                  <p className="mt-1.5 text-xs text-mist-600">{t.wizard.targetQualityHint}</p>
                  {compilePct !== null && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs text-aurora-300">
                        {t.wizard.compiling(compilePct)}
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-aurora-400 to-iris-400 transition-all"
                          style={{ width: `${compilePct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {compileError && (
                    <p className="mt-2 rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-xs text-danger-400">
                      {compileError}
                    </p>
                  )}
                  {content.targetImageUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded asset preview */}
                      <img
                        src={content.targetImageUrl}
                        alt=""
                        className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                      />
                      {content.mindUrl && (
                        <span className="text-xs text-aurora-300">{t.wizard.targetReady}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Overlay content */}
                <div>
                  <span className="label">{t.wizard.overlayLabel}</span>
                  <div className="mb-3 flex gap-2">
                    {(
                      [
                        ["model", t.wizard.overlayModel],
                        ["video", t.wizard.overlayVideo],
                        ["image", t.wizard.overlayImage],
                      ] as [OverlayKind, string][]
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setOverlayKind(k)}
                        className={`btn text-xs ${overlayKind === k ? "btn-primary" : "btn-ghost"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <UploadDropzone
                    key={overlayKind}
                    kind={overlayKind}
                    hint={
                      overlayKind === "model"
                        ? t.wizard.modelHint
                        : overlayKind === "video"
                          ? t.wizard.videoHint
                          : t.wizard.imageHint
                    }
                    currentName={content.assetName}
                    onUploaded={(f) =>
                      setContent((c) => ({ ...c, assetUrl: f.url, assetName: f.originalName }))
                    }
                  />
                  {overlayKind === "model" && (
                    <button
                      onClick={() =>
                        setContent((c) => ({
                          ...c,
                          assetUrl: SAMPLE_MODEL_URL,
                          assetName: SAMPLE_MODEL_NAME,
                        }))
                      }
                      className="btn btn-ghost mt-3 self-start text-xs"
                    >
                      {t.wizard.useSample}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Theme & decorations — browser-rendered types only */}
            {type !== "model" && (
              <div className="glass flex flex-col gap-4 p-4">
                <span className="label !mb-0">{t.wizard.sceneLabel}</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => pickTheme("")}
                    className={`btn text-xs ${!scene?.theme ? "btn-primary" : "btn-ghost"}`}
                  >
                    {t.wizard.themeNone}
                  </button>
                  <button
                    onClick={() => pickTheme("birthday")}
                    className={`btn text-xs ${scene?.theme === "birthday" ? "btn-primary" : "btn-ghost"}`}
                  >
                    {t.wizard.themeBirthday}
                  </button>
                </div>

                {scene?.theme === "birthday" && (
                  <>
                    <div>
                      <span className="label">{t.wizard.bannerTextLabel}</span>
                      <input
                        className="field"
                        maxLength={40}
                        value={scene.bannerText ?? ""}
                        onChange={(e) => patchScene({ bannerText: e.target.value })}
                      />
                    </div>
                    <div>
                      <span className="label">{t.wizard.bannerColorLabel}</span>
                      <div className="flex gap-2">
                        {SCENE_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => patchScene({ bannerColor: c })}
                            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                              scene.bannerColor === c ? "border-white" : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                            aria-label={c}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="label">{t.wizard.bannerAnimLabel}</span>
                      <div className="flex flex-wrap gap-2">
                        {BANNER_ANIMS.map((a) => (
                          <button
                            key={a}
                            onClick={() => patchScene({ bannerAnimation: a })}
                            className={`btn text-xs ${
                              (scene.bannerAnimation ?? "float") === a ? "btn-primary" : "btn-ghost"
                            }`}
                          >
                            {t.wizard.anims[a]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={scene.balloons !== false}
                          onChange={(e) => patchScene({ balloons: e.target.checked })}
                          className="h-4 w-4 accent-teal-400"
                        />
                        {t.wizard.balloonsLabel}
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={scene.confetti !== false}
                          onChange={(e) => patchScene({ confetti: e.target.checked })}
                          className="h-4 w-4 accent-teal-400"
                        />
                        {t.wizard.confettiLabel}
                      </label>
                    </div>
                    <p className="text-xs text-mist-600">{t.wizard.themeWebNote}</p>
                  </>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setStep(0)} className="btn btn-ghost">
                {t.wizard.back}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!contentReady}
                className="btn btn-primary"
              >
                {t.wizard.continue}
              </button>
              {!contentReady && (
                <span className="text-xs text-mist-600">{t.wizard.addToContinue}</span>
              )}
            </div>
          </div>

          <PreviewPanel error={previewError}>
            <LivePreview
              type={type}
              content={type === "text" ? { ...content, textStyle } : content}
              onError={() => setPreviewError(t.viewer.loadErrorContent)}
            />
          </PreviewPanel>
        </div>
      )}

      {/* STEP 3 — details + publish */}
      {step === 2 && type && (
        <div className="animate-rise grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="flex min-w-0 max-w-xl flex-col gap-5">
            <h1 className="text-2xl font-bold tracking-tight">{t.wizard.publishTitle}</h1>
            <div>
              <span className="label">{t.wizard.titleLabel}</span>
              <input
                className="field"
                placeholder={t.wizard.titlePlaceholder}
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <span className="label">{t.wizard.descLabel}</span>
              <textarea
                className="field min-h-24 resize-y"
                placeholder={t.wizard.descPlaceholder}
                value={description}
                maxLength={280}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <span className="label">{t.wizard.thumbLabel}</span>
              <UploadDropzone
                kind="image"
                hint={t.wizard.thumbHint}
                currentName={thumbnail ? t.wizard.thumbSet : undefined}
                onUploaded={(f) => setThumbnail(f.url)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-3">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(e) => setPublishNow(e.target.checked)}
                className="h-4 w-4 accent-teal-400"
              />
              <span className="text-sm">
                <span className="font-semibold">{t.wizard.publishNow}</span>{" "}
                <span className="text-mist-500">{t.wizard.publishNote}</span>
              </span>
            </label>

            {error && (
              <p className="rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-sm text-danger-400">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="btn btn-ghost">
                {t.wizard.back}
              </button>
              <button onClick={submit} disabled={saving} className="btn btn-primary">
                {saving ? t.wizard.creating : t.wizard.create}
              </button>
            </div>
          </div>

          <PreviewPanel error={previewError}>
            <LivePreview
              type={type}
              content={type === "text" ? { ...content, textStyle } : content}
              onError={() => setPreviewError(t.viewer.loadErrorContent)}
            />
          </PreviewPanel>
        </div>
      )}
    </AppShell>
  );
}

function PreviewPanel({
  children,
  error,
}: {
  children: React.ReactNode;
  error: string | null;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="label !mb-0">{t.wizard.livePreview}</span>
      <div className="glass relative h-80 overflow-hidden lg:h-[26rem]">
        {children}
        {error && (
          <div className="absolute inset-x-3 bottom-3 rounded-lg border border-danger-400/30 bg-ink-950/90 px-3 py-2 text-xs text-danger-400">
            {error}
          </div>
        )}
      </div>
      <p className="text-xs text-mist-600">{t.wizard.orbitHint}</p>
    </div>
  );
}
