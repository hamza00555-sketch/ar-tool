/**
 * Core domain types for Holoform Studio.
 * Kept storage-agnostic so the JSON-file store can be swapped
 * for Supabase (or any backend) without touching UI code.
 */

export type ARContentType = "model" | "image" | "video" | "text" | "tracked";

export type ExperienceStatus = "draft" | "published";

export interface TextStyle {
  /** Hex color for the extruded text material */
  color: string;
  /** Preset finish for the material */
  finish: "matte" | "metal" | "neon";
}

/** Decoration themes — start with birthday; more get added over time. */
export type SceneTheme = "birthday";

export const SCENE_THEMES: SceneTheme[] = ["birthday"];

export type BannerAnimation = "float" | "pulse" | "spin" | "none";

/**
 * Optional themed decorations rendered around the main content in the
 * browser viewers (3D preview, WebXR, image tracking). Native hand-off
 * viewers (Scene Viewer / Quick Look) can only show the model file itself,
 * so themed experiences stay in the web viewer for consistency.
 */
export interface SceneConfig {
  theme?: SceneTheme | "";
  /** Custom banner text shown above the content (Arabic shaping supported) */
  bannerText?: string;
  bannerColor?: string;
  bannerAnimation?: BannerAnimation;
  balloons?: boolean;
  confetti?: boolean;
}

export interface ExperienceContent {
  /** URL of the primary asset (.glb/.gltf, image, or video). Empty for `text`. */
  assetUrl?: string;
  /** Original filename of the uploaded asset (display only) */
  assetName?: string;
  /** Optional iOS Quick Look asset for `model` experiences */
  usdzUrl?: string;
  /**
   * Auto-generated poster-plane GLB for `image` experiences — enables native
   * camera AR (Quick Look / Scene Viewer) since iOS Safari lacks WebXR.
   */
  arModelUrl?: string;
  /** `tracked` experiences: the reference image the camera looks for */
  targetImageUrl?: string;
  /** `tracked` experiences: compiled MindAR feature file (.mind) */
  mindUrl?: string;
  /** Themed decorations (banner text, balloons, confetti, …) */
  scene?: SceneConfig;
  /** The text to render for `text` experiences */
  text?: string;
  textStyle?: TextStyle;
  /** Optional soundtrack that plays while the experience is viewed */
  audioUrl?: string;
  /** Original filename of the uploaded audio (display only) */
  audioName?: string;
  /** Loop the soundtrack (default true) */
  audioLoop?: boolean;
  /**
   * True when the baked USDZ carries the soundtrack itself (SpatialAudio
   * prim) — the viewer then skips page audio on iOS so it doesn't double.
   */
  audioInUsdz?: boolean;
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

/* --------------------------------- 3D scan -------------------------------- */

export type ScanStatus = "queued" | "processing" | "ready" | "failed";

/**
 * A photogrammetry job: the browser captures frames of a real object, a
 * self-hosted reconstruction worker turns them into a GLB, and on success
 * the app creates a `model` experience from the result.
 */
export interface ScanJob {
  id: string;
  status: ScanStatus;
  title: string;
  frameUrls: string[];
  resultGlbUrl?: string;
  resultUsdzUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  /** the model experience created once the scan is ready */
  experienceId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload the worker sends when it claims a job (frames + where to upload results). */
export interface ScanClaim {
  id: string;
  title: string;
  frameUrls: string[];
  /** Signed URLs the worker PUTs the reconstruction outputs to */
  upload: {
    glb: { uploadUrl: string; publicUrl: string; contentType: string };
    usdz: { uploadUrl: string; publicUrl: string; contentType: string };
    thumbnail: { uploadUrl: string; publicUrl: string; contentType: string };
  };
}

export interface ViewEvent {
  at: string;
  device: "phone" | "tablet" | "desktop" | "other";
  browser: string;
  os: string;
  referrer: string;
  /** Raw user agent — stored for analytics, not shown in the UI */
  userAgent?: string;
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

/**
 * Campaign template presets offered in the creation wizard.
 * Display strings (name, tagline, title/description hints) live in the
 * i18n dictionary under `templates`, keyed by these ids.
 */
export interface TemplatePreset {
  id: string;
  type: ARContentType;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: "packaging", type: "model" },
  { id: "exhibition", type: "model" },
  { id: "business-card", type: "text" },
  { id: "poster", type: "image" },
  { id: "training", type: "video" },
];

/** Bundled sample assets so the flow is testable before any upload */
export const SAMPLE_MODEL_URL = "/samples/aurora-knot.glb";
export const SAMPLE_MODEL_NAME = "aurora-knot.glb (sample)";

/**
 * Bundled soundtrack presets (synthesized in-house, no licensing issues).
 * Display names live in the i18n dictionary under `wizard.audioPresets`,
 * keyed by these ids.
 */
export interface SoundPreset {
  id: string;
  url: string;
}

export const SOUND_PRESETS: SoundPreset[] = [
  { id: "birthday", url: "/sounds/birthday.wav" },
  { id: "applause", url: "/sounds/applause.wav" },
  { id: "horn", url: "/sounds/party-horn.wav" },
  { id: "chime", url: "/sounds/chime.wav" },
];
