import { afterEach, expect, test, vi } from "vitest";
import { authorizationHeaders } from "./authorization";

afterEach(() => vi.unstubAllGlobals());

test("uses the current host token for each request", () => {
  const getItem = vi
    .fn()
    .mockReturnValueOnce("first")
    .mockReturnValueOnce("second");
  vi.stubGlobal("localStorage", { getItem });
  expect(authorizationHeaders()).toEqual({ Authorization: "Bearer first" });
  expect(authorizationHeaders()).toEqual({ Authorization: "Bearer second" });
  expect(getItem).toHaveBeenCalledWith("auth_token");
});

test("does not invent authentication without a host token", () => {
  vi.stubGlobal("localStorage", { getItem: () => null });
  expect(authorizationHeaders()).toEqual({});
});

test("keeps cookie authentication usable when browser storage is denied", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("storage denied");
    },
  });
  expect(authorizationHeaders()).toEqual({});
});
