# 🎓 Classroom Control — NetSupport-style Management System

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-grade scaffold of a tutor / student / exam-designer system. Built for speed, security, and real-time interaction. It allows teachers to control student devices, conduct exams, and monitor performance in real-time.

---

## 🏗️ Repository Architecture

This project is organized as a **Monorepo** using npm workspaces:

- **`packages/shared/`**: Single source of truth for TypeScript types, REST contracts, and WebSocket event signatures.
- **`packages/backend/`**: NestJS API + Socket.IO gateway. Handles business logic, persistence, and real-time fan-out.
- **`packages/tutor-app/`**: Electron controller for the teacher. Features student monitoring and classroom control.
- **`packages/student-app/`**: Electron client with a hidden host window, fullscreen lock overlay, and kiosk-mode exam runner.
- **`packages/designer-app/`**: Electron-based MCQ authoring tool for creating and managing exams.
- **`infra/`**: Docker Compose configurations for PostgreSQL and Redis.

---

## 🛠️ Prerequisites

- **Node.js**: `>= 20.10`
- **npm**: `>= 10`
- **Docker Desktop**: (Required for database and cache services)
- **OS**: Windows 10/11 is recommended for full student-app lock capabilities.

---

## 🚀 Quick Start (Development)

### 1. Initialize Project
```bash
# Install dependencies for the entire workspace
npm install

# Boot infrastructure (Postgres + Redis)
npm run infra:up

# Build shared package (Required for other packages to work)
npm -w @classroom/shared run build
```

### 2. Environment Configuration
Copy the example environment file in the backend package:
```bash
cp packages/backend/.env.example packages/backend/.env
# Update JWT_SECRET in .env with a secure string
```

### 3. Database Seeding
Create initial dummy data (Tutor: `tutor1`, Student: `student1`, Password: `Password123!`):
```bash
npm run db:seed
```

---

## 💻 Running the Application

You will need 4 terminal instances:

| Component | Command | Port / Info |
|---|---|---|
| **Backend** | `npm run dev:backend` | http://127.0.0.1:8080 |
| **Tutor App** | `npm run dev:tutor` | Login: `tutor1` |
| **Student App** | `npm run dev:student` | Login: `student1` |
| **Designer App** | `npm run dev:designer` | Login: `tutor1` |

---

## 🌿 Git Workflow & Best Practices

Since this project is used for demonstrating Git/GitHub skills, please follow this workflow:

### Branching Strategy
- `main`: Production-ready code.
- `develop`: Integration branch for new features.
- `feature/feature-name`: Branch for specific feature development.
- `fix/issue-name`: Branch for bug fixes.

### Commit Guidelines
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: ...` for new features.
- `fix: ...` for bug fixes.
- `docs: ...` for documentation changes.
- `refactor: ...` for code changes that neither fix a bug nor add a feature.

### Pull Requests
1. Create a branch from `develop`.
2. Push your changes.
3. Open a Pull Request targeting `develop`.
4. Ensure all tests pass and code is reviewed before merging.

---

## 🔒 Security & Hardening

- **JWT Auth**: Every request and WS handshake is validated.
- **Helmet**: Secured HTTP headers.
- **Kiosk Mode**: Student app uses Electron kiosk mode to prevent switching windows during exams.
- **Validation**: Strict DTO validation using `class-validator` in the backend.

---

## 📝 Troubleshooting

- **Database Connection**: Ensure Docker is running and `POSTGRES_URL` in `.env` is correct.
- **Shared Types**: If you see "Module not found" for `@classroom/shared`, run `npm -w @classroom/shared run build`.
- **Student Lock**: If the student screen doesn't lock, ensure the Tutor app is connected to the same classroom ID.

---

## 📜 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

