"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth-status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: {
        redirectTo?: string | null;
      }) => {
        if (cancelled) return;
        if (!data.redirectTo) {
          router.replace("/");
          return;
        }
        if (data.redirectTo !== "/login") {
          router.replace(data.redirectTo);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not check auth status.");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not create account.");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        router.replace("/login");
        return;
      }
      const status = (await fetch("/api/auth-status", { cache: "no-store" }).then((res) =>
        res.json()
      )) as { redirectTo?: string | null };
      router.replace(status.redirectTo === "/motherduck-token" ? "/motherduck-token" : "/");
    } catch {
      setError("Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#0c0c10] px-5">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 border-2 border-[#383838] bg-[#141418] p-5 shadow-[-6px_6px_0_0_#383838]"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-[#F4EFEA]">Create account</h1>
          <p className="text-sm leading-6 text-[#A8B3C2]">
            Join with your MotherDuck token.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.06em] text-[#A8B3C2]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="h-11 border-2 border-[#383838] bg-[#0a0a0e] px-3 text-sm normal-case tracking-normal text-[#F4EFEA] outline-none focus:border-[#6FC2FF]"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-[0.06em] text-[#A8B3C2]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className="h-11 border-2 border-[#383838] bg-[#0a0a0e] px-3 text-sm normal-case tracking-normal text-[#F4EFEA] outline-none focus:border-[#6FC2FF]"
          />
        </label>
        {error && <p className="text-sm font-semibold text-[#FF7169]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="h-11 border-2 border-[#383838] bg-[#6FC2FF] px-4 text-sm font-bold text-[#383838] shadow-[-3px_3px_0_0_#383838] transition-transform hover:translate-x-[2px] hover:-translate-y-[2px] disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create account"}
        </button>
        <p className="text-center text-sm text-[#A8B3C2]">
          Have account?{" "}
          <Link href="/login" className="font-semibold text-[#6FC2FF] underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
