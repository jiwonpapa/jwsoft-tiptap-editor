import securityCorpus from "../../../harness/fixtures/security-corpus.json";

import {
  analyzeLegacyHtml,
  isAllowedEditorUrl,
  sanitizeClientHtml,
} from "@/policy/runtimePolicy";

describe("browser policy defense", () => {
  it.each(securityCorpus.cases)("sanitizes $id", (fixture) => {
    const output = sanitizeClientHtml(fixture.input);
    for (const needle of fixture.mustKeep) expect(output).toContain(needle);
    for (const needle of fixture.mustRemove) {
      expect(output.toLowerCase()).not.toContain(needle.toLowerCase());
    }
  });

  it("keeps only declared class tokens and hardens blank links", () => {
    expect(
      sanitizeClientHtml(
        '<p class="evil jw-align-center"><a href="https://example.com" target="_blank">링크</a></p>',
      ),
    ).toBe(
      '<p class="jw-align-center"><a href="https://example.com" rel="noopener noreferrer" target="_blank">링크</a></p>',
    );
  });

  it("keeps only structurally valid canonical image figures", () => {
    expect(
      sanitizeClientHtml(
        '<figure class="jw-image jw-image-align-right jw-image-size-50"><img src="/image.png"><figcaption>캡션</figcaption></figure>',
      ),
    ).toBe(
      '<figure class="jw-image jw-image-align-right jw-image-size-50"><img src="/image.png"><figcaption>캡션</figcaption></figure>',
    );
  });

  it("detects policy removal before an existing document becomes writable", () => {
    const analysis = analyzeLegacyHtml(
      '<p style="text-align:center">기존</p>',
      "<p>기존</p>",
    );
    expect(analysis).toMatchObject({
      hasLoss: true,
      policyChanged: true,
    });
  });

  it("does not treat the empty Tiptap paragraph as legacy loss", () => {
    expect(analyzeLegacyHtml("", "<p></p>").hasLoss).toBe(false);
  });

  it("ignores harmless attribute order differences", () => {
    expect(
      analyzeLegacyHtml(
        '<p><a target="_blank" href="https://example.com" rel="noreferrer noopener">링크</a></p>',
        '<p><a href="https://example.com" rel="noopener noreferrer" target="_blank">링크</a></p>',
      ).hasLoss,
    ).toBe(false);
  });

  it.each(["td", "th"])(
    "ignores omitted default spans only on %s cells",
    (cell) => {
      const original = `<table><tbody><tr><${cell} colspan="1" rowspan="1"><p>셀</p></${cell}></tr></tbody></table>`;
      const edited = `<table><tbody><tr><${cell}><p>셀</p></${cell}></tr></tbody></table>`;
      expect(analyzeLegacyHtml(original, edited)).toMatchObject({
        hasLoss: false,
        policyChanged: false,
        editorChanged: false,
        canonicalEditorHtml: edited,
      });
      expect(analyzeLegacyHtml(edited, original).hasLoss).toBe(false);
    },
  );

  it.each(["colspan", "rowspan"])(
    "still reports removal of a real %s merge",
    (attribute) => {
      expect(
        analyzeLegacyHtml(
          `<table><tbody><tr><td ${attribute}="2"><p>셀</p></td></tr></tbody></table>`,
          "<table><tbody><tr><td><p>셀</p></td></tr></tbody></table>",
        ),
      ).toMatchObject({ hasLoss: true, editorChanged: true });
    },
  );

  it("does not hide forbidden attributes while ignoring default cell spans", () => {
    expect(
      analyzeLegacyHtml(
        '<table><tbody><tr><td colspan="1" style="color:red" onclick="alert(1)" class="evil"><p>셀</p></td></tr></tbody></table>',
        "<table><tbody><tr><td><p>셀</p></td></tr></tbody></table>",
      ),
    ).toMatchObject({ hasLoss: true, policyChanged: true });
  });

  it("does not ignore default-sized widths or spans on non-cell elements", () => {
    for (const original of [
      '<p colspan="1">본문</p>',
      '<p><img src="/safe.png" width="1"></p>',
    ]) {
      const edited = original.includes("img")
        ? '<p><img src="/safe.png"></p>'
        : "<p>본문</p>";
      expect(analyzeLegacyHtml(original, edited).hasLoss).toBe(true);
    }
  });

  it("shares strict link and media URL validation with toolbar dialogs", () => {
    expect(isAllowedEditorUrl("https://example.com/path")).toBe(true);
    expect(isAllowedEditorUrl("/relative/path")).toBe(true);
    expect(isAllowedEditorUrl("mailto:test@example.com", true)).toBe(false);
    expect(isAllowedEditorUrl("javascript:alert(1)")).toBe(false);
  });
});
