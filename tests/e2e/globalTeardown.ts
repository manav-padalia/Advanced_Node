import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  const prisma = new PrismaClient();
  try {
    // Clean up any dynamic e2e test users (e2e-user-*@test.com)
    const dynUsers = await prisma.user.findMany({
      where: { email: { contains: 'e2e-user-' } },
      select: { id: true },
    });
    if (dynUsers.length > 0) {
      const ids = dynUsers.map((u) => u.id);
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      console.log(
        `[globalTeardown] Deleted ${dynUsers.length} dynamic e2e user(s)`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
