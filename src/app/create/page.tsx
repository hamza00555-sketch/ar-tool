"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TypeIcon from "@/components/TypeIcon";
import UploadDropzone from "@/components/UploadDropzone";
import LivePreview from "@/components/LivePreview";
import { createExperience } from "@/lib/api";
import {
  CONTENT_TYPE_META,
  SAMPLE_MODEL_NAME,
  SAMPLE_MODEL_URL,
  TEMPLATE_PRESETS,
  type ARContentType,
  type ExperienceContent,
  type TextStyle,
} from "@/lib/types";

const STEPS = ["Type", "Content", "Publish"] as const;

const TEXT_COLORS = ["#7ef4dc", "#a48bfa", "#ffb26b", "#f2f5fb", "#ff7d94"];
const TEXT_FINISHES: { id: TextStyle["finish"]; label: string }[] = [
  { id: "metal", label: "Metal" },
  { id: "matte", label: "Matte" },
  { id: "neon", label: "Neon" },
];

/** Three-step creation wizard with a live 3D preview from step 2 onward. */
export default function CreatePage() {
  const router = useRouter();
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

  const textStyle: TextStyle = content.textStyle ?? { color: "#7ef4dc", finish: "metal" };

  const contentReady = useMemo(() => {
    if (!type) return false;
    if (type === "text") return Boolean(content.text?.trim());
    return Boolean(content.assetUrl);
  }, [type, content]);

  const applyTemplate = (presetId: string) => {
    const preset = TEMPLATE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setType(preset.type);
    setTitle(preset.titleHint);
    setDescription(preset.descriptionHint);
    setStep(1);
  };

  const pickType = (t: ARContentType) => {
    setType(t);
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
        title: title || CONTENT_TYPE_META[type].label,
        description,
        type,
        status: publishNow ? "published" : "draft",
        thumbnail,
        content: type === "text" ? { ...content, textStyle } : content,
      });
      router.push(`/experience/${exp.id}?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the experience.");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      {/* Step indicator */}
      <div className="animate-rise mb-8 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
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
            <h1 className="mb-1 text-2xl font-bold tracking-tight">
              What should appear in AR?
            </h1>
            <p className="mb-6 text-sm text-mist-500">
              Pick a content type — you can add the actual content in the next step.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(CONTENT_TYPE_META) as ARContentType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => pickType(t)}
                  className="glass card-hover flex flex-col items-start gap-3 p-5 text-start"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-400/15 to-iris-500/15 text-aurora-300">
                    <TypeIcon type={t} className="h-5.5 w-5.5" />
                  </span>
                  <span className="font-semibold">{CONTENT_TYPE_META[t].label}</span>
                  <span className="text-xs text-mist-500">{CONTENT_TYPE_META[t].blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-mist-500">
              Or start from a template
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {TEMPLATE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyTemplate(p.id)}
                  className="glass card-hover flex flex-col gap-1.5 p-4 text-start"
                >
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="text-xs text-mist-500">{p.tagline}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-aurora-300">
                    <TypeIcon type={p.type} className="h-3 w-3" />
                    {CONTENT_TYPE_META[p.type].label}
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
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="mb-1 text-2xl font-bold tracking-tight">
                Add your {CONTENT_TYPE_META[type].label.toLowerCase()}
              </h1>
              <p className="text-sm text-mist-500">
                The live preview updates as soon as content is ready.
              </p>
            </div>

            {type === "model" && (
              <div className="flex flex-col gap-4">
                <UploadDropzone
                  kind="model"
                  hint=".glb or .gltf, up to 60 MB"
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
                  ✦ Use the bundled sample model
                </button>
                <div>
                  <span className="label">iOS Quick Look (optional)</span>
                  <UploadDropzone
                    kind="usdz"
                    hint=".usdz — enables native AR on iPhone/iPad"
                    currentName={content.usdzUrl ? "USDZ attached" : undefined}
                    onUploaded={(f) => setContent((c) => ({ ...c, usdzUrl: f.url }))}
                  />
                </div>
              </div>
            )}

            {type === "image" && (
              <UploadDropzone
                kind="image"
                hint=".png .jpg .webp .gif, up to 60 MB"
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
                  hint=".mp4 .webm .mov, up to 60 MB"
                  currentName={content.assetName}
                  onUploaded={(f) =>
                    setContent((c) => ({ ...c, assetUrl: f.url, assetName: f.originalName }))
                  }
                />
                <div>
                  <span className="label">…or link a hosted video</span>
                  <div className="flex gap-2">
                    <input
                      className="field"
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
                          assetName: "linked video",
                        }))
                      }
                    >
                      Use
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-mist-600">
                    Direct .mp4/.webm links work best (the host must allow cross-origin access).
                  </p>
                </div>
              </div>
            )}

            {type === "text" && (
              <div className="flex flex-col gap-4">
                <div>
                  <span className="label">Your text</span>
                  <input
                    className="field text-lg"
                    maxLength={40}
                    placeholder="HELLO WORLD"
                    value={content.text ?? ""}
                    onChange={(e) => setContent((c) => ({ ...c, text: e.target.value }))}
                  />
                </div>
                <div>
                  <span className="label">Color</span>
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
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">Finish</span>
                  <div className="flex gap-2">
                    {TEXT_FINISHES.map((f) => (
                      <button
                        key={f.id}
                        onClick={() =>
                          setContent((prev) => ({
                            ...prev,
                            textStyle: { ...textStyle, finish: f.id },
                          }))
                        }
                        className={`btn text-xs ${
                          textStyle.finish === f.id ? "btn-primary" : "btn-ghost"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setStep(0)} className="btn btn-ghost">
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!contentReady}
                className="btn btn-primary"
              >
                Continue
              </button>
              {!contentReady && (
                <span className="text-xs text-mist-600">
                  Add content to continue
                </span>
              )}
            </div>
          </div>

          <PreviewPanel error={previewError}>
            <LivePreview
              type={type}
              content={type === "text" ? { ...content, textStyle } : content}
              onError={setPreviewError}
            />
          </PreviewPanel>
        </div>
      )}

      {/* STEP 3 — details + publish */}
      {step === 2 && type && (
        <div className="animate-rise grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="flex max-w-xl flex-col gap-5">
            <h1 className="text-2xl font-bold tracking-tight">Details & publish</h1>
            <div>
              <span className="label">Title</span>
              <input
                className="field"
                placeholder="e.g. Spring launch — hero product"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <span className="label">Description</span>
              <textarea
                className="field min-h-24 resize-y"
                placeholder="Shown to viewers on the AR start screen."
                value={description}
                maxLength={280}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <span className="label">Thumbnail (optional)</span>
              <UploadDropzone
                kind="image"
                hint="Shown on the dashboard card"
                currentName={thumbnail ? "Thumbnail set" : undefined}
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
                <span className="font-semibold">Publish immediately</span>{" "}
                <span className="text-mist-500">— the QR code goes live right away</span>
              </span>
            </label>

            {error && (
              <p className="rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-sm text-danger-400">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="btn btn-ghost">
                Back
              </button>
              <button onClick={submit} disabled={saving} className="btn btn-primary">
                {saving ? "Creating…" : "Create experience"}
              </button>
            </div>
          </div>

          <PreviewPanel error={previewError}>
            <LivePreview
              type={type}
              content={type === "text" ? { ...content, textStyle } : content}
              onError={setPreviewError}
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
  return (
    <div className="flex flex-col gap-2">
      <span className="label !mb-0">Live preview</span>
      <div className="glass relative h-80 overflow-hidden lg:h-[26rem]">
        {children}
        {error && (
          <div className="absolute inset-x-3 bottom-3 rounded-lg border border-danger-400/30 bg-ink-950/90 px-3 py-2 text-xs text-danger-400">
            {error}
          </div>
        )}
      </div>
      <p className="text-xs text-mist-600">
        Drag to orbit · pinch or scroll to zoom
      </p>
    </div>
  );
}
