/**
 * Prisma seed script
 *
 * Seeds the database with:
 *   - 3 default templates (Aniversariantes, Pedido de Oração, Aviso Geral)
 *   - 1 initial Administrator account  (username: admin / password: Admin@123)
 *
 * Run with: npx ts-node prisma/seed.ts
 *           — or via npm script: npm run prisma:seed
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = [
  {
    title: 'Aniversariantes',
    body: 'Parabenizamos os aniversariantes do dia. Que Deus os abençoe abundantemente!',
    isDefault: true,
  },
  {
    title: 'Pedido de Oração',
    body: 'Por favor, unamo-nos em oração pelo seguinte pedido: [descreva aqui o pedido].',
    isDefault: true,
  },
  {
    title: 'Aviso Geral',
    body: '[Insira aqui o aviso a ser comunicado à congregação.]',
    isDefault: true,
  },
] as const;

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = process.env['ADMIN_INITIAL_PASSWORD'] ?? randomBytes(18).toString('base64url');

if (process.env['NODE_ENV'] === 'production' && !process.env['ADMIN_INITIAL_PASSWORD']) {
  throw new Error('ADMIN_INITIAL_PASSWORD is required when seeding production');
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...\n');

  // ── Default templates ────────────────────────────────────────────────────
  for (const template of DEFAULT_TEMPLATES) {
    const created = await prisma.template.upsert({
      where: { id: `default-${template.title.toLowerCase().replace(/\s+/g, '-')}` },
      update: { title: template.title, body: template.body, isDefault: true },
      create: {
        id: `default-${template.title.toLowerCase().replace(/\s+/g, '-')}`,
        title: template.title,
        body: template.body,
        isDefault: true,
      },
    });
    console.log(`  ✔ Template: "${created.title}" (id: ${created.id})`);
  }

  // ── Initial Administrator account ────────────────────────────────────────
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {},
    create: {
      username: ADMIN_USERNAME,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`\n  ✔ Admin user created/verified (id: ${admin.id})`);
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│          Initial Admin Credentials        │');
  console.log('├─────────────────────────────────────────┤');
  console.log(`│  Username : ${ADMIN_USERNAME.padEnd(29)}│`);
  console.log(`│  Password : ${ADMIN_PASSWORD.padEnd(29)}│`);
  console.log('│                                           │');
  console.log('│  ⚠  Change this password after first     │');
  console.log('│     login in a production environment.    │');
  console.log('└─────────────────────────────────────────┘\n');
  console.log('✅ Seed completed successfully.');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
