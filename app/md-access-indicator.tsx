"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export const MD_AUTH_CHANGED_EVENT = "md-auth-changed";

export default function MdAccessIndicator() {
  const pathname = usePathname();
  const [motherduckUsername, setMotherduckUsername] = useState<string | null>(null);

  const refreshStatus = useCallback(() => {
    let cancelled = false;
    fetch("/api/auth-status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { account?: { motherduckUsername?: string | null } | null } | null) => {
        if (cancelled) return;
        setMotherduckUsername(data?.account?.motherduckUsername ?? null);
      })
      .catch(() => {
        if (!cancelled) setMotherduckUsername(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refreshStatus(), [pathname, refreshStatus]);

  useEffect(() => {
    const handleAuthChange = () => refreshStatus();
    window.addEventListener(MD_AUTH_CHANGED_EVENT, handleAuthChange);
    window.addEventListener("focus", handleAuthChange);
    return () => {
      window.removeEventListener(MD_AUTH_CHANGED_EVENT, handleAuthChange);
      window.removeEventListener("focus", handleAuthChange);
    };
  }, [refreshStatus]);

  if (!motherduckUsername) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-50 max-w-[calc(100vw-1.5rem)] border border-[#3b5f86]/55 bg-[#14283d]/90 px-3 py-2 font-mono text-[10px] leading-tight text-[#A8C7E8]/80 shadow-[-1px_1px_0_0_rgba(59,95,134,0.35)]">
      <div className="font-bold uppercase tracking-[0.08em]">Accessing MotherDuck as</div>
      <div className="mt-0.5 truncate font-semibold normal-case tracking-normal text-[#F4EFEA]/90">
        {motherduckUsername}
      </div>
    </div>
  );
}
