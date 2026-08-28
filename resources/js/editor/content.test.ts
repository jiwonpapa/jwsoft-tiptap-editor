import {
  booleanParam,
  resolveMultilingualContent,
  resolveSingleContent,
  supportedLocales,
} from "@/editor/content";
import type { G7CoreApi } from "@/g7/types";

function coreWithLocal(form: Record<string, unknown>): G7CoreApi {
  return {
    state: { getLocal: () => ({ form }) },
    locale: { current: () => "ko", supported: () => ["ko", "en"] },
  };
}

describe("editor content contract", () => {
  it("parses boolean bindings", () => {
    expect(booleanParam(true)).toBe(true);
    expect(booleanParam("true")).toBe(true);
    expect(booleanParam("false")).toBe(false);
  });

  it("rereads the current local string when the mount binding is unresolved", () => {
    expect(
      resolveSingleContent(
        { name: "content", content: "{{extensionPointProps.content}}" },
        coreWithLocal({ content: "최신 본문" }),
      ),
    ).toBe("최신 본문");
  });

  it("normalizes multilingual maps and keeps current locale first", () => {
    const core = coreWithLocal({ content: { ko: "한국어", en: "English" } });
    expect(resolveMultilingualContent({ name: "content" }, core)).toEqual({
      ko: "한국어",
      en: "English",
    });
    expect(supportedLocales(core)).toEqual(["ko", "en"]);
  });
});
