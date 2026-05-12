import type { Metadata } from "next";
import { STARTER_DIVES } from "@/app/_lib/dive-provisioning";
import DiveViewClient from "./view-client";

type RouteParams = { params: Promise<{ starter: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { starter } = await params;
  const dive = STARTER_DIVES.find((d) => d.key === starter);
  return {
    title: dive ? `${dive.title} | MotherDuck` : "Dive | MotherDuck",
    description: dive?.description,
  };
}

export default async function DiveViewPage({ params }: RouteParams) {
  const { starter } = await params;
  // URL param can be either a starter key (e.g. "presentation-dive") or a
  // per-user dive UUID (cloned anonymous dive, personal-token dive). For
  // starter keys we ship the title server-side; otherwise the client looks
  // it up via /api/gallery.
  const staticStarter = STARTER_DIVES.find((d) => d.key === starter);
  return (
    <DiveViewClient
      starterKey={starter}
      staticMeta={
        staticStarter
          ? { title: staticStarter.title, description: staticStarter.description }
          : null
      }
    />
  );
}
