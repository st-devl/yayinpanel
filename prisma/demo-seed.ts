import {
  ConnectionStatus,
  ContentStatus,
  Platform,
  PublishLogStatus
} from "@prisma/client";
import sharp from "sharp";
import {
  createInstagramAccount,
  createWordPressSite,
  createXAccount
} from "@/lib/server/account-credentials";
import { createContentCard } from "@/lib/server/content-cards";
import { storeUploadedMedia } from "@/lib/server/media-storage";
import { prisma } from "@/lib/server/prisma";

const demoLastError = "Demo kaydıdır; gerçek platform tokenı bağlı değildir.";

async function ensureInstagramAccount() {
  const existing = await prisma.instagramAccount.findFirst({
    where: { username: "patlat_demo_ig" },
    select: { id: true }
  });

  if (existing) {
    return existing;
  }

  return createInstagramAccount({
    accessToken: "demo-instagram-token",
    accountName: "Patlat Demo Instagram",
    connectionStatus: ConnectionStatus.DISCONNECTED,
    facebookPageId: "demo-facebook-page",
    instagramBusinessAccountId: "demo-instagram-business",
    lastError: demoLastError,
    username: "patlat_demo_ig"
  });
}

async function ensureXAccount() {
  const existing = await prisma.xAccount.findFirst({
    where: { username: "patlat_demo_x" },
    select: { id: true }
  });

  if (existing) {
    return existing;
  }

  return createXAccount({
    accessToken: "demo-x-token",
    accountName: "Patlat Demo X",
    connectionStatus: ConnectionStatus.DISCONNECTED,
    lastError: demoLastError,
    refreshToken: "demo-x-refresh-token",
    username: "patlat_demo_x",
    xUserId: "demo-x-user"
  });
}

async function ensureWordPressSite() {
  const existing = await prisma.wordPressSite.findFirst({
    where: { baseUrl: "https://demo.patlat.local" },
    select: { id: true }
  });

  if (existing) {
    return existing;
  }

  return createWordPressSite({
    applicationPassword: "demo-wordpress-application-password",
    baseUrl: "https://demo.patlat.local",
    connectionStatus: ConnectionStatus.DISCONNECTED,
    lastError: demoLastError,
    name: "Patlat Demo Blog",
    username: "demo-admin"
  });
}

async function createDemoImage(fileName: string, background: string) {
  const existing = await prisma.mediaFile.findFirst({
    where: { originalFileName: fileName }
  });

  if (existing) {
    return existing;
  }

  const svg = Buffer.from(`
    <svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="900" rx="48" fill="${background}" />
      <rect x="80" y="80" width="1040" height="740" rx="36" fill="rgba(255,255,255,0.72)" />
      <text x="120" y="430" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="700" fill="#0b1c30">Patlat Demo</text>
      <text x="120" y="520" font-family="Inter, Arial, sans-serif" font-size="36" fill="#45464d">${fileName}</text>
    </svg>
  `);
  const buffer = await sharp(svg).png().toBuffer();

  return storeUploadedMedia({
    buffer,
    mimeType: "image/png",
    originalFileName: fileName
  });
}

async function ensureContentCard(input: {
  accountId: string;
  accountType: string;
  marker: string;
  mediaFileId?: string | null;
  platform: Platform;
  platformData: unknown;
  scheduledAt?: Date | null;
  status: ContentStatus;
  text?: string | null;
}) {
  const existing = await prisma.contentCard.findFirst({
    where: {
      accountId: input.accountId,
      text: input.marker
    }
  });

  if (existing) {
    return existing;
  }

  return createContentCard({
    accountId: input.accountId,
    accountType: input.accountType,
    mediaFileId: input.mediaFileId,
    platform: input.platform,
    platformData: input.platformData,
    scheduledAt: input.scheduledAt,
    status: input.status,
    text: input.text ?? input.marker
  });
}

async function ensureDemoLog(accountId: string, contentCardId: string) {
  const existing = await prisma.publishLog.findFirst({
    where: {
      accountId,
      action: "demo_publish"
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.publishLog.create({
    data: {
      accountId,
      action: "demo_publish",
      contentCardId,
      platform: Platform.X,
      status: PublishLogStatus.OK,
      apiResponse: JSON.stringify({ demo: true })
    }
  });
}

async function main() {
  const [instagram, x, wordpress] = await Promise.all([
    ensureInstagramAccount(),
    ensureXAccount(),
    ensureWordPressSite()
  ]);
  const [campaignImage, blogImage] = await Promise.all([
    createDemoImage("patlat-demo-kampanya.png", "#d3e4fe"),
    createDemoImage("patlat-demo-blog.png", "#e0e3e5")
  ]);

  await ensureContentCard({
    accountId: instagram.id,
    accountType: "INSTAGRAM",
    marker: "Demo Instagram taslak gönderisi",
    mediaFileId: campaignImage.id,
    platform: Platform.INSTAGRAM,
    platformData: {
      captionStyle: "demo",
      hashtags: ["patlat"],
      postType: "IMAGE"
    },
    status: ContentStatus.DRAFT
  });

  const xPublished = await ensureContentCard({
    accountId: x.id,
    accountType: "X",
    marker: "Demo X yayınlanmış gönderi",
    platform: Platform.X,
    platformData: { hasMedia: false, isThread: false },
    status: ContentStatus.PUBLISHED
  });

  await ensureContentCard({
    accountId: x.id,
    accountType: "X",
    marker: "Demo X ileri tarihli planlı gönderi",
    platform: Platform.X,
    platformData: { hasMedia: false, isThread: false },
    scheduledAt: new Date("2099-01-01T09:00:00.000Z"),
    status: ContentStatus.SCHEDULED
  });

  await ensureContentCard({
    accountId: wordpress.id,
    accountType: "WORDPRESS",
    marker: "Demo blog taslağı",
    mediaFileId: blogImage.id,
    platform: Platform.WORDPRESS,
    platformData: {
      contentHtml: "<p>Demo blog içerik gövdesi.</p>",
      excerpt: "Demo blog içerik özeti.",
      publishStatus: "draft",
      slug: "demo-blog-taslagi",
      title: "Demo Blog Taslağı"
    },
    status: ContentStatus.DRAFT,
    text: "Demo blog içerik özeti."
  });

  await ensureDemoLog(x.id, xPublished.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Demo veriler hazır.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
