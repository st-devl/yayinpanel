export type NavigationItem = {
  href: string;
  label: string;
  icon: string;
  mobileLabel?: string;
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Kontrol Paneli",
    icon: "dashboard",
    mobileLabel: "Ana Sayfa"
  },
  {
    href: "/accounts",
    label: "Hesap Bağlantıları",
    icon: "link",
    mobileLabel: "Hesaplar"
  },
  {
    href: "/instagram",
    label: "Instagram Paneli",
    icon: "photo_camera",
    mobileLabel: "İçerik"
  },
  {
    href: "/x",
    label: "X / Twitter Paneli",
    icon: "share",
    mobileLabel: "İçerik"
  },
  {
    href: "/blog",
    label: "Web Sitesi / Blog Paneli",
    icon: "web",
    mobileLabel: "İçerik"
  },
  {
    href: "/content",
    label: "Ortak İçerik Deposu",
    icon: "cloud",
    mobileLabel: "İçerik"
  },
  {
    href: "/review",
    label: "Onay Bekleyenler",
    icon: "pending_actions",
    mobileLabel: "Onay"
  },
  {
    href: "/media",
    label: "Medya Kütüphanesi",
    icon: "inventory_2",
    mobileLabel: "Medya"
  },
  {
    href: "/logs",
    label: "Yayın Logları",
    icon: "history",
    mobileLabel: "Loglar"
  },
  {
    href: "/settings",
    label: "Ayarlar",
    icon: "settings",
    mobileLabel: "Ayarlar"
  }
];

export const mobileNavigationItems = [
  navigationItems[0],
  navigationItems[1],
  navigationItems[5],
  navigationItems[6],
  navigationItems[8]
];
