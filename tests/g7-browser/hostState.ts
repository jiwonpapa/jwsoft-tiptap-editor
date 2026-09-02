import type { Context } from "./context.ts";

/** Observe G7's debounced public binding; never inject form values through state. */
export async function waitForHostValue(
  c: Context,
  keys: string[],
  expected: string,
): Promise<void> {
  await c.page.waitForFunction(
    ({ keys, expected }) => {
      const property = (value: unknown, key: string): unknown =>
        value !== null && typeof value === "object"
          ? Reflect.get(value, key)
          : undefined;
      const core: unknown = Reflect.get(window, "G7Core");
      const state = property(core, "state");
      const getter = property(state, "getLocal");
      if (typeof getter !== "function") return false;
      let value: unknown = Reflect.apply(getter, state, []);
      for (const key of keys) value = property(value, key);
      return String(value) === expected;
    },
    { keys, expected },
  );
}
