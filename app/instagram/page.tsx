import { AppShell } from "@/components/app-shell";
import { MaterialIcon } from "@/components/material-icon";
import { InstagramPanel } from "@/components/instagram/instagram-panel";
import { prisma } from "@/lib/server/prisma";
import { getSetting } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export default async function InstagramPage() {
  const [accounts, dailyLimit] = await Promise.all([
    prisma.instagramAccount.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, accountName: true, username: true }
    }),
    getSetting("IG_DAILY_POST_LIMIT")
  ]);

  return (
    <AppShell title="Instagram Paneli">
      <div className="space-y-md">
        <section className="flex items-start gap-sm rounded-xl border border-amber-200 bg-amber-50 p-md text-amber-900">
          <MaterialIcon name="info" className="shrink-0 text-amber-600" />
          <p className="font-body-md text-body-md">
            Instagram politikalari geregi gunde en fazla{" "}
            <strong>{dailyLimit} gonderi</strong> planlamaniz onerilir. Bu esik
            Ayarlar bolumunden degistirilebilir.
          </p>
        </section>

        <InstagramPanel accounts={accounts} />
      </div>
    </AppShell>
  );
}
