import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const DEFAULT_TIMEZONE = "Europe/Istanbul";
const bootstrapEnvSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(12)
});

async function main() {
  const existingUser = await prisma.user.findFirst();
  const timezone = process.env.TIMEZONE || DEFAULT_TIMEZONE;

  if (!existingUser) {
    const bootstrapEnv = bootstrapEnvSchema.parse({
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
    });
    const passwordHash = await bcrypt.hash(bootstrapEnv.ADMIN_PASSWORD, 12);

    await prisma.user.create({
      data: {
        email: bootstrapEnv.ADMIN_EMAIL,
        passwordHash
      }
    });
  }

  await prisma.setting.upsert({
    where: { key: "TIMEZONE" },
    update: { value: timezone },
    create: { key: "TIMEZONE", value: timezone }
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
