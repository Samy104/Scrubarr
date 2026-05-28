import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; seeded?: boolean };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.LOG_LEVEL === 'DEBUG' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Seed default cleanup rules once per process.
if (!globalForPrisma.seeded) {
  globalForPrisma.seeded = true;
  // Defer to avoid require cycles between db.ts and seedCleanup.ts at module load
  import('./seedCleanup').then(({ seedCleanupRulesIfEmpty }) => seedCleanupRulesIfEmpty().catch(() => {}));
}
