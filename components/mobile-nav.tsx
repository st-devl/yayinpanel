import Link from "next/link";
import { MaterialIcon } from "@/components/material-icon";
import { mobileNavigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  pathname: string;
};

export function MobileNav({ pathname }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-outline-variant bg-surface px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-lg lg:hidden">
      {mobileNavigationItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-2 font-label-sm text-label-sm transition-all active:scale-90",
              active
                ? "bg-primary-container text-on-primary"
                : "text-on-surface-variant"
            )}
          >
            <MaterialIcon name={item.icon} fill={active} />
            <span className="max-w-full truncate leading-tight">
              {item.mobileLabel ?? item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
