"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { MD_AUTH_CHANGED_EVENT } from "./md-access-indicator";

export default function AccountMenu() {
  const router = useRouter();
  const [usePersonalMotherDuckToken, setUsePersonalMotherDuckToken] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth-status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: {
        account?: { email?: string | null } | null;
        usePersonalMotherDuckToken?: boolean;
      }) => {
        if (cancelled) return;
        setUsePersonalMotherDuckToken(Boolean(data.usePersonalMotherDuckToken));
        setEmail(data.account?.email ?? null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await signOut({ redirect: false });
    sessionStorage.clear();
    window.dispatchEvent(new Event(MD_AUTH_CHANGED_EVENT));
    router.replace("/login");
  }

  if (!email) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Open account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#383838] bg-[#F4EFEA] shadow-[-2px_2px_0_0_#383838] transition-transform hover:translate-x-[1px] hover:-translate-y-[1px]"
      >
        <Image
          src="/duck-icon.png"
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded-full object-contain"
        />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-64 border-2 border-[#383838] bg-[#141418] p-3 shadow-[-4px_4px_0_0_#383838]">
          <div className="border-b-2 border-[#383838] pb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#A8B3C2]">
              Signed in
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-[#F4EFEA]">
              {email ?? "Unknown user"}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {usePersonalMotherDuckToken && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/motherduck-token?replace=1");
                }}
                className="border-2 border-[#383838] bg-[#141418] px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.06em] text-[#F4EFEA] transition-colors hover:bg-[#1b2028]"
              >
                MotherDuck token
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="border-2 border-[#383838] bg-[#F4EFEA] px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.06em] text-[#383838] transition-colors hover:bg-[#e5ded6]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
