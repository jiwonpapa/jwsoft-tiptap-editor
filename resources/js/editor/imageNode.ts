import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import type { DOMOutputSpec } from "@tiptap/pm/model";

import { normalizeClassTokens } from "@/editor/classTokens";

export type ImageAlignment = "left" | "center" | "right";
export type ImageSize = "25" | "50" | "75" | "100";

export const DEFAULT_IMAGE_CLASS_TOKENS =
  "jw-image jw-image-align-center jw-image-size-100";

export function imageClassTokens(
  alignment: ImageAlignment,
  size: ImageSize,
  current: unknown = "",
): string {
  const retained = normalizeClassTokens(current)
    .split(/\s+/u)
    .filter(
      (token) =>
        token === "jw-image-rounded" ||
        token === "jw-image-inline" ||
        token === "jw-image-block",
    );
  return normalizeClassTokens(
    [
      "jw-image",
      `jw-image-align-${alignment}`,
      `jw-image-size-${size}`,
      ...retained,
    ].join(" "),
  );
}

function directChild(
  element: HTMLElement,
  tagName: string,
): HTMLElement | null {
  return ([...element.children].find(
    (child) => child.tagName.toLowerCase() === tagName,
  ) ?? null) as HTMLElement | null;
}

export const PolicyImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: "",
        parseHTML: (element: HTMLElement) =>
          element.tagName.toLowerCase() === "figure"
            ? (directChild(element, "figcaption")?.textContent ?? "")
            : "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure.jw-image",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const image = directChild(element, "img");
          if (!(image instanceof HTMLImageElement)) return false;
          return {
            src: image.getAttribute("src"),
            alt: image.getAttribute("alt"),
            title: image.getAttribute("title"),
            width: image.getAttribute("width"),
            height: image.getAttribute("height"),
          };
        },
      },
      {
        tag: this.options.allowBase64
          ? "img[src]"
          : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }): DOMOutputSpec {
    const className = normalizeClassTokens(HTMLAttributes.class);
    const imageAttributes = { ...HTMLAttributes };
    delete imageAttributes.class;
    const image: DOMOutputSpec = [
      "img",
      mergeAttributes(this.options.HTMLAttributes, imageAttributes),
    ];
    if (!className.split(/\s+/u).includes("jw-image")) {
      return className
        ? [
            "img",
            mergeAttributes(this.options.HTMLAttributes, imageAttributes, {
              class: className,
            }),
          ]
        : image;
    }

    const caption =
      typeof node.attrs.caption === "string" ? node.attrs.caption.trim() : "";
    const figureAttributes = { class: className };
    return caption
      ? ["figure", figureAttributes, image, ["figcaption", {}, caption]]
      : ["figure", figureAttributes, image];
  },
});
