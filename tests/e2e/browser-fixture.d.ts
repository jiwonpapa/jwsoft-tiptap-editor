export {};

type HarnessHandler = (context: { params: Record<string, unknown> }) => unknown;

declare global {
  interface Window {
    handlers: Record<string, HarnessHandler>;
    updates: unknown[];
    __e2eHandlers: Record<string, HarnessHandler>;
    __e2eStateUpdates: Array<{
      updates: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>;
  }
}
