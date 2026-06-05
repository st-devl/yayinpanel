import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "success" | "warning" | "error" | "info" | "neutral";
  className?: string;
};

const toneClasses = {
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-error-container text-on-error-container",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-surface-container text-on-surface-variant"
};

export function StatusBadge({
  children,
  tone = "neutral",
  className
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-bold leading-tight",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
