"use client";

import { useCallback, useRef, useState } from "react";
import { uploadFile } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const KIND_ACCEPT: Record<string, string> = {
  model: ".glb,.gltf",
  usdz: ".usdz",
  image: ".png,.jpg,.jpeg,.webp,.gif",
  video: ".mp4,.webm,.mov",
};

/**
 * Drag & drop / tap-to-browse upload with progress + error states.
 * Validation happens client-side (extension) and again on the server.
 */
export default function UploadDropzone({
  kind,
  hint,
  currentName,
  onUploaded,
}: {
  kind: "model" | "usdz" | "image" | "video";
  hint: string;
  currentName?: string;
  onUploaded: (file: { url: string; originalName: string }) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const allowed = KIND_ACCEPT[kind].split(",");
      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!allowed.includes(ext)) {
        setError(t.upload.unsupported(ext, allowed.join(" ")));
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const res = await uploadFile(file, kind);
        onUploaded({ url: res.url, originalName: res.originalName });
      } catch (e) {
        setError(e instanceof Error ? e.message : t.upload.failed);
      } finally {
        setBusy(false);
      }
    },
    [kind, onUploaded, t]
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`group relative flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-all ${
          dragOver
            ? "border-aurora-400 bg-aurora-500/10"
            : "border-white/15 bg-white/[0.03] hover:border-aurora-400/50 hover:bg-white/[0.05]"
        }`}
      >
        {busy ? (
          <>
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-aurora-400 border-t-transparent" />
            <span className="text-sm text-mist-300">{t.upload.uploading}</span>
          </>
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-400/20 to-iris-500/20 text-aurora-300 transition-transform group-hover:-translate-y-0.5">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
                <path d="M4 15v3a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 18v-3" />
              </svg>
            </span>
            <span className="text-sm font-medium">
              {currentName ? (
                <span className="text-aurora-300">{currentName}</span>
              ) : (
                <>
                  {t.upload.drop} <span className="text-aurora-300">{t.upload.browse}</span>
                </>
              )}
            </span>
            <span className="text-xs text-mist-600">{hint}</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={KIND_ACCEPT[kind]}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="mt-2 rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-xs text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}
