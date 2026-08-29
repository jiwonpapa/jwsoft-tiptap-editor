import fs from "node:fs";
import path from "node:path";
import { JWSoftTiptapEditorBuild } from "@/index";
import { describe, expect, it } from "vitest";

const root = process.cwd();

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
});
