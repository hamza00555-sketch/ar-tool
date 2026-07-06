import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
    notFound(); // renders ./not-found.tsx with a real 404 status
  }

  // Strip analytics before shipping to the client — viewers don't need it
  const { analytics, ...experience } = exp;
  void analytics;
  return <ARViewerShell experience={experience} />;
}
