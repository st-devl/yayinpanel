import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseURL =
  process.env.DESIGN_COMPARE_BASE_URL ??
  process.env.APP_BASE_URL ??
  "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-this-password";
const outputRoot = path.resolve(
  process.cwd(),
  "test-results",
  "design-comparison"
);

const pages = [
  {
    name: "giris",
    reference: "design/giri_sayfas/screen.png",
    route: "/login",
    requiresAuth: false
  },
  {
    name: "kontrol-paneli",
    reference: "design/kontrol_paneli/screen.png",
    route: "/dashboard",
    requiresAuth: true
  },
  {
    name: "hesap-baglantilari",
    reference: "design/hesap_ba_lant_lar/screen.png",
    route: "/accounts",
    requiresAuth: true
  },
  {
    name: "instagram",
    reference: "design/instagram_paneli/screen.png",
    route: "/instagram",
    requiresAuth: true
  },
  {
    name: "x-twitter",
    reference: "design/x_twitter_paneli/screen.png",
    route: "/x",
    requiresAuth: true
  },
  {
    name: "blog",
    reference: "design/web_sitesi_blog_paneli/screen.png",
    route: "/blog",
    requiresAuth: true
  },
  {
    name: "icerik-deposu",
    reference: "design/ortak_i_erik_deposu/screen.png",
    route: "/content",
    requiresAuth: true
  },
  {
    name: "medya",
    reference: "design/medya_k_t_phanesi/screen.png",
    route: "/media",
    requiresAuth: true
  }
];

async function login(page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', adminEmail);
  await page.fill('input[name="password"]', adminPassword);
  await Promise.all([
    page.waitForURL("**/dashboard", { timeout: 15_000 }),
    page.click('button[type="submit"]')
  ]);
}

async function normalizedPixels(filePath, width, height) {
  const resized = await sharp(filePath)
    .resize({ width })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const metadata = await sharp(resized).metadata();
  let image = sharp(resized);

  if ((metadata.height ?? 0) < height) {
    image = image.extend({
      background: "#ffffff",
      bottom: height - (metadata.height ?? 0)
    });
  } else if ((metadata.height ?? 0) > height) {
    image = image.extract({
      height,
      left: 0,
      top: 0,
      width
    });
  }

  return image.raw().toBuffer();
}

function comparePixelBuffers(reference, actual) {
  const channels = 3;
  const totalPixels = reference.length / channels;
  let mismatchedPixels = 0;
  let deltaSum = 0;
  let luminanceSum = 0;
  let luminanceSquareSum = 0;

  for (let index = 0; index < reference.length; index += channels) {
    const delta =
      (Math.abs(reference[index] - actual[index]) +
        Math.abs(reference[index + 1] - actual[index + 1]) +
        Math.abs(reference[index + 2] - actual[index + 2])) /
      channels;

    if (delta > 36) {
      mismatchedPixels += 1;
    }

    deltaSum += delta;

    const luminance =
      0.2126 * actual[index] +
      0.7152 * actual[index + 1] +
      0.0722 * actual[index + 2];
    luminanceSum += luminance;
    luminanceSquareSum += luminance * luminance;
  }

  const meanLuminance = luminanceSum / totalPixels;
  const variance = luminanceSquareSum / totalPixels - meanLuminance ** 2;

  return {
    averageDelta: Number((deltaSum / totalPixels).toFixed(2)),
    blankLike: Math.sqrt(Math.max(variance, 0)) < 3,
    mismatchRatio: Number((mismatchedPixels / totalPixels).toFixed(4))
  };
}

async function compareImages(referencePath, actualPath) {
  const referenceMetadata = await sharp(referencePath).metadata();
  const actualMetadata = await sharp(actualPath).metadata();
  const width = referenceMetadata.width ?? actualMetadata.width ?? 1;
  const height = referenceMetadata.height ?? actualMetadata.height ?? 1;
  const [referencePixels, actualPixels] = await Promise.all([
    normalizedPixels(referencePath, width, height),
    normalizedPixels(actualPath, width, height)
  ]);
  const comparison = comparePixelBuffers(referencePixels, actualPixels);

  return {
    actualHeight: actualMetadata.height,
    actualWidth: actualMetadata.width,
    heightCoverage: Number(
      (((actualMetadata.height ?? 0) / height) * 100).toFixed(1)
    ),
    referenceHeight: referenceMetadata.height,
    referenceWidth: referenceMetadata.width,
    ...comparison
  };
}

async function main() {
  await mkdir(path.join(outputRoot, "actual"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL });
  let authenticated = false;
  const summaries = [];

  try {
    for (const item of pages) {
      const referencePath = path.resolve(process.cwd(), item.reference);
      const referenceMetadata = await sharp(referencePath).metadata();
      const width = referenceMetadata.width ?? 1440;

      await page.setViewportSize({
        height: Math.min(referenceMetadata.height ?? 1000, 1000),
        width
      });

      if (item.requiresAuth && !authenticated) {
        await login(page);
        authenticated = true;
      }

      await page.goto(item.route, { waitUntil: "networkidle" });
      await page.screenshot({
        fullPage: true,
        path: path.join(outputRoot, "actual", `${item.name}.png`)
      });

      const actualPath = path.join(outputRoot, "actual", `${item.name}.png`);
      const comparison = await compareImages(referencePath, actualPath);
      summaries.push({
        name: item.name,
        reference: item.reference,
        route: item.route,
        ...comparison
      });
    }
  } finally {
    await browser.close();
  }

  await writeFile(
    path.join(outputRoot, "summary.json"),
    `${JSON.stringify(summaries, null, 2)}\n`
  );

  console.table(
    summaries.map((summary) => ({
      page: summary.name,
      route: summary.route,
      mismatch: summary.mismatchRatio,
      avgDelta: summary.averageDelta,
      heightCoverage: `${summary.heightCoverage}%`,
      blankLike: summary.blankLike
    }))
  );

  const failed = summaries.filter(
    (summary) => summary.blankLike || summary.heightCoverage < 35
  );

  if (failed.length) {
    throw new Error(
      `Design comparison failed basic layout checks: ${failed
        .map((summary) => summary.name)
        .join(", ")}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
