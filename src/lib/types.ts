/**
 * Core domain types for Holoform Studio.
 * Kept storage-agnostic so the JSON-file store can be swapped
 * for Supabase (or any backend) without touching UI code.
 */

export type ARContentType = "model" | "image" | "video" | "text";

export type ExperienceStatus = "draft" | "published";

export interface TextStyle {
  /** Hex color for the extruded text material */
  color: string;
  /** Preset finish for the material */
  finish: "matte" | "metal" | "neon";
}

export interface ExperienceContent {
  /** URL of the primary asset (.glb/.gltf, image, or video). Empty for `text`. */
  assetUrl?: string;
  /** Original filename of the uploaded asset (display only) */
  assetName?: string;
  /** Optional iOS Quick Look asset for `model` experiences */
  usdzUrl?: string;
  /** The text to render for `text` experiences */
  text?: string;
  textStyle?: TextStyle;
}

export interface Experience {
  id: string;
  title: string;
  description: string;
  type: ARContentType;
  status: ExperienceStatus;
  /** Data-URL or uploaded-file URL used on dashboard cards */
  thumbnail?: string;
  content: ExperienceContent;
  createdAt: string;
  updatedAt: string;
}

export interface ViewEvent {
  at: string;
  device: "phone" | "tablet" | "desktop" | "other";
  browser: string;
  os: string;
  referrer: string;
}

export interface ExperienceAnalytics {
  totalViews: number;
  lastViewedAt: string | null;
  events: ViewEvent[];
}

export interface ExperienceWithStats extends Experience {
  analytics: ExperienceAnalytics;
}

/** Payload accepted when creating/updating an experience */
export interface ExperienceInput {
  title: string;
  description?: string;
  type: ARContentType;
  status?: ExperienceStatus;
  thumbnail?: string;
  content?: ExperienceContent;
}

export const CONTENT_TYPE_META: Record<
  ARContentType,
  { label: string; blurb: string }
> = {
  model: { label: "3D Model", blurb: "GLB / glTF object anchored in space" },
  image: { label: "Image / Poster", blurb: "A floating image plane" },
  video: { label: "Video", blurb: "A floating video screen" },
  text: { label: "3D Text", blurb: "Extruded text you can style" },
};

/** Campaign template presets offered in the creation wizard */
export interface TemplatePreset {
  id: string;
  name: string;
  tagline: string;
  type: ARContentType;
  titleHint: string;
  descriptionHint: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "packaging",
    name: "Product Packaging",
    tagline: "Bring a box or label to life",
    type: "model",
    titleHint: "Product reveal",
    descriptionHint: "Scan the pack to explore the product in 3D.",
  },
  {
    id: "exhibition",
    name: "Exhibition",
    tagline: "AR exhibits beside real ones",
    type: "model",
    titleHint: "Exhibit companion",
    descriptionHint: "Point your phone at the stand to see the full story.",
  },
  {
    id: "business-card",
    name: "Business Card",
    tagline: "A card that introduces you in AR",
    type: "text",
    titleHint: "My AR card",
    descriptionHint: "Scan to see who I am — in your space.",
  },
  {
    id: "poster",
    name: "Poster",
    tagline: "Posters that step off the wall",
    type: "image",
    titleHint: "Campaign poster",
    descriptionHint: "The key visual, floating in the room.",
  },
  {
    id: "training",
    name: "Training Guide",
    tagline: "Show a procedure, not a PDF",
    type: "video",
    titleHint: "How-to in AR",
    descriptionHint: "Watch the walkthrough right where you work.",
  },
];

/** Bundled sample assets so the flow is testable before any upload */
export const SAMPLE_MODEL_URL = "/samples/aurora-knot.glb";
export const SAMPLE_MODEL_NAME = "aurora-knot.glb (sample)";
