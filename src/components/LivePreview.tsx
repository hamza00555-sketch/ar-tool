"use client";

import type { Experience, ExperienceContent, ARContentType } from "@/lib/types";
import ModelViewerClient from "./viewers/ModelViewerClient";
import PlaneViewer from "./viewers/PlaneViewer";

/**
 * Live 3D preview used inside the creation wizard and the editor.
 * Renders the same viewers as the public page, minus AR entry.
 */
export default function LivePreview({
  type,
  content,
  onError,
}: {
  type: ARContentType;
  content: ExperienceContent;
  onError?: (message: string) => void;
}) {
  const ready =
    type === "text" ? Boolean(content.text?.trim()) : Boolean(content.assetUrl);

  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/15 text-mist-600">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 19 7v10l-7 4-7-4V7l7-4Z" />
          </svg>
        </div>
        <p className="max-w-48 text-xs text-mist-600">
          {type === "text"
            ? "Type something to see it in 3D"
            : "Add content to see the live preview"}
        </p>
      </div>
    );
  }

  if (type === "model") {
    return (
      <ModelViewerClient
        src={content.assetUrl!}
        alt="Live preview"
        onLoadError={onError}
      />
    );
  }

  const stub: Experience = {
    id: "preview",
    title: "Preview",
    description: "",
    type,
    status: "draft",
    content,
    createdAt: "",
    updatedAt: "",
  };
  return <PlaneViewer experience={stub} onError={onError} />;
}
