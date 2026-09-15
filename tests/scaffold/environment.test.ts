import fs from "node:fs";
import path from "node:path";
import { JWSoftTiptapEditorBuild } from "@/index";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function isVersionAtLeast(actual: string, required: string): boolean {
  const actualParts = actual.split(".").map(Number);
  const requiredParts = required.split(".").map(Number);
  if (
    actualParts.length < requiredParts.length ||
    actualParts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return false;
  }
  for (const [index, part] of requiredParts.entries()) {
    const actualPart = actualParts[index] ?? 0;
    if (actualPart > part) return true;
    if (actualPart < part) return false;
  }
  return true;
}

describe("environment scaffold", () => {
  it("keeps product identifiers synchronized", () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(root, "plugin.json"), "utf8"),
    ) as {
      identifier: string;
      version: string;
    };
    const components = JSON.parse(
      fs.readFileSync(path.join(root, "components.json"), "utf8"),
    ) as {
      identifier: string;
      version: string;
    };
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as {
      version: string;
    };

    expect(plugin.identifier).toBe("jwsoft-tiptap-editor");
    expect(components.identifier).toBe(plugin.identifier);
    expect(components.version).toBe(plugin.version);
    expect(pkg.version).toBe(plugin.version);
    expect(JWSoftTiptapEditorBuild.version).toBe(plugin.version);
  });

  it("does not declare a runtime CDN host", () => {
    const plugin = JSON.parse(
      fs.readFileSync(path.join(root, "plugin.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(plugin.trusted_script_hosts).toBeUndefined();
  });

  it("pins the ProseMirror crafted-paste security floor", () => {
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
    ) as {
      packages: Record<
        string,
        { version?: string; dependencies?: Record<string, string> }
      >;
    };

    const resolvedVersion =
      lock.packages["node_modules/prosemirror-view"]?.version;
    const requiredRange =
      lock.packages["node_modules/@tiptap/pm"]?.dependencies?.[
        "prosemirror-view"
      ];

    expect(resolvedVersion).toBeDefined();
    expect(isVersionAtLeast(resolvedVersion ?? "0.0.0", "1.42.3")).toBe(true);
    expect(requiredRange).toBe("^1.42.3");
  });
});
