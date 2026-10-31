import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seed } from './seed-data.js';
const db = new PrismaClient();
try { await seed(db, process.env.SEED_DEMO === 'true' && process.env.NODE_ENV !== 'production'); console.info('Đã nạp 5 khóa học, 20 bài mẫu và 5 danh mục.'); }
finally { await db.$disconnect(); }
