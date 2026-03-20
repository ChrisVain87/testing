import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create global world seed
  await prisma.globalSeed.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      seed: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)),
    },
  });

  // Seed some custom biomes as examples
  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
