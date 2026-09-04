import { describe, expect, it } from "vitest";
import { normalizeSocialUrl, socialOptions } from "./socialPolicy";
import { socialDocument } from "./socialDocument";
import facebookUrls from "../../../tests/fixtures/facebook-urls.json";

describe("external execution whitelist", () => {
  it.each(facebookUrls.allowed)(
    "normalizes a Facebook URL without losing its identifiers: $url",
    ({ url, canonical }) => {
      expect(normalizeSocialUrl(url)).toEqual({
        provider: "facebook",
        url: canonical,
        id: "",
      });
      expect(normalizeSocialUrl(canonical)?.url).toBe(canonical);
    },
  );
  it.each(facebookUrls.rejected)(
    "rejects an invalid, ambiguous or non-post Facebook URL: %s",
    (url) => {
      expect(normalizeSocialUrl(url)).toBeNull();
    },
  );
  it.each([
    [
      "https://www.facebook.com/ISS/posts/nasa-astronaut-megan-mcarthur/1194948136005111/",
      "facebook",
      "https://www.facebook.com/ISS/posts/1194948136005111",
    ],
    [
      "https://twitter.com/Interior/status/463440424141459456?s=20#part",
      "x",
      "https://x.com/Interior/status/463440424141459456",
    ],
    ["https://x.com/i/web/status/20", "x", "https://x.com/i/web/status/20"],
    [
      "https://instagram.com/reel/C6H039Ctw_b/?utm_source=ig_embed",
      "instagram",
      "https://www.instagram.com/reel/C6H039Ctw_b/",
    ],
    [
      "https://m.tiktok.com/@scout2015/video/6718335390845095173?is_copy_url=1",
      "tiktok",
      "https://www.tiktok.com/@scout2015/video/6718335390845095173",
    ],
    [
      "https://m.facebook.com/facebook/posts/10154009990506729/",
      "facebook",
      "https://www.facebook.com/facebook/posts/10154009990506729",
    ],
  ])("canonicalizes allowed posts %s", (url, provider, canonical) => {
    expect(normalizeSocialUrl(url)).toMatchObject({ provider, url: canonical });
  });
  it.each([
    "https://%78.com/a/status/20",
    "https://x.com/a/status/21/../20",
    "http://x.com/a/status/20",
    "https://x.com:443/a/status/20",
    "https://x.com.evil.test/a/status/20",
    "https://x.com@evil.test/a/status/20",
    "https://x.com./a/status/20",
    "https://api.x.com/a/status/20",
    "https://x.com/a/status/20/../../settings",
    "https://x.com/a/status/%32%30",
    "https://x.com/a/status/20\\evil",
    "https://x.com/a/status/20\n",
    "https://x.com/a/status/20<script>",
    "https://x.com/a",
    "javascript:alert(1)",
    "https://facebook.com/plugins/post.php?href=https://evil.test",
    "https://facebook.com/share/p/abc",
    "https://fb.watch/abc",
    "https://facebook.com/groups/1/posts/2",
    "https://www.facebook.com.evil.test/page/posts/2",
    "https://instagram.com/explore/tags/test",
    "https://instagram.com/p/%2e%2e/settings",
    "https://tiktok.com/@user/photo/6718335390845095173",
    "https://tiktok.com/@user/video/not-a-number",
  ])("does not execute a non-whitelisted URL %s", (url) =>
    expect(normalizeSocialUrl(url)).toBeNull(),
  );
  it("requires master, social and provider settings", () => {
    const params = {
      smartCards: true,
      socialCards: true,
      xEmbed: true,
      facebookEmbed: true,
      instagramEmbed: true,
      tiktokEmbed: true,
    };
    expect(socialOptions(params)).toEqual({
      x: true,
      facebook: true,
      instagram: true,
      tiktok: true,
      loadMode: "immediate",
    });
    expect(socialOptions({ ...params, smartCards: false }).x).toBe(false);
    expect(socialOptions({ ...params, socialCards: false }).facebook).toBe(
      false,
    );
    expect(socialOptions({ ...params, xEmbed: false }).x).toBe(false);
    expect(socialOptions({ ...params, instagramEmbed: false }).instagram).toBe(
      false,
    );
    expect(
      socialOptions({ ...params, externalMediaLoadMode: "click" }).loadMode,
    ).toBe("click");
    expect(socialOptions({}).x).toBe(false);
  });
  it.each([
    [
      "https://x.com/a/status/20?q=%3Cscript%3E",
      "https://platform.twitter.com/widgets.js",
    ],
    [
      "https://www.instagram.com/p/DA5VlaMK1Wc/",
      "https://www.instagram.com/embed.js",
    ],
    [
      "https://www.tiktok.com/@scout2015/video/6718335390845095173",
      "https://www.tiktok.com/embed.js",
    ],
  ])("creates a fixed-provider CSP and script for %s", (url, sdk) => {
    const embed = normalizeSocialUrl(url)!;
    const html = socialDocument(
      embed,
      "0123456789abcdef",
      "0123456789abcdef",
      500,
    );
    expect(html).toContain(sdk);
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("%3Cscript%3E");
    expect(html).not.toContain("unsafe-eval");
  });
});
