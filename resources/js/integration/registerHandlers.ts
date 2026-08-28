import type { G7Logger, HandlerMap } from "@/g7/types";

const PLUGIN_IDENTIFIER = "jwsoft-tiptap-editor";
const MAX_RETRIES = 50;
const registeredDispatchers = new WeakSet<object>();

function logger(): G7Logger {
  return (
    window.G7Core?.createLogger?.(`Plugin:${PLUGIN_IDENTIFIER}`) ?? {
      log: (...args: unknown[]) =>
        console.log(`[${PLUGIN_IDENTIFIER}]`, ...args),
      warn: (...args: unknown[]) =>
        console.warn(`[${PLUGIN_IDENTIFIER}]`, ...args),
      error: (...args: unknown[]) =>
        console.error(`[${PLUGIN_IDENTIFIER}]`, ...args),
    }
  );
}

export function registerHandlers(handlerMap: HandlerMap): number {
  const dispatcher = window.G7Core?.getActionDispatcher?.();
  if (!dispatcher) return 0;
  if (registeredDispatchers.has(dispatcher))
    return Object.keys(handlerMap).length;

  for (const [name, handler] of Object.entries(handlerMap)) {
    dispatcher.registerHandler(`${PLUGIN_IDENTIFIER}.${name}`, handler, {
      category: "plugin",
      source: PLUGIN_IDENTIFIER,
    });
  }
  registeredDispatchers.add(dispatcher);
  return Object.keys(handlerMap).length;
}

export function startHandlerRegistration(handlerMap: HandlerMap): void {
  const start = () => {
    const count = registerHandlers(handlerMap);
    if (count > 0) {
      logger().log(`${count} handler(s) registered`);
      return;
    }

    let retries = 0;
    const timer = window.setInterval(() => {
      retries += 1;
      const retriedCount = registerHandlers(handlerMap);
      if (retriedCount > 0) {
        window.clearInterval(timer);
        logger().log(`${retriedCount} handler(s) registered after retry`);
      } else if (retries >= MAX_RETRIES) {
        window.clearInterval(timer);
        logger().error("ActionDispatcher registration timed out");
      }
    }, 100);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
