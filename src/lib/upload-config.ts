/** Shared upload validation config — used by the sign route, the local
 * multipart route, and mirrored client-side in the dropzone. */

export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  model: [".glb", ".gltf"],
  usdz: [".usdz"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
  video: [".mp4", ".webm", ".mov"],
  /** Compiled MindAR feature files for image-tracking experiences */
  mind: [".mind"],
  /** Soundtracks — formats Quick Look can embed in a USDZ (mp3/m4a/wav) */
  audio: [".mp3", ".m4a", ".wav"],
};

/** Keep in sync with the bucket's file_size_limit in the migration SQL. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export const MIME_BY_EXT: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".usdz": "model/vnd.usdz+zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mind": "application/octet-stream",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};
