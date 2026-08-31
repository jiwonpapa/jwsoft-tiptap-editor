import { describe, expect, it } from "vitest";
import { normalizeSocialUrl, socialOptions } from "./socialPolicy";
import { socialDocument } from "./socialDocument";

describe("external execution whitelist", () => {
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
  ])("does not execute a non-whitelisted URL %s", (url) =>
    expect(normalizeSocialUrl(url)).toBeNull(),
  );
  it("requires master, social and provider settings", () => {
    const params = {
      smartCards: true,
      socialCards: true,
      xEmbed: true,
      facebookEmbed: true,
    };
    expect(socialOptions(params)).toEqual({
      x: true,
      facebook: true,
      loadMode: "immediate",
    });
    expect(socialOptions({ ...params, smartCards: false }).x).toBe(false);
    expect(socialOptions({ ...params, socialCards: false }).facebook).toBe(
      false,
    );
    expect(socialOptions({ ...params, xEmbed: false }).x).toBe(false);
    expect(
      socialOptions({ ...params, externalMediaLoadMode: "click" }).loadMode,
    ).toBe("click");
    expect(socialOptions({}).x).toBe(false);
  });
  it("creates a fixed-provider CSP and script, not user supplied HTML", () => {
    const embed = normalizeSocialUrl(
      "https://x.com/a/status/20?q=%3Cscript%3E",
    )!;
    const html = socialDocument(
      embed,
      "0123456789abcdef",
      "0123456789abcdef",
      500,
    );
    expect(html).toContain("https://platform.twitter.com/widgets.js");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain(
      "connect-src https://cdn.syndication.twimg.com https://syndication.twitter.com",
    );
    expect(html).not.toContain("connect.facebook.net");
    expect(html).not.toContain("%3Cscript%3E");
    expect(html).not.toContain("unsafe-eval");
  });
});
