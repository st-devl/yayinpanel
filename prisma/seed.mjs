import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requiredEnv = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "TIMEZONE"];

function assertEnv() {
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`${key} is required for seed`);
    }
  }

  if (process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }
}

async function main() {
  assertEnv();

  const existingUser = await prisma.user.findFirst();

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

    await prisma.user.create({
      data: {
        email: process.env.ADMIN_EMAIL,
        passwordHash
      }
    });
  }

  await prisma.setting.upsert({
    where: { key: "TIMEZONE" },
    update: { value: process.env.TIMEZONE },
    create: { key: "TIMEZONE", value: process.env.TIMEZONE }
  });

  await prisma.setting.upsert({
    where: { key: "IG_DAILY_POST_LIMIT" },
    update: {},
    create: { key: "IG_DAILY_POST_LIMIT", value: "10" }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
