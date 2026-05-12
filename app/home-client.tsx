"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AccountMenu from "./account-menu";
import {
  getAuthHeaders,
  getDemoSessionId,
  storeEditSession,
} from "@/app/_lib/edit-session-client";
import { AppHeader, RepoLink } from "@/app/_components/header";
import { BrutalistButton } from "@/app/_components/brutalist-button";
import { PencilIcon } from "@/app/_components/icons";

export type GalleryDive = {
  key: string;
  title: string;
  label: string;
  description: string;
  session?: string;
  diveId?: string;
  starterKey?: string;
  updatedAt?: string | null;
};

type HomeClientProps = {
  initialStarters: GalleryDive[];
};

export default function HomeClient({ initialStarters }: HomeClientProps) {
  const router = useRouter();
  // Render the static starter list immediately; per-user gallery overrides
  // it once /api/gallery returns (adds embed sessions, swaps in cloned dives
  // for personal-token users).
  const [starters, setStarters] = useState<GalleryDive[]>(initialStarters);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [customizingKey, setCustomizingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGallery() {
      setError(null);
      try {
        const sessionId = getDemoSessionId();
        setDemoSessionId(sessionId);
        const authRes = await fetch("/api/auth-status", { cache: "no-store" });
        if (authRes.ok) {
          const auth = (await authRes.json()) as { redirectTo?: string | null };
          if (cancelled) return;
          if (auth.redirectTo) {
            router.replace(auth.redirectTo);
            return;
          }
        }
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
        if (!data.dives) throw new Error("Missing gallery data");
        if (cancelled) return;
        setStarters(data.dives);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load gallery:", err);
        setError("Could not load gallery.");
      }
    }

    loadGallery();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function customize(selectedDive: GalleryDive) {
    setCustomizingKey(selectedDive.key);
    setError(null);
    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          starter: selectedDive.starterKey ?? selectedDive.key,
          diveId: selectedDive.diveId,
          demoSessionId,
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
        starterKey: data.starterKey ?? selectedDive.key,
        mode: "editing",
      });
      router.push("/edit");
    } catch (err) {
      console.error("Failed to customize dive:", err);
      setError("Could not create editable dive.");
      setCustomizingKey(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-1">
      <AppHeader
        right={
          <>
            {error && (
              <p className="hidden text-xs font-semibold text-accent-red sm:block">{error}</p>
            )}
            <RepoLink />
            <AccountMenu />
          </>
        }
      />

      <main className="flex-1 overflow-y-auto bg-surface-1">
        <section className="mx-auto flex w-full max-w-7xl flex-col px-5 py-7 sm:px-7 lg:px-10">
          <div className="mb-5">
            <h1 className="text-3xl font-black tracking-normal text-ink-primary">All Dives</h1>
            <a
              href="https://motherduck.com/docs/key-tasks/ai-and-motherduck/dives/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex text-sm font-semibold text-ink-secondary underline decoration-dotted underline-offset-4 transition-colors hover:text-ink-primary"
            >
              what are dives?
            </a>
          </div>
          <div className="overflow-hidden border-2 border-divider bg-surface-2 shadow-brutal-xl">
            {starters.map((starter) => {
              const isCustomizing = customizingKey === starter.key;

              return (
                <article
                  key={starter.key}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/dives/${encodeURIComponent(starter.key)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/dives/${encodeURIComponent(starter.key)}`);
                    }
                  }}
                  className="group grid cursor-pointer gap-4 border-b-2 border-divider bg-surface-3 p-4 transition-colors last:border-b-0 hover:bg-surface-3-hover focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-inset md:grid-cols-[280px_1fr_180px] md:items-center"
                >
                  <div className="relative aspect-[16/10] overflow-hidden border-2 border-divider bg-surface-0 md:h-[150px] md:w-[280px]">
                    {starter.session ? (
                      <div className="absolute inset-0 overflow-hidden">
                        {/* `allow-scripts allow-same-origin` together only sandbox a *cross-origin* src
                            (embed-motherduck.com). If you fork this and point the iframe at a same-origin
                            URL, the combination silently disables the sandbox — keep the src third-party. */}
                        <iframe
                          title={`${starter.label} preview`}
                          src={`https://embed-motherduck.com/sandbox/#session=${starter.session}`}
                          sandbox="allow-scripts allow-same-origin"
                          className="pointer-events-none h-[360%] w-[360%] origin-top-left scale-[0.277778] border-0"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-ink-muted animate-pulse">Loading preview...</p>
                      </div>
                    )}
                  </div>
                  <div className="flex min-h-[120px] flex-col justify-center gap-3">
                    <h2 className="text-2xl font-black tracking-normal text-ink-primary">
                      {starter.title}
                    </h2>
                    <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
                      {starter.description}
                    </p>
                  </div>
                  <div className="flex gap-3 md:justify-end">
                    <BrutalistButton
                      tone="primary"
                      shadow="md"
                      className="font-bold"
                      onClick={(event) => {
                        event.stopPropagation();
                        customize(starter);
                      }}
                      disabled={Boolean(customizingKey) || !starter.diveId}
                    >
                      <PencilIcon className="h-4 w-4" />
                      {isCustomizing ? "Remixing..." : "Remix"}
                    </BrutalistButton>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
