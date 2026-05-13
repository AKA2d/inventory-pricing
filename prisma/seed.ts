import "dotenv/config";
import { z } from "zod";
import { Role } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/prisma";

const seedEnv = z.object({
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(12).default("ChangeMeNow123!"),
});

async function main() {
  const env = seedEnv.parse(process.env);
  const password = env.ADMIN_PASSWORD;

  await prisma.user.upsert({
    where: { username: env.ADMIN_USERNAME },
    update: {
      passwordHash: await hashPassword(password),
      role: Role.ADMIN,
    },
    create: {
      username: env.ADMIN_USERNAME,
      passwordHash: await hashPassword(password),
      role: Role.ADMIN,
    },
  });

  console.log(`Seeded admin user: ${env.ADMIN_USERNAME}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
