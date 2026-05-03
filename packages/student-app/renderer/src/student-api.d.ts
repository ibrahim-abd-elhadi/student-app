export {};

declare global {
  interface Window {
    studentApi: {
      loginComplete: (payload: any) => Promise<void>;
      hostInfo: () => Promise<{ hostname: string; platform: string }>;
      getSession: () => Promise<any>;
      dashboardReady: () => Promise<void>;
      applyLock: (msg: string) => Promise<void>;
      releaseLock: () => Promise<void>;
      openExam: (payload: any) => Promise<void>;
      closeExam: () => Promise<void>;
      getPendingExam: () => Promise<any>;
      hostReady: () => Promise<void>;
      onOnlineReady: (cb: () => void) => () => void;
      onExamStart: (cb: (payload: any) => void) => () => void;
      onExamReload: (cb: (payload: any) => void) => () => void;
    };
  }
}
