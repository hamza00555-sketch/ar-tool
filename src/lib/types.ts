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
