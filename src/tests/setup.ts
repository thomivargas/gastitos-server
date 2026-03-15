import { beforeAll, afterAll } from 'vitest';
import { prisma } from '@config/database';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
