"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MD_AUTH_CHANGED_EVENT } from "@/app/md-access-indicator";

type AuthStatus = {
  redirectTo?: string | null;
  usePersonalMotherDuckToken?: boolean;
  motherDuckTokenAppName?: string;
  motherDuckTokenRequestUrl?: string;
};

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h9v9" />
    </svg>
  );
}

export default function MotherDuckTokenPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appName, setAppName] = useState("motherduck-dives");
  const [tokenRequestUrl, setTokenRequestUrl] = useState(
    "https://app.motherduck.com/token-request?appName=motherduck-dives"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const allowReplace =
      new URLSearchParams(window.location.search).get("replace") === "1";

    fetch("/api/auth-status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: AuthStatus) => {
        if (cancelled) return;
        if (!data.usePersonalMotherDuckToken) {
          router.replace("/");
          return;
        }
        if (data.redirectTo === "/login") {
          router.replace(data.redirectTo);
          return;
        }
        if (data.redirectTo !== "/motherduck-token" && !allowReplace) {
          router.replace("/");
          return;
        }
        setAppName(data.motherDuckTokenAppName ?? "motherduck-dives");
        setTokenRequestUrl(
          data.motherDuckTokenRequestUrl ??
            "https://app.motherduck.com/token-request?appName=motherduck-dives"
        );
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not check MotherDuck auth status.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/motherduck-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save MotherDuck token.");
        return;
      }
      window.dispatchEvent(new Event(MD_AUTH_CHANGED_EVENT));
      router.replace("/");
    } catch {
      setError("Could not save MotherDuck token.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#0c0c10] px-5">
      <form
        onSubmit={submit}
        className="flex w-full max-w-lg flex-col gap-4 border-2 border-[#383838] bg-[#141418] p-5 shadow-[-6px_6px_0_0_#383838]"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-[#F4EFEA]">Connect MotherDuck</h1>
          <p className="text-sm leading-6 text-[#A8B3C2]">
            Create a read/write token named {appName}, then paste it here.
          </p>
        </div>

        <a
          href={tokenRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 border-2 border-[#383838] bg-[#FF9538] px-4 text-sm font-bold text-[#383838] shadow-[-3px_3px_0_0_#383838] transition-transform hover:translate-x-[2px] hover:-translate-y-[2px]"
        >
          Create MotherDuck token
          <ArrowUpRightIcon className="h-4 w-4" />
        </a>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.06em] text-[#A8B3C2]">
          MotherDuck token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            required
            className="h-11 border-2 border-[#383838] bg-[#0a0a0e] px-3 font-mono text-sm normal-case tracking-normal text-[#F4EFEA] outline-none focus:border-[#6FC2FF] disabled:opacity-60"
          />
        </label>

        {error && <p className="text-sm font-semibold text-[#FF7169]">{error}</p>}

        <button
          type="submit"
          disabled={loading || saving}
          className="h-11 border-2 border-[#383838] bg-[#6FC2FF] px-4 text-sm font-bold text-[#383838] shadow-[-3px_3px_0_0_#383838] transition-transform hover:translate-x-[2px] hover:-translate-y-[2px] disabled:opacity-50"
        >
          {saving ? "Verifying..." : loading ? "Loading..." : "Save token"}
        </button>
      </form>
    </main>
  );
}
