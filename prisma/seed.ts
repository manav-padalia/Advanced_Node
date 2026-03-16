import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function ensureUser(
  email: string,
  password: string,
  role: 'ADMIN' | 'USER',
  firstName: string,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName: 'User',
        role,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`${role} user created:`, email);
  } else {
    console.log(`${role} user already exists:`, email);
  }
}

async function main() {
  await ensureUser('admin@ecommerce.com', 'Admin@1234', 'ADMIN', 'Admin');
  await ensureUser('user@ecommerce.com', 'User@1234', 'USER', 'User');

  // Create default categories
  const electronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic devices and gadgets',
    },
  });

  const clothing = await prisma.category.upsert({
    where: { slug: 'clothing' },
    update: {},
    create: {
      name: 'Clothing',
      slug: 'clothing',
      description: 'Apparel and fashion items',
    },
  });

  const books = await prisma.category.upsert({
    where: { slug: 'books' },
    update: {},
    create: {
      name: 'Books',
      slug: 'books',
      description: 'Books and reading materials',
    },
  });

  console.log('Seeded categories:', { electronics, clothing, books });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
