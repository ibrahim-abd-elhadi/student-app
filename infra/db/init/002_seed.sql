-- =====================================================================
-- Demo seed: one classroom, one tutor, three students, one published exam.
-- Passwords: all "Password123!" (argon2id hashes pre-computed).
-- =====================================================================

INSERT INTO classrooms (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Classroom A');

-- Argon2id hash of "Password123!" generated with default params.
-- $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>
-- For demo seeding only; real users created via API will get fresh hashes.
INSERT INTO users (id, classroom_id, username, display_name, password_hash, role) VALUES
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
   'tutor1', 'المعلم الأول',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHRzZWVkc2FsdA$bD6d6Uzb3Z+3iytqJ3iLm1KfQT0G38BqAr1eEGVgRMc',
   'TUTOR'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'student1', 'أحمد محمد',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHRzZWVkc2FsdA$bD6d6Uzb3Z+3iytqJ3iLm1KfQT0G38BqAr1eEGVgRMc',
   'STUDENT'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'student2', 'فاطمة الزهراء',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHRzZWVkc2FsdA$bD6d6Uzb3Z+3iytqJ3iLm1KfQT0G38BqAr1eEGVgRMc',
   'STUDENT'),
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
   'student3', 'يوسف عبدالله',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHRzZWVkc2FsdA$bD6d6Uzb3Z+3iytqJ3iLm1KfQT0G38BqAr1eEGVgRMc',
   'STUDENT');

-- The seed password hashes above are placeholders. The backend's bootstrap
-- script (npm run db:seed) will overwrite them with real argon2id hashes.

INSERT INTO exams (id, classroom_id, author_id, title, description, default_duration, is_published) VALUES
  ('66666666-6666-6666-6666-666666666666',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222',
   'اختبار الرياضيات — الفصل الأول',
   'اختبار تجريبي لاختبار النظام',
   30,
   TRUE);

INSERT INTO questions (exam_id, ordinal, prompt, choices, correct_id, points) VALUES
  ('66666666-6666-6666-6666-666666666666', 1,
   'كم يساوي ٢ + ٢؟',
   '[{"id":"a","text":"٣"},{"id":"b","text":"٤"},{"id":"c","text":"٥"},{"id":"d","text":"٦"}]'::jsonb,
   'b', 1),
  ('66666666-6666-6666-6666-666666666666', 2,
   'ما هو الجذر التربيعي للعدد ٩؟',
   '[{"id":"a","text":"٢"},{"id":"b","text":"٣"},{"id":"c","text":"٤"},{"id":"d","text":"٥"}]'::jsonb,
   'b', 1),
  ('66666666-6666-6666-6666-666666666666', 3,
   'كم عدد أضلاع المثلث؟',
   '[{"id":"a","text":"٢"},{"id":"b","text":"٣"},{"id":"c","text":"٤"},{"id":"d","text":"٥"}]'::jsonb,
   'b', 1);
