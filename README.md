# Classroom Control — NetSupport-style classroom management

Production-grade scaffold of a tutor / student / exam-designer system.

- **Backend** — NestJS + PostgreSQL + Redis + Socket.IO
- **Tutor App** — Electron + React (RTL Arabic UI)
- **Student App** — Electron with hidden host window, fullscreen lock overlay, and kiosk exam window
- **Exam Designer** — Electron + React MCQ authoring tool
- **Shared types** — single source of truth for REST + WS contracts

## Repository layout

```
packages/
  shared/          contracts (TypeScript types + WS event signatures)
  backend/         NestJS API + Socket.IO gateway
  tutor-app/       Electron tutor controller
  student-app/     Electron student client (lock overlay + exam runner)
  designer-app/    Electron exam authoring tool
infra/
  docker-compose.yml
  db/init/         SQL files auto-loaded by Postgres on first boot
```

## Prerequisites

- Node.js **>= 20.10**
- npm **>= 10**
- Docker Desktop (for Postgres + Redis)
- Windows 10/11 recommended for the Student app (Linux/macOS work for dev; lock overlay caveats apply — see below)

## First-time setup

```bash
# 1. Install dependencies (workspace-aware)
npm install

# 2. Boot Postgres + Redis
npm run infra:up

# 3. Configure backend env
cp packages/backend/.env.example packages/backend/.env
# Edit JWT_SECRET to a random ≥32-char string for anything beyond local dev.

# 4. Build the shared package once so backend + apps can import it
npm -w @classroom/shared run build

# 5. Seed the demo classroom (1 tutor + 3 students + 1 exam, password: Password123!)
npm run db:seed
```

## Running everything (4 terminals)

```bash
# Terminal 1 — backend (http://127.0.0.1:8080)
npm run dev:backend

# Terminal 2 — tutor app
npm run dev:tutor       # login: tutor1 / Password123!

# Terminal 3 — student app
npm run dev:student     # login: student1 / Password123!

# Terminal 4 — exam designer
npm run dev:designer    # login: tutor1 / Password123!
```

Run multiple student instances by passing `ELECTRON_USER_DATA` so each has its own session store:

```bash
# PowerShell
$env:ELECTRON_USER_DATA="$PWD\.userdata\student2"; npm run dev:student
```

(or just log in as `student2` / `student3` from a separate clone of the repo).

## End-to-end smoke test

1. Start backend, tutor, and at least one student.
2. In the **Tutor** app, the student tile should turn green within ~5s of the student logging in.
3. Select the student, click **بدء اختبار للمحددين**, pick the seeded exam (`اختبار الرياضيات — الفصل الأول`), set duration, click **بدء الاختبار الآن**.
4. The **Student** app should pop a fullscreen kiosk exam window with three Arabic MCQs.
5. Pick answers — the Tutor's **Live Monitor** updates in real time.
6. Either let the deadline pass or hit **إنهاء الاختبار الآن**. The exam window auto-closes; the Tutor lands on the Report view.

## How the realtime layer works

- Socket.IO at `/ws`, JWT validated on handshake.
- Sockets join two rooms: `classroom:<id>` and `<role>:<userId>` (e.g. `student:abc-…`).
- Tutor commands are server-mediated; the gateway never trusts a client-supplied `classroom_id`.
- Answers carry a monotonically increasing `client_seq`; the server drops out-of-order or replayed frames.
- On reconnect the student sends `attempt:resync` with its last `client_seq` and merges any answers the server has but it doesn't.
- Sessions auto-close in a 10-second cron job once `deadline_at` passes — survives backend restarts.

## Lock / kiosk caveats (read this before deploying to a real lab)

- The "lock" is a fullscreen always-on-top **Electron overlay** with `globalShortcut` registered to swallow common escape combos. It is **deterrence**, not isolation: anyone with admin rights can defeat it. Document this for school admins.
- `Ctrl+Alt+Del` cannot be intercepted by user-mode code on Windows. Don't promise otherwise.
- "Secure exam mode" runs the exam window with `kiosk: true` + `alwaysOnTop: 'screen-saver'` + the same shortcut blocking. A real production deployment should also register a Windows Filter Manager driver — out of scope for this scaffold.

## Production hardening checklist

- [ ] Replace the demo `JWT_SECRET` with `openssl rand -base64 64`
- [ ] Switch Postgres to a managed instance with PITR
- [ ] Front the backend with TLS (Caddy / nginx / managed LB)
- [ ] Distribute the school CA cert to every client PC; enable cert pinning in the Electron clients
- [ ] Add the Socket.IO **Redis adapter** to the backend if running >1 replica
- [ ] Sign the Electron installers (electron-builder + EV cert)
- [ ] Register the Student app as a Windows service via `node-windows` so it survives logoff
- [ ] Implement an `audit_log` retention policy (e.g. monthly partitioning + archive to S3)

## Edge cases handled

| Scenario | Behavior |
|---|---|
| Student disconnects mid-exam | Local outbox + LevelDB-style persisted answers; resync on reconnect; deadline keeps counting |
| Student PC crashes | On restart, exam window rehydrates from `localStorage`, resyncs with server, continues |
| Tutor crashes mid-session | Session keeps running server-side; tutor reopens the monitor view from session detail |
| Two tutors race on `start` | `SELECT FOR UPDATE` + state check; second request rejected with `bad_state:ACTIVE` |
| Duplicate `exam:submit` | Idempotent — returns prior score, no double-grading |
| Out-of-order answers | `client_seq` discriminator drops them silently |
| Deadline passes during outage | Scheduler picks up `ACTIVE` sessions past `deadline_at` on next tick (10s) |
| `correct_id` leak | Stripped from every student-facing payload (`StudentExamPayload` type enforces it) |
| Refresh token theft | Rotation on use; reuse triggers full revocation of all refresh tokens for that user |

## Troubleshooting

- **Backend won't start: "Invalid environment configuration"** — copy `.env.example` to `.env`; make sure `JWT_SECRET` is ≥ 32 chars.
- **Tutor sees no students online** — make sure the Student app finished its login (the host window appears as a 1×1 hidden window in dev tools, but its connection log goes to the Electron console).
- **`exam_in_use` when editing an exam** — the exam is referenced by a non-cancelled session. Cancel it or wait for it to close.
- **Student lock overlay won't dismiss** — only the tutor's `student:unlock` command (or the Student app being killed) releases it. By design.

## License

MIT — internal scaffold; review before redistributing.
