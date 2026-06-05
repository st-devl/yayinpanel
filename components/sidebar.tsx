import Link from "next/link";
import { MaterialIcon } from "@/components/material-icon";
import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarProps = {
  pathname: string;
};

export function Sidebar({ pathname }: SidebarProps) {
  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 hidden h-screen w-sidebar-width flex-col border-r border-outline-variant bg-surface lg:flex">
      <div className="px-md py-lg">
        <h1 className="font-headline-md text-headline-md font-bold text-primary">
          İçerik Yönetimi
        </h1>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Profesyonel Ajans Paneli
        </p>
      </div>

      <nav className="flex-1 space-y-xs overflow-y-auto px-base">
        {navigationItems.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-sm px-4 py-3 font-body-md text-body-md transition-colors",
                active
                  ? "border-l-4 border-primary bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <MaterialIcon name={item.icon} fill={active} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-outline-variant p-md">
        <div className="flex items-center gap-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container font-label-md text-on-primary">
            A
          </div>
          <div>
            <p className="font-label-md text-label-md font-bold text-on-surface">
              Admin
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              Kişisel Panel
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
