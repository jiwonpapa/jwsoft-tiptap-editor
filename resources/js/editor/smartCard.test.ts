import { afterEach, describe, expect, it, vi } from "vitest";

import { createEditor } from "@/editor/createEditor";
import {
  fetchLinkPreview,
  insertSmartCard,
  isSmartCardUrl,
} from "@/editor/smartCard";

const editors: ReturnType<typeof createEditor>[] = [];

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function editor() {
  const instance = createEditor({
    element: document.createElement("div"),
    content: "",
    placeholder: "",
    editable: true,
    onUpdate: () => undefined,
  });
  editors.push(instance);
  return instance;
}

describe("smart cards", () => {
  it("serializes only safe canonical card markup", () => {
    const instance = editor();
    insertSmartCard(instance, {
      url: "https://www.instagram.com/p/proof",
      provider: "instagram",
      providerLabel: "Instagram",
      title: "Proof <script>alert(1)</script>",
      description: "Safe & useful",
      imageUrl: null,
    });

    expect(instance.getHTML()).toBe(
      '<figure class="jw-card jw-card-instagram"><a class="jw-card-link" href="https://www.instagram.com/p/proof" target="_blank" rel="noopener noreferrer" title="Instagram"><strong>Proof &lt;script&gt;alert(1)&lt;/script&gt;</strong><p>Safe &amp; useful</p></a></figure><p></p>',
    );
  });

  it("accepts validated server metadata and rejects cross-host preview images", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              url: "https://example.com/article",
              provider: "generic",
              provider_label: "example.com",
              title: "Article",
              description: "Description",
              image_url: "https://cdn.example.net/image.jpg",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    await expect(
      fetchLinkPreview("https://example.com/article", request as typeof fetch),
    ).rejects.toThrow("링크 미리보기");
  });

  it("requires HTTPS URLs", () => {
    expect(isSmartCardUrl("https://example.com/post")).toBe(true);
    expect(isSmartCardUrl("http://example.com/post")).toBe(false);
    expect(isSmartCardUrl("https://user@example.com/post")).toBe(false);
  });
});
