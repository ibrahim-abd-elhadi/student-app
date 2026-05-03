# Classroom Control — Real-time tutor / student exam management

A complete classroom management scaffold with tutor control, student kiosk exams, and an exam designer.

- **Backend** — NestJS API, TypeORM/Postgres, Redis-backed presence, Socket.IO realtime layer
- **Tutor App** — Electron + React dashboard for student roster, exam launch, and live monitoring
- **Student App** — Electron client with hidden host process, lock overlay, and fullscreen exam window
- **Designer App** — Electron authoring tool for MCQ exam creation
- **Shared package** — TypeScript contracts for REST + WS events across clients and backend

## Project updates

- Realtime connections now use Socket.IO on `/ws` with JWT handshake authentication
- Students join `classroom:<id>` and `student:<id>` rooms for tutor subscription and exam routing
- Tutor dashboard receives live `presence:update` events when students connect/disconnect
- Exam assignment is pushed from tutor → backend → student host/exam window
- Student app maintains a hidden host socket and a separate fullscreen exam socket for robust delivery
- Backend now supports manual gateway attachment for the Socket.IO server so realtime routing works consistently

## Repository layout

```
packages/
  shared/          shared types + WS event definitions
  backend/         NestJS REST + realtime gateway implementation
  tutor-app/       Electron tutor controller app
  student-app/     Electron student client with host/exam flow
  designer-app/    Electron exam creation app
infra/
  docker-compose.yml
  db/init/         Postgres init + seed SQL
```

## Features

- Tutor can see live student presence and status
- Tutor can start/cancel exams for selected students
- Student receives fullscreen exam window and lock overlay during tests
- Student answers sync in real time and recover after reconnects
- Persistent session state and automatic deadline enforcement
- Central shared contract package for type-safe WS and REST interaction

## Prerequisites

- Node.js **>= 20.10**
- npm **>= 10**
- Docker Desktop (for Postgres + Redis)
- Windows 10/11 recommended for full Electron lock-overlay behavior

## Setup

```bash
# Install workspace dependencies
npm install

# Start infrastructure
npm run infra:up

# Prepare backend env
cp packages/backend/.env.example packages/backend/.env
# Edit JWT_SECRET to a secure random string for non-local use

# Build shared package
npm -w @classroom/shared run build

# Seed demo data
npm run db:seed
```

## Start the apps

```bash
# Backend (API + Socket.IO)
npm run dev:backend

# Tutor app
npm run dev:tutor

# Student app
npm run dev:student

# Designer app
npm run dev:designer
```

### Login credentials for local demo

- Tutor: `tutor1` / `Password123!`
- Students: `student1` / `Password123!`, `student2` / `Password123!`, `student3` / `Password123!`

### Multiple student instances

Use a separate Electron user data folder so each student has isolated state:

```powershell
$env:ELECTRON_USER_DATA="$PWD\.userdata\student2"; npm run dev:student
```

## Quick start workflow

1. Start the backend.
2. Open the Tutor app and log in.
3. Start one or more Student apps and log in as students.
4. Confirm students appear online in the Tutor roster.
5. Use the Tutor app to assign and start an exam.
6. Verify the Student app opens the fullscreen exam window.

## Realtime behavior

- Socket.IO connections are served on `/ws`
- Clients authenticate with JWT during the handshake
- Students are broadcast to tutors via `presence:update`
- Tutor-to-student commands are routed through server-side rooms
- Exam windows are opened on student clients via server push

## Troubleshooting

- **No online students in Tutor** — ensure the Student app successfully connected and the hidden host window started.
- **WebSocket 404 on `/ws`** — verify the backend is running and the client is using `path: '/ws'`.
- **Exam does not open on student** — ensure the student host socket is connected and the student is in the correct classroom room.
- **Backend env issues** — copy `.env.example` to `.env` and set `JWT_SECRET`.

## Notes

- The student lock overlay is a deterrent, not a foolproof kiosk mode.
- `Ctrl+Alt+Del` cannot be blocked from user-mode Electron code on Windows.
- For production, add TLS, a Socket.IO Redis adapter, signed Electron installers, and proper endpoint hardening.

## License

MIT — review before redistributing.
