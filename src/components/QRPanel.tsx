"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import QRCode from "qrcode";
import { useI18n } from "@/lib/i18n";

// The share URL depends on window.location.origin, so its text may only be
// rendered after hydration — this flag flips to true on the client.
const noopSubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

/**
 * QR code for a public AR link: preview, PNG/SVG download, copy link.
 * The QR encodes the real share URL based on the current origin.
 */
export default function QRPanel({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [png, setPng] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0e16", light: "#ffffff" },
    })
      .then((data) => !cancelled && setPng(data))
      .catch(() => !cancelled && setPng(""));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const downloadPng = () => {
    if (!png) return;
    triggerDownload(png, "holoform-qr.png");
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0e16", light: "#ffffff" },
    });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    triggerDownload(href, "holoform-qr.svg");
    URL.revokeObjectURL(href);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable (http on LAN) — show the URL for manual copy
      window.prompt(t.qr.copyPrompt, url);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white p-3 shadow-[0_10px_40px_-12px_rgb(70_227_198/0.35)]">
        {png ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image adds nothing
          <img
            src={png}
            alt={`QR code linking to ${url}`}
            className={compact ? "h-36 w-36" : "h-48 w-48 sm:h-56 sm:w-56"}
          />
        ) : (
          <div className={`animate-pulse rounded-lg bg-mist-300 ${compact ? "h-36 w-36" : "h-48 w-48 sm:h-56 sm:w-56"}`} />
        )}
      </div>
      <p className="max-w-full truncate font-mono text-xs text-mist-500" title={url} dir="ltr">
        {mounted ? url : "…"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={downloadPng} className="btn btn-ghost !px-3.5 !py-2 text-xs" disabled={!png}>
          PNG
        </button>
        <button onClick={downloadSvg} className="btn btn-ghost !px-3.5 !py-2 text-xs">
          SVG
        </button>
        <button onClick={copyLink} className="btn btn-primary !px-3.5 !py-2 text-xs">
          {copied ? t.qr.copied : t.qr.copyLink}
        </button>
      </div>
    </div>
  );
}

function triggerDownload(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
