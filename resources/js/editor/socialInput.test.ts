import { describe, expect, it } from "vitest";
import { normalizeExternalInput } from "./socialInput";

describe("representative social input", () => {
  it.each([
    [
      '<iframe src="https://www.youtube-nocookie.com/embed/WuWsLSR2ajA"></iframe>',
      "https://youtube.com/watch?v=WuWsLSR2ajA",
    ],
    [
      '<iframe src="https://player.vimeo.com/video/12345?h=tracking"></iframe>',
      "https://vimeo.com/12345",
    ],
    [
      '<blockquote class="twitter-tweet"><a href="https://twitter.com/JWSoft/status/123?ref_src=x">post</a></blockquote><script src="https://platform.twitter.com/widgets.js"></script>',
      "https://x.com/JWSoft/status/123",
    ],
    [
      '<div class="fb-post" data-href="https://www.facebook.com/photo/?fbid=1667074674776577&amp;locale=ko_KR"></div>',
      "https://facebook.com/photo/?fbid=1667074674776577",
    ],
    [
      '<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Ffoo%2Fposts%2F123"></iframe>',
      "https://facebook.com/foo/posts/123",
    ],
    [
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/C6H039Ctw_b/?utm_source=ig_embed"></blockquote>',
      "https://www.instagram.com/reel/C6H039Ctw_b/",
    ],
    [
      '<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@scout2015/video/6718335390845095173"></blockquote>',
      "https://tiktok.com/@scout2015/video/6718335390845095173",
    ],
  ])("extracts and normalizes official source %s", (source, expected) => {
    expect(normalizeExternalInput(source)).toBe(expected);
  });

  it("keeps a generic HTTPS URL for a normal link card", () => {
    expect(normalizeExternalInput("https://example.com/article#section")).toBe(
      "https://example.com/article",
    );
  });

  it.each([
    '<iframe src="https://evil.test/embed/1"></iframe>',
    '<script src="https://www.instagram.com/embed.js"></script>',
    '<iframe src="javascript:alert(1)"></iframe>',
    "javascript:alert(1)",
  ])("rejects unsupported or executable input %s", (source) => {
    expect(normalizeExternalInput(source)).toBeNull();
  });
});
