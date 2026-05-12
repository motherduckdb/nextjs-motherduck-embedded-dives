import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRightIcon, MotherDuckLogo } from "./icons";

type AppHeaderProps = {
  meta?: { title: string; description?: string } | null;
  right?: ReactNode;
};

export function AppHeader({ meta, right }: AppHeaderProps) {
  return (
    <header className="grid h-[52px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-divider-header bg-surface-2 px-5">
      <Link href="/" aria-label="Back to gallery" className="flex items-center gap-3">
        <MotherDuckLogo className="shrink-0" />
        <span className="text-[15px] font-semibold text-ink-primary tracking-[-0.01em]">
          MotherDuck
        </span>
      </Link>
      {meta ? (
        <div className="hidden min-w-0 flex-col sm:flex">
          <p className="truncate text-sm font-semibold text-ink-primary">{meta.title}</p>
          {meta.description ? (
            <p className="truncate text-xs text-ink-secondary">{meta.description}</p>
          ) : null}
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-3 justify-self-end">{right}</div>
    </header>
  );
}

export function RepoLink() {
  return (
    <a
      href="https://github.com/motherduckdb/nextjs-motherduck-embedded-dives"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary transition-colors hover:text-ink-primary"
    >
      Repo
      <ArrowUpRightIcon className="h-3.5 w-3.5" />
    </a>
  );
}
