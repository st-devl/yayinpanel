import "server-only";

import { access, constants, readdir, stat } from "fs/promises";
import path from "path";
import { getEnv } from "@/lib/server/env";
import { getAllSettings } from "@/lib/server/settings";
import { prisma } from "@/lib/server/prisma";

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

type DirectoryInfo = {
  configuredPath: string;
  absolutePath: string;
  exists: boolean;
  isDirectory: boolean;
  writable: boolean;
};

type FileInfo = {
  configuredPath: string;
  absolutePath: string;
  exists: boolean;
  size: number | null;
  updatedAt: string | null;
};

type BackupFile = {
  fileName: string;
  absolutePath: string;
  size: number;
  createdAt: string;
};

function resolveFromProject(value: string) {
  return path.isAbsolute(value)
    ? value
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), value);
}

function sqliteCandidates(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return [];
  }

  const sqlitePath = databaseUrl.slice("file:".length);

  if (path.isAbsolute(sqlitePath)) {
    return [sqlitePath];
  }

  return [
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), sqlitePath),
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), "prisma", sqlitePath)
  ];
}

async function getDirectoryInfo(
  configuredPath: string
): Promise<DirectoryInfo> {
  const absolutePath = resolveFromProject(configuredPath);

  try {
    const stats = await stat(absolutePath);
    const isDirectory = stats.isDirectory();
    let writable = false;

    if (isDirectory) {
      writable = await access(absolutePath, constants.W_OK)
        .then(() => true)
        .catch(() => false);
    }

    return {
      absolutePath,
      configuredPath,
      exists: true,
      isDirectory,
      writable
    };
  } catch {
    return {
      absolutePath,
      configuredPath,
      exists: false,
      isDirectory: false,
      writable: false
    };
  }
}

async function getDatabaseFileInfo(databaseUrl: string): Promise<FileInfo> {
  const candidates = sqliteCandidates(databaseUrl);
  const fallbackPath = candidates[0] ?? databaseUrl;

  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);

      if (stats.isFile()) {
        return {
          absolutePath: candidate,
          configuredPath: databaseUrl,
          exists: true,
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        };
      }
    } catch {
      // Try the next candidate. Prisma resolves relative SQLite paths from the
      // schema directory, while shell scripts often run from the project root.
    }
  }

  return {
    absolutePath: fallbackPath,
    configuredPath: databaseUrl,
    exists: false,
    size: null,
    updatedAt: null
  };
}

async function listLatestBackups(
  backupDirectory: DirectoryInfo,
  prefix: string
): Promise<BackupFile[]> {
  if (!backupDirectory.exists || !backupDirectory.isDirectory) {
    return [];
  }

  const entries = await readdir(backupDirectory.absolutePath).catch(() => []);
  const matchingFiles = entries.filter((entry) => entry.startsWith(prefix));
  const files = await Promise.all(
    matchingFiles.map(async (fileName) => {
      const absolutePath = path.join(backupDirectory.absolutePath, fileName);
      const stats = await stat(absolutePath).catch(() => null);

      if (!stats?.isFile()) {
        return null;
      }

      return {
        absolutePath,
        createdAt: stats.mtime.toISOString(),
        fileName,
        size: stats.size
      };
    })
  );

  return files
    .filter((file): file is BackupFile => Boolean(file))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function healthItem(
  title: string,
  value: string,
  description: string,
  icon: string,
  tone: StatusTone
) {
  return { description, icon, title, tone, value };
}

export async function getSystemStatus() {
  const env = getEnv();
  const settings = await getAllSettings();
  const backupDirectory = await getDirectoryInfo(settings.BACKUP_PATH);
  const storageDirectory = await getDirectoryInfo(env.STORAGE_DIR);
  const databaseFile = await getDatabaseFileInfo(env.DATABASE_URL);
  const dbBackups = await listLatestBackups(backupDirectory, "patlat-db-");
  const mediaBackups = await listLatestBackups(
    backupDirectory,
    "patlat-media-"
  );

  let databaseReachable = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  }

  const [
    contentCardCount,
    scheduledCardCount,
    mediaFileCount,
    publishLogCount
  ] = await Promise.all([
    prisma.contentCard.count(),
    prisma.contentCard.count({ where: { status: "SCHEDULED" } }),
    prisma.mediaFile.count(),
    prisma.publishLog.count()
  ]);

  const telegramEnabled = settings.TELEGRAM_ENABLED === "true";
  const telegramConfigured = Boolean(
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
  );

  return {
    backup: {
      database: {
        command: `DATABASE_URL=${shellQuote(env.DATABASE_URL)} ./scripts/backup-db.sh ${shellQuote(settings.BACKUP_PATH)}`,
        file: databaseFile,
        latestFiles: dbBackups
      },
      media: {
        command: `STORAGE_DIR=${shellQuote(env.STORAGE_DIR)} ./scripts/backup-media.sh ${shellQuote(settings.BACKUP_PATH)}`,
        latestFiles: mediaBackups,
        storage: storageDirectory
      },
      path: backupDirectory,
      retentionDays: 14
    },
    checkedAt: new Date().toISOString(),
    counters: {
      contentCardCount,
      mediaFileCount,
      publishLogCount,
      scheduledCardCount
    },
    health: [
      healthItem(
        "Web Uygulaması",
        "Çalışıyor",
        "Bu sayfa server render aldığı için web process yanıt veriyor.",
        "dns",
        "success"
      ),
      healthItem(
        "SQLite Veritabanı",
        databaseReachable ? "Bağlı" : "Erişilemiyor",
        databaseFile.exists
          ? `Dosya bulundu: ${databaseFile.absolutePath}`
          : `Dosya bulunamadı: ${databaseFile.absolutePath}`,
        "database",
        databaseReachable && databaseFile.exists ? "success" : "error"
      ),
      healthItem(
        "Medya Storage",
        storageDirectory.exists && storageDirectory.isDirectory
          ? "Hazır"
          : "Eksik",
        storageDirectory.absolutePath,
        "folder",
        storageDirectory.exists && storageDirectory.isDirectory
          ? "success"
          : "warning"
      ),
      healthItem(
        "Yedekleme Klasörü",
        backupDirectory.exists
          ? backupDirectory.writable
            ? "Yazılabilir"
            : "Yazma izni yok"
          : "Henüz yok",
        backupDirectory.absolutePath,
        "backup",
        backupDirectory.exists
          ? backupDirectory.writable
            ? "success"
            : "error"
          : "warning"
      ),
      healthItem(
        "Scheduler",
        "Ayrı Process",
        "Durum doğrulaması için npm run scheduler:dry komutu kullanılmalı.",
        "timer",
        "info"
      ),
      healthItem(
        "Telegram",
        telegramEnabled
          ? telegramConfigured
            ? "Aktif"
            : "Env Eksik"
          : "Pasif",
        telegramEnabled
          ? "Bildirim için TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID gerekir."
          : "TELEGRAM_ENABLED=false",
        "send",
        telegramEnabled
          ? telegramConfigured
            ? "success"
            : "warning"
          : "neutral"
      )
    ],
    settings
  };
}
