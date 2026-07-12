import type { ARContentType } from "@/lib/types";

/** Original line icons for each AR content type. */
export default function TypeIcon({
  type,
  className = "h-5 w-5",
}: {
  type: ARContentType;
  className?: string;
}) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };
  switch (type) {
    case "model":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" />
          <path d="M12 12 20 7M12 12 4 7M12 12v9.5" />
        </svg>
      );
    case "image":
      return (
        <svg {...common} aria-hidden>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m4.5 17.5 4.8-4.5 3.2 3 3-2.6 4 3.8" />
        </svg>
      );
    case "video":
      return (
        <svg {...common} aria-hidden>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="m10.2 9.2 4.6 2.8-4.6 2.8V9.2Z" />
        </svg>
      );
    case "text":
      return (
        <svg {...common} aria-hidden>
          <path d="M5 7V4.8h14V7" />
          <path d="M12 4.8v14.4M9 19.2h6" />
        </svg>
      );
    case "tracked":
      return (
        <svg {...common} aria-hidden>
          <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
          <circle cx="9.5" cy="10" r="1.3" />
          <path d="m6.5 15.5 3-2.6 2.2 1.9 2.3-2 3.5 2.7" />
        </svg>
      );
  }
}
