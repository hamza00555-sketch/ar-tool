import Link from "next/link";

/** Studio chrome: top navigation + page container. Not used by the public viewer. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-aurora-400 to-iris-500 opacity-90 transition-transform group-hover:scale-105" />
              <svg
                viewBox="0 0 24 24"
                className="relative h-4.5 w-4.5 text-ink-950"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3 19 7v10l-7 4-7-4V7l7-4Z" />
                <circle cx="12" cy="12" r="2.4" />
              </svg>
            </span>
            <span className="text-[1.05rem] font-bold tracking-tight">
              Holoform <span className="text-aurora">Studio</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/" className="btn btn-ghost !px-3.5 !py-2 text-sm">
              Experiences
            </Link>
            <Link href="/create" className="btn btn-primary !px-3.5 !py-2 text-sm">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-white/8 py-6 text-center text-xs text-mist-600">
        Holoform Studio — WebAR experiences from a QR code.
      </footer>
    </div>
  );
}
