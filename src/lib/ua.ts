/** Tiny user-agent classifier — good enough for MVP analytics, no dependency. */
import type { ViewEvent } from "./types";

export function classifyUserAgent(ua: string): Pick<ViewEvent, "device" | "browser" | "os"> {
  const s = ua.toLowerCase();

  let device: ViewEvent["device"] = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/.test(s)) device = "tablet";
  else if (/iphone|ipod|android.*mobile|mobile/.test(s)) device = "phone";
  else if (!/windows|macintosh|linux|cros/.test(s)) device = "other";

  let os = "Unknown";
  if (/iphone|ipad|ipod/.test(s)) os = "iOS";
  else if (/android/.test(s)) os = "Android";
  else if (/windows/.test(s)) os = "Windows";
  else if (/macintosh|mac os/.test(s)) os = "macOS";
  else if (/cros/.test(s)) os = "ChromeOS";
  else if (/linux/.test(s)) os = "Linux";

  let browser = "Unknown";
  if (/edg\//.test(s)) browser = "Edge";
  else if (/samsungbrowser/.test(s)) browser = "Samsung Internet";
  else if (/opr\/|opera/.test(s)) browser = "Opera";
  else if (/firefox|fxios/.test(s)) browser = "Firefox";
  else if (/crios/.test(s)) browser = "Chrome";
  else if (/chrome/.test(s)) browser = "Chrome";
  else if (/safari/.test(s)) browser = "Safari";

  return { device, browser, os };
}
