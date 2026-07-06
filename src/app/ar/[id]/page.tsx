import type { Metadata } from "next";
import ARViewerShell from "@/components/ARViewerShell";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const exp = await getStore().get(id);
  return {
    title: exp ? `${exp.title} — AR` : "AR experience",
    description: exp?.description || "Open this AR experience in your browser.",
  };
}

/** Public viewer route — what the QR code opens. Mobile-first, no studio chrome. */
export default async function ARPage({ params }: Props) {
  const { id } = await params;
  const exp = await getStore().get(id);

  if (!exp) {
    return (
      <div className="flex h-dvh items-center justify-center p-6">
        <div className="glass-strong max-w-sm p-8 text-center">
          <h1 className="text-lg font-bold">Experience not found</h1>
          <p className="mt-2 text-sm text-mist-500">
            This AR link doesn’t exist anymore — it may have been deleted by its creator.
          </p>
        </div>
      </div>
    );
  }

  // Strip analytics before shipping to the client — viewers don't need it
  const { analytics, ...experience } = exp;
  void analytics;
  return <ARViewerShell experience={experience} />;
}
