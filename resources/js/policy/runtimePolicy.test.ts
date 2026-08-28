import securityCorpus from "../../../harness/fixtures/security-corpus.json";

import { analyzeLegacyHtml, sanitizeClientHtml } from "@/policy/runtimePolicy";

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
});
