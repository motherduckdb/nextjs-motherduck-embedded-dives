"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAuthHeaders,
  getDemoSessionId,
  storeEditSession,
} from "@/app/_lib/edit-session-client";
import AccountMenu from "@/app/account-menu";
import { AppHeader, RepoLink } from "@/app/_components/header";
import { BrutalistButton } from "@/app/_components/brutalist-button";
import { PencilIcon } from "@/app/_components/icons";

type GalleryDive = {
  key: string;
  title: string;
  label: string;
  description: string;
  diveId: string;
  session: string;
  starterKey?: string;
};

type DiveViewClientProps = {
  starterKey: string;
  staticMeta: { title: string; description: string } | null;
};

export default function DiveViewClient({ starterKey, staticMeta }: DiveViewClientProps) {
  const router = useRouter();
  const [embedSession, setEmbedSession] = useState<string | null>(null);
  const [resolvedDive, setResolvedDive] = useState<GalleryDive | null>(null);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSourceDive() {
      setLoading(true);
      setError(null);
      setEmbedSession(null);
      try {
        const res = await fetch("/api/gallery", {
          cache: "no-store",
          headers: getAuthHeaders(),
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error("Failed to load gallery");
        const data = (await res.json()) as { dives?: GalleryDive[] };
        if (cancelled) return;
        const selectedDive = data.dives?.find(
          (item) => item.key === starterKey || item.diveId === starterKey
        );
        if (!selectedDive?.session) throw new Error("Missing embed session");
        setEmbedSession(selectedDive.session);
        setResolvedDive(selectedDive);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load source dive:", err);
        setError("Could not load dive.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSourceDive();
    return () => {
      cancelled = true;
    };
  }, [router, starterKey]);

  async function customize() {
    setCustomizing(true);
    setError(null);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          starter: resolvedDive?.starterKey ?? starterKey,
          diveId: resolvedDive?.diveId,
          demoSessionId: getDemoSessionId(),
        }),
      });
      if (!res.ok) throw new Error("Failed to create customization session");
      const data = (await res.json()) as {
        sessionSecret?: string;
        secret?: string;
        diveId: string;
        diveIds?: Record<string, string>;
        starterKey?: string;
      };
      storeEditSession({
        sessionSecret: data.sessionSecret ?? data.secret,
        diveId: data.diveId,
        diveIds: data.diveIds,
        starterKey: data.starterKey ?? starterKey,
        mode: "editing",
      });
      router.push("/edit");
    } catch (err) {
      console.error("Failed to customize dive:", err);
      setError("Could not create editable dive.");
      setCustomizing(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-1">
      <AppHeader
        meta={resolvedDive ?? staticMeta ?? { title: "Dive" }}
        right={
          <>
            <RepoLink />
            <BrutalistButton
              tone="primary"
              shadow="md"
              className="font-bold"
              onClick={customize}
              disabled={customizing || loading}
            >
              <PencilIcon className="h-4 w-4" />
              {customizing ? "Remixing..." : "Remix"}
            </BrutalistButton>
            <AccountMenu />
          </>
        }
      />

      <main className="relative flex-1 overflow-hidden bg-surface-1">
        {embedSession ? (
          // `allow-scripts allow-same-origin` together only sandbox a *cross-origin* src
          // (embed-motherduck.com). If you fork this and point the iframe at a same-origin
          // URL, the combination silently disables the sandbox — keep the src third-party.
          <iframe
            key={`${starterKey}:${embedSession}`}
            src={`https://embed-motherduck.com/sandbox/#session=${embedSession}`}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p
              className={`text-sm ${error ? "font-semibold text-accent-red" : "text-ink-muted animate-pulse"}`}
            >
              {error ?? (loading ? "Loading dive..." : "Dive unavailable.")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
