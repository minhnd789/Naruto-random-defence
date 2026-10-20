import { resolve } from 'node:path';
import { buildApp } from './app';
import { loadSecret } from './auth';
import { migrate, openDb } from './db';
import { backfillGearVariants, backfillStarterGear } from './gear';

const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data');
const PORT = Number(process.env.PORT ?? 5181);

const db = await openDb(DATA_DIR);
await migrate(db);
const gifted = await backfillStarterGear(db);
if (gifted) console.log(`Đã tặng đồ khởi đầu cho ${gifted} tài khoản cũ`);
const named = await backfillGearVariants(db);
if (named) console.log(`Đã gán mẫu cho ${named} món trang bị cũ`);
const app = await buildApp(db, loadSecret(DATA_DIR), { devTools: process.env.NODE_ENV !== 'production', logger: true });
await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`Máy chủ chạy tại http://localhost:${PORT} (CSDL: ${db.kind})`);

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
