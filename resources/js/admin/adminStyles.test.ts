import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_CSS,
  ADMIN_STYLE_ID,
  injectAdminStyles,
} from "@/admin/adminStyles";
import { withThemeSelectors } from "@/theme";

afterEach(() => document.getElementById(ADMIN_STYLE_ID)?.remove());

describe("admin theme integration", () => {
  it("injects once without changing the host theme or storage", () => {
    const attributes = document.documentElement.outerHTML.split(">")[0];
    const storage = { ...localStorage };
    injectAdminStyles();
    injectAdminStyles();
    expect(document.querySelectorAll(`#${ADMIN_STYLE_ID}`)).toHaveLength(1);
    expect(document.documentElement.outerHTML.split(">")[0]).toBe(attributes);
    expect({ ...localStorage }).toEqual(storage);
  });

  it("scopes every color rule to our page or its open Select popup", () => {
    for (const rule of ADMIN_CSS.split("}")) {
      if (!rule.trim()) continue;
      expect(rule.split("{")[0]).toContain(".jwsoft-tiptap-admin");
    }
    expect(ADMIN_CSS).toContain('html[data-theme="dark"]');
    expect(ADMIN_CSS).toContain("var(--color-gray-800");
    expect(ADMIN_CSS).toContain("color-scheme: dark");
    expect(ADMIN_CSS).toContain("display: block; overflow-wrap: anywhere");
    expect(ADMIN_CSS).not.toContain("!important");
  });

  it("supports the G7 data attribute for editor and portalled modal styles", () => {
    expect(withThemeSelectors("html.dark .panel { color: white; }")).toBe(
      ':is(html.dark, html[data-theme="dark"]) .panel { color: white; }',
    );
  });
});
