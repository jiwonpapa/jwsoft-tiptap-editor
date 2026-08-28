import { sanitizePastedHtml } from "@/editor/pastePolicy";

describe("clipboard paste policy", () => {
  it("removes office-style markup and reports the loss", () => {
    expect(
      sanitizePastedHtml(
        '<p class="MsoNormal" style="color:red" onclick="alert(1)">본문</p>',
      ),
    ).toEqual({ html: "<p>본문</p>", changed: true });
  });

  it("keeps policy-safe HTML without a false loss warning", () => {
    expect(
      sanitizePastedHtml(
        '<p class="jw-align-center"><strong>본문</strong></p>',
      ),
    ).toEqual({
      html: '<p class="jw-align-center"><strong>본문</strong></p>',
      changed: false,
    });
  });
});
