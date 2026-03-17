import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const ADMIN_EMAIL = 'admin@ecommerce.com';
const USER_EMAIL = 'user@ecommerce.com';
const ADMIN_PASSWORD = 'Admin@1234';

export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    // Delete refresh tokens first (FK constraint), then users
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { in: [ADMIN_EMAIL, USER_EMAIL] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, USER_EMAIL] } },
    });

    // Re-create admin with ADMIN role (register API only creates USER role)
    const passwordHash = await argon2.hash(ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });

    console.log('[globalSetup] Admin user recreated with ADMIN role');
    console.log(
      '[globalSetup] user@ecommerce.com will be registered via API in tests'
    );
  } finally {
    await prisma.$disconnect();
  }
}
