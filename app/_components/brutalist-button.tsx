import type { ButtonHTMLAttributes } from "react";

type Tone = "primary" | "success" | "neutral" | "danger";
type Shadow = "sm" | "md" | "lg" | "none";

type BrutalistButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  shadow?: Shadow;
};

const TONE_CLASSES: Record<Tone, string> = {
  primary: "bg-accent-blue text-ink-dark",
  success: "bg-accent-teal text-ink-dark",
  neutral: "bg-surface-4 text-ink-primary",
  danger: "bg-accent-red text-ink-primary",
};

const SHADOW_CLASSES: Record<Shadow, string> = {
  sm: "shadow-brutal-sm hover:translate-x-[2px] hover:-translate-y-[2px] active:translate-x-0 active:translate-y-0",
  md: "shadow-brutal-md hover:translate-x-[2px] hover:-translate-y-[2px] active:translate-x-0 active:translate-y-0",
  lg: "shadow-brutal-lg hover:translate-x-[3px] hover:-translate-y-[3px] active:translate-x-0 active:translate-y-0",
  none: "",
};

export function BrutalistButton({
  tone = "primary",
  shadow = "md",
  className = "",
  type = "button",
  ...props
}: BrutalistButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex items-center gap-2 rounded-[2px] border-2 border-divider px-4 py-2 text-sm font-semibold transition-transform disabled:opacity-40 ${TONE_CLASSES[tone]} ${SHADOW_CLASSES[shadow]} ${className}`}
    />
  );
}
