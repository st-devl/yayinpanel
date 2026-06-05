"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  searchPlaceholder?: string;
  topbarSlot?: ReactNode;
};

export function AppShell({
  children,
  title,
  searchPlaceholder = "İçeriklerde ara...",
  topbarSlot
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Sidebar pathname={pathname} />
      <div className="min-h-screen lg:ml-sidebar-width">
        <Topbar
          title={title}
          pathname={pathname}
          searchPlaceholder={searchPlaceholder}
          slot={topbarSlot}
        />
        <main className="mx-auto min-h-[calc(100vh-80px)] max-w-container-max px-base pb-[96px] pt-lg sm:px-md lg:px-lg lg:pb-lg">
          {children}
        </main>
      </div>
      <MobileNav pathname={pathname} />
    </div>
  );
}
