import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });

export let guestUserId: string;

export async function ensureGuestUser() {
  const guest = await prisma.user.upsert({
    where: { email: "guest@strategyforge.local" },
    update: {},
    create: { email: "guest@strategyforge.local", name: "Guest" },
  });
  guestUserId = guest.id;
}
