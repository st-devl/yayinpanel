import { ReactNode } from "react";
import { MaterialIcon } from "@/components/material-icon";

type TopbarProps = {
  title?: string;
  pathname: string;
  searchPlaceholder: string;
  slot?: ReactNode;
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Kontrol Paneli",
  "/accounts": "Hesap Bağlantıları",
  "/instagram": "Instagram Paneli",
  "/x": "X / Twitter Paneli",
  "/blog": "Blog Paneli",
  "/content": "Ortak İçerik Deposu",
  "/media": "Medya Kütüphanesi",
  "/logs": "Yayın Logları",
  "/settings": "Ayarlar"
};

export function Topbar({
  title,
  pathname,
  searchPlaceholder,
  slot
}: TopbarProps) {
  const resolvedTitle = title ?? pageTitles[pathname] ?? "İçerik Yönetimi";

  return (
    <header className="sticky top-0 z-40 flex min-h-[80px] w-full items-center justify-between gap-sm border-b border-outline-variant bg-surface px-base py-md sm:px-md lg:px-lg">
      <div className="flex min-w-0 flex-1 items-center gap-md">
        <h2 className="truncate font-headline-sm text-headline-sm font-bold text-primary lg:hidden">
          {resolvedTitle}
        </h2>
        <div className="relative hidden w-full max-w-md md:block">
          <MaterialIcon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            className="input-surface w-full rounded-full py-2 pl-10 pr-4 font-body-sm text-body-sm"
            placeholder={searchPlaceholder}
            type="search"
          />
        </div>
        {slot}
      </div>
      <div className="flex shrink-0 items-center gap-xs sm:gap-sm">
        <button
          className="relative rounded-full p-2 transition-colors hover:bg-surface-container-lowest"
          type="button"
          aria-label="Bildirimler"
        >
          <MaterialIcon name="notifications" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-error" />
        </button>
        <button
          className="rounded-full p-2 transition-colors hover:bg-surface-container-lowest"
          type="button"
          aria-label="Profil"
        >
          <MaterialIcon name="account_circle" />
        </button>
      </div>
    </header>
  );
}
