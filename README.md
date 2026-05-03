# 🎓 Classroom Control — NetSupport-style Management System

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-grade scaffold of a tutor / student / exam-designer system. Built for speed, security, and real-time interaction. It allows teachers to control student devices, conduct exams, and monitor performance in real-time.

---

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

## 🚀 Quick Start (Development)

### 1. Initialize Project
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

### 3. Database Seeding
Create initial dummy data (Tutor: `tutor1`, Student: `student1`, Password: `Password123!`):
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

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

