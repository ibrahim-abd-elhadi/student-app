declare global {
    interface Window {
        tutorApi: {
            printReport: (html: string) => Promise<void>;
        };
    }
}
export {};
