import { normalizeEmptyEditorHtml } from "@/editor/meaningfulContent";

describe("semantic editor body", () => {
  it.each([
    "",
    "<p></p>",
    "<p><br></p>",
    "<p> &nbsp;\u200b\uFEFF\uFE0F </p>",
    "<blockquote><p></p></blockquote><hr>",
    "<table><tbody><tr><td><p></p></td></tr></tbody></table>",
    '<img alt="not body text">',
  ])("normalizes empty markup to the G7 empty value: %s", (html) => {
    expect(normalizeEmptyEditorHtml(html)).toBe("");
  });

  it.each([
    "<p>실제 본문</p>",
    "<p>0</p>",
    "<p>&amp;nbsp;</p>",
    '<figure class="jw-image"><img src="/storage/a.png"></figure>',
    '<figure class="jw-media"><a href="https://example.com/a.mp4">영상</a></figure>',
    '<figure class="jw-card"><a href="https://example.com">카드</a></figure>',
  ])("preserves text and media-only bodies: %s", (html) => {
    expect(normalizeEmptyEditorHtml(html)).toBe(html);
  });
});
