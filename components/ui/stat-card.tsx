import { MaterialIcon } from "@/components/material-icon";
import { cn } from "@/lib/utils";

type StatCardProps = {
  icon: string;
  label: string;
  value: string | number;
  eyebrow: string;
  tone?: "blue" | "indigo" | "green" | "red" | "amber";
};

const toneClasses = {
  blue: "bg-blue-50 text-blue-600",
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-green-50 text-green-600",
  red: "bg-error-container text-error",
  amber: "bg-amber-50 text-amber-600"
};

export function StatCard({
  icon,
  label,
  value,
  eyebrow,
  tone = "blue"
}: StatCardProps) {
  const isError = tone === "red";

  return (
    <section
      className={cn(
        "panel-card p-md transition-all hover:-translate-y-1 hover:shadow-panel-sm",
        isError && "border-error"
      )}
    >
      <div className="mb-sm flex items-center justify-between">
        <span className={cn("rounded-lg p-2", toneClasses[tone])}>
          <MaterialIcon name={icon} fill />
        </span>
        <span
          className={cn(
            "font-label-sm text-label-sm",
            isError ? "font-bold text-error" : "text-on-surface-variant"
          )}
        >
          {eyebrow}
        </span>
      </div>
      <p
        className={cn(
          "font-label-md text-label-md",
          isError ? "font-bold text-error" : "text-on-surface-variant"
        )}
      >
        {label}
      </p>
      <h3
        className={cn(
          "mt-xs font-headline-lg text-headline-lg",
          isError && "text-error"
        )}
      >
        {value}
      </h3>
    </section>
  );
}
