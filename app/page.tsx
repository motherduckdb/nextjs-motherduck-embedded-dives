import type { Metadata } from "next";
import { STARTER_DIVES } from "@/app/_lib/dive-provisioning";
import HomeClient, { type GalleryDive } from "./home-client";

export const metadata: Metadata = {
  title: "All Dives | MotherDuck",
  description: "Browse the embedded MotherDuck dives gallery.",
};

export default function HomePage() {
  // SSR the static starter list so the page paints with content immediately.
  // The client hydrates each card with the per-user embed session and (in
  // personal-token mode) swaps in the user's cloned dives.
  const initialStarters: GalleryDive[] = STARTER_DIVES.map((starter) => ({
    key: starter.key,
    title: starter.title,
    label: starter.label,
    description: starter.description,
  }));

  return <HomeClient initialStarters={initialStarters} />;
}
