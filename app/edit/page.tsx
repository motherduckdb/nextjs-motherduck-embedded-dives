import type { Metadata } from "next";
import EditClient from "./edit-client";

export const metadata: Metadata = {
  title: "Remix | MotherDuck",
  description: "Remix this dive with AI chat.",
};

export default function EditPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EditClient />
    </div>
  );
}
