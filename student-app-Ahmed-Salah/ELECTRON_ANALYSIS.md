# Student App Electron Main.ts - Analysis & Fixes

## ✅ Issues Found and Fixed

### 1. **CRITICAL: Syntax Error** (Lines 30-32)
**Problem**: Missing closing parenthesis in `BrowserWindow` constructor
```typescript
// ❌ BEFORE
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
},
mainWindow.webContents.on("devtools-opened", () => {  // ERROR: Inside constructor!
```

**Fix**: Properly close the constructor and place the event listener outside
```typescript
// ✅ AFTER
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: preloadScript,
}
});  // Closing parenthesis added

mainWindow.webContents.on("devtools-opened", () => {  // Now outside
```

---

### 2. **Wrong Dev Server Port** (Line 35)
**Problem**: Code loads from `http://localhost:3000` but Vite runs on port 5174
```typescript
// ❌ BEFORE
mainWindow.loadURL("http://localhost:3000");

// ✅ AFTER
mainWindow.loadURL("http://localhost:5174/login");
```

---

### 3. **Missing Preload Script Configuration**
**Problem**: No preload path specified in `webPreferences`
```typescript
// ❌ BEFORE
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
  // No preload!
}

// ✅ AFTER
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: preloadScript, // ✅ Added
}
```

**Why**: The preload script (preload.ts) exposes the `studentApi` bridge to the renderer. Without it, the renderer can't communicate with the main process.

---

### 4. **Security Anti-Patterns**
**Problems**:
- `nodeIntegration: true` - Allows renderer to directly access Node APIs (security risk)
- `contextIsolation: false` - Disables context isolation (security risk)

**Fix**: Changed to security-best-practices configuration
```typescript
nodeIntegration: false,        // ✅ Disable direct Node access
contextIsolation: true,         // ✅ Enable context isolation
preload: preloadScript,         // ✅ Use preload for safe IPC
```

---

### 5. **Removed Auto-Launch Dependency**
**Problem**: Code imported `auto-launch` which wasn't in package.json dependencies
```typescript
// ❌ REMOVED
import AutoLaunch from "auto-launch";
const autoLauncher = new AutoLaunch({ name: "Student App" });
await autoLauncher.enable();
```

**Why**: Not essential for core functionality. Can be re-added later if needed with proper package.json entry.

---

### 6. **Missing IPC Handlers**
**Problem**: Preload script exposes these handlers, but main.ts didn't implement them:
- `login:complete`
- `host:info`
- `session:get`
- `dashboard:ready`
- `lock:apply`
- `lock:release`
- `exam:open`
- `exam:close`

**Fix**: Added all IPC handlers with proper session management:
```typescript
ipcMain.handle("login:complete", async (event: IpcMainInvokeEvent, payload: Session) => {
  currentSession = payload;
  if (mainWindow) {
    mainWindow.loadURL(`http://localhost:5174/login?mode=host`);
  }
});

ipcMain.handle("host:info", async (event: IpcMainInvokeEvent) => {
  return {
    hostname: os.hostname(),
    platform: process.platform,
  };
});

// ... other handlers
```

---

### 7. **Missing Type Definitions**
**Problem**: `@types/node` wasn't in package.json devDependencies
- TypeScript couldn't find `path`, `os`, `process`, `__dirname`

**Fix**: Added `@types/node` to [packages/student-app/package.json](packages/student-app/package.json)

---

### 8. **Improved Session Management**
**Added**: Session storage to persist login state
```typescript
interface Session {
  base_url: string;
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    display_name: string;
    classroom_id: string;
  };
}

let currentSession: Session | null = null;
```

---

### 9. **Fixed TypeScript Configuration**
Updated [packages/student-app/electron/tsconfig.json](packages/student-app/electron/tsconfig.json):
```json
{
  "compilerOptions": {
    "types": ["node"]  // ✅ Added to include Node.js types
  }
}
```

---

## 📋 Architecture Overview

### Window Lifecycle
```
1. App starts → createWindow() creates hidden window
2. Hidden window loads http://localhost:5174/login
3. Login form calls window.studentApi.loginComplete({...})
4. Main process stores session via IPC handler
5. Page loads ?mode=host query param → startHost() connects to WebSocket
6. WebSocket receives events (lock, exam, etc.) and forwards to main process
7. Main process shows/hides/locks window accordingly
```

### IPC Flow
```
Renderer (renderer/*.tsx)
    ↓ calls window.studentApi.METHOD()
Preload (electron/preload.ts)
    ↓ ipcRenderer.invoke('channel', data)
Main Process (electron/main.ts)
    ↓ ipcMain.handle('channel', handler)
Host Window
    ↓ receives events via mainWindow.webContents.send()
```

---

## 🔧 Next Steps

### 1. Install Dependencies
```bash
npm install
```
This will install:
- `@types/node` - Node.js type definitions
- `electron` - Electron runtime
- All other dependencies listed in package.json files

### 2. Compile TypeScript
```bash
cd packages/student-app
tsc -p electron/tsconfig.json
```
This compiles `electron/main.ts` and `electron/preload.ts` to `dist-electron/`

### 3. Add Icon File
Create a system tray icon file:
- Path: `packages/student-app/dist-electron/icon.png`
- Recommended: 16x16 or 32x32 PNG image
- Or modify the tray code to handle missing icon gracefully

### 4. Run Development Server
```bash
npm run dev:student
```
This runs:
- Vite dev server on `http://localhost:5174`
- Electron main process (connects to Vite)

---

## 📊 File Summary

| File | Status | Notes |
|------|--------|-------|
| `packages/student-app/electron/main.ts` | ✅ Fixed | Syntax errors, port, IPC handlers, security |
| `packages/student-app/electron/preload.ts` | ✅ Good | Properly exposes studentApi bridge |
| `packages/student-app/electron/tsconfig.json` | ✅ Fixed | Added Node types |
| `packages/student-app/package.json` | ✅ Fixed | Added @types/node |
| `packages/student-app/vite.config.ts` | ✅ Good | Correct port 5174 |
| `packages/student-app/renderer/src/login.tsx` | ✅ Good | Proper IPC integration |
| `packages/student-app/renderer/src/host.ts` | ✅ Good | WebSocket connection logic |

---

## 🧪 Testing Checklist

After running `npm install` and `npm run dev:student`:

- [ ] App window appears (initially hidden)
- [ ] System tray icon shows
- [ ] Login page loads at http://localhost:5174/login
- [ ] Can enter credentials and click "دخول" (Login)
- [ ] IPC call to `loginComplete` succeeds
- [ ] Session is stored and retrievable via `session:get`
- [ ] Preload bridge methods can be called from renderer
- [ ] WebSocket connection works when `?mode=host` is added
- [ ] Lock/exam commands work properly

---

## ⚠️ Known Issues to Address

1. **Icon File**: `icon.png` referenced but not provided - add a proper system tray icon
2. **WebSocket URL**: Currently assumes backend runs on same base_url as login - verify this matches your deployment
3. **Auto-launch**: Removed for now - can be re-added with proper package.json entry if needed
4. **Production Build**: Test `npm run build` and `npm start` to ensure dist files are generated correctly

---

## 📚 References

- Electron Security: https://www.electronjs.org/docs/tutorial/security
- Electron IPC: https://www.electronjs.org/docs/api/ipc-main
- Electron Context Isolation: https://www.electronjs.org/docs/api/context-bridge

