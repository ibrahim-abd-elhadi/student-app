-- =====================================================================
-- Classroom Control — initial schema
-- Loaded automatically by docker-entrypoint-initdb.d on first container start.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- Tenancy ----------
CREATE TABLE classrooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Users ----------
CREATE TYPE user_role AS ENUM ('TUTOR', 'STUDENT', 'ADMIN');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id  UUID REFERENCES classrooms(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, username)
);
CREATE INDEX idx_users_classroom_role ON users(classroom_id, role);

-- ---------- Devices ----------
CREATE TABLE devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hostname      TEXT NOT NULL,
  os            TEXT NOT NULL,
  fingerprint   TEXT NOT NULL,
  last_seen_at  TIMESTAMPTZ,
  UNIQUE (user_id, fingerprint)
);

-- ---------- Exams ----------
CREATE TABLE exams (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id      UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES users(id),
  title             TEXT NOT NULL,
  description       TEXT,
  default_duration  INTEGER NOT NULL CHECK (default_duration > 0),
  shuffle_questions BOOLEAN NOT NULL DEFAULT TRUE,
  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exams_classroom ON exams(classroom_id);

CREATE TABLE questions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  ordinal       INTEGER NOT NULL,
  prompt        TEXT NOT NULL,
  choices       JSONB NOT NULL,
  correct_id    TEXT NOT NULL,
  points        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (exam_id, ordinal)
);
CREATE INDEX idx_questions_exam ON questions(exam_id);

-- ---------- Sessions / Attempts ----------
CREATE TYPE session_state AS ENUM ('PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED');

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id    UUID NOT NULL REFERENCES classrooms(id),
  exam_id         UUID NOT NULL REFERENCES exams(id),
  tutor_id        UUID NOT NULL REFERENCES users(id),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  state           session_state NOT NULL DEFAULT 'PENDING',
  started_at      TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_classroom_state ON sessions(classroom_id, state);

CREATE TYPE attempt_state AS ENUM (
  'ASSIGNED','IN_PROGRESS','SUBMITTED','EXPIRED','CANCELLED'
);

CREATE TABLE attempts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES users(id),
  state        attempt_state NOT NULL DEFAULT 'ASSIGNED',
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  score        INTEGER,
  answered_count INTEGER NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  client_seq   BIGINT NOT NULL DEFAULT 0,
  UNIQUE (session_id, student_id)
);
CREATE INDEX idx_attempts_session ON attempts(session_id);
CREATE INDEX idx_attempts_student ON attempts(student_id);

-- ---------- Audit log ----------
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  classroom_id UUID,
  actor_id    UUID,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_classroom_time ON audit_log(classroom_id, created_at DESC);

-- ---------- Refresh tokens ----------
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  device_id   UUID REFERENCES devices(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
