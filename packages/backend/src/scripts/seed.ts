/**
 * Seed script: creates a demo classroom + tutor + 3 students with real argon2 hashes.
 * Run after `npm run infra:up` — idempotent (uses INSERT ... ON CONFLICT).
 *
 * Usage: npm -w @classroom/backend run db:seed
 */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { entities } from '../entities';

const envPath = existsSync('.env') ? '.env' : '.env.example';
dotenvConfig({ path: envPath });
const { config } = require('../config/configuration');

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    entities,
    synchronize: false,
  });
  await ds.initialize();

  const password = 'Password123!';
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  await ds.transaction(async (m) => {
    await m.query(`
      INSERT INTO classrooms (id, name) VALUES
        ('11111111-1111-1111-1111-111111111111', 'Classroom A')
      ON CONFLICT (id) DO NOTHING
    `);

    const users = [
      ['22222222-2222-2222-2222-222222222222', 'tutor1', 'المعلم الأول', 'TUTOR'],
      ['33333333-3333-3333-3333-333333333333', 'student1', 'أحمد محمد', 'STUDENT'],
      ['44444444-4444-4444-4444-444444444444', 'student2', 'فاطمة الزهراء', 'STUDENT'],
      ['55555555-5555-5555-5555-555555555555', 'student3', 'يوسف عبدالله', 'STUDENT'],
    ];
    for (const [id, username, display, role] of users) {
      await m.query(
        `
        INSERT INTO users (id, classroom_id, username, display_name, password_hash, role)
        VALUES ($1, '11111111-1111-1111-1111-111111111111', $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `,
        [id, username, display, hash, role],
      );
    }

    await m.query(`
      INSERT INTO exams (id, classroom_id, author_id, title, description, default_duration, is_published)
      VALUES (
        '66666666-6666-6666-6666-666666666666',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        'اختبار الرياضيات — الفصل الأول',
        'اختبار تجريبي لاختبار النظام',
        30,
        TRUE
      )
      ON CONFLICT (id) DO NOTHING
    `);

    // Replace questions deterministically.
    await m.query(`DELETE FROM questions WHERE exam_id = '66666666-6666-6666-6666-666666666666'`);
    await m.query(`
      INSERT INTO questions (exam_id, ordinal, prompt, choices, correct_id, points) VALUES
      ('66666666-6666-6666-6666-666666666666', 1, 'كم يساوي ٢ + ٢؟',
       '[{"id":"a","text":"٣"},{"id":"b","text":"٤"},{"id":"c","text":"٥"},{"id":"d","text":"٦"}]'::jsonb, 'b', 1),
      ('66666666-6666-6666-6666-666666666666', 2, 'ما هو الجذر التربيعي للعدد ٩؟',
       '[{"id":"a","text":"٢"},{"id":"b","text":"٣"},{"id":"c","text":"٤"},{"id":"d","text":"٥"}]'::jsonb, 'b', 1),
      ('66666666-6666-6666-6666-666666666666', 3, 'كم عدد أضلاع المثلث؟',
       '[{"id":"a","text":"٢"},{"id":"b","text":"٣"},{"id":"c","text":"٤"},{"id":"d","text":"٥"}]'::jsonb, 'b', 1)
    `);
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login: tutor1 / Password123!  (or student1/2/3 / Password123!)');
  await ds.destroy();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
