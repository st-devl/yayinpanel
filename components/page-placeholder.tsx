import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import type { ReactNode } from "react";

type PagePlaceholderProps = {
  title: string;
  description: string;
  icon: string;
  children?: ReactNode;
};

export function PagePlaceholder({
  title,
  description,
  icon,
  children
}: PagePlaceholderProps) {
  return (
    <AppShell title={title}>
      <section className="panel-card p-lg">
        <div className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-md">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest text-primary">
              <MaterialIcon name={icon} size={30} />
            </div>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-primary">
                {title}
              </h1>
              <p className="mt-xs max-w-2xl font-body-md text-body-md text-on-surface-variant">
                {description}
              </p>
            </div>
          </div>
          {children}
        </div>
      </section>
    </AppShell>
  );
}
