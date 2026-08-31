import { Node, type Editor } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";

import { editorText } from "@/editor/locale";
import { socialNodeView } from "./socialView";
import type { SocialOptions } from "./socialPolicy";

const ENDPOINT = "/api/plugins/jwsoft-tiptap-editor/link-preview";
const PROVIDERS = [
  "generic",
  "instagram",
  "x",
  "tiktok",
  "facebook",
  "threads",
] as const;

export type SmartCardProvider = (typeof PROVIDERS)[number];

export interface SmartCardPreview {
  url: string;
  provider: SmartCardProvider;
  providerLabel: string;
  title: string;
  description: string;
  imageUrl: string | null;
}

interface PreviewPayload {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

function authorizationHeaders(): HeadersInit {
  try {
    const token = window.localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isSmartCardUrl(value: string): boolean {
  return safeHttpsUrl(value) !== null;
}

function parsePreview(
  data: Record<string, unknown> | undefined,
): SmartCardPreview | null {
  const url = safeHttpsUrl(data?.url);
  const provider = data?.provider;
  const providerLabel = data?.provider_label;
  const title = data?.title;
  const description = data?.description;
  if (
    !url ||
    typeof provider !== "string" ||
    !PROVIDERS.includes(provider as SmartCardProvider) ||
    typeof providerLabel !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string" ||
    !title.trim()
  ) {
    return null;
  }
  const rawImage = data?.image_url;
  const imageUrl =
    rawImage === null || rawImage === undefined ? null : safeHttpsUrl(rawImage);
  if (rawImage && !imageUrl) return null;
  if (imageUrl && new URL(imageUrl).hostname !== new URL(url).hostname)
    return null;

  return {
    url,
    provider: provider as SmartCardProvider,
    providerLabel: providerLabel.trim().slice(0, 160),
    title: title.trim().slice(0, 160),
    description: description.trim().slice(0, 300),
    imageUrl,
  };
}

export async function fetchLinkPreview(
  url: string,
  request: typeof fetch = fetch,
  locale: string = "ko",
  signal?: AbortSignal,
): Promise<SmartCardPreview> {
  const response = await request(ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authorizationHeaders(),
    },
    body: JSON.stringify({ url }),
    ...(signal ? { signal } : {}),
  });
  let payload: PreviewPayload = {};
  try {
    payload = (await response.json()) as PreviewPayload;
  } catch {
    // 서버의 비 JSON 오류 본문은 사용자에게 노출하지 않습니다.
  }
  const preview =
    response.ok && payload.success === true ? parsePreview(payload.data) : null;
  if (!preview) {
    throw new Error(
      payload.message ||
        editorText(locale, "링크 미리보기를 가져오지 못했습니다."),
    );
  }

  return preview;
}

export function insertSmartCard(
  editor: Editor,
  preview: SmartCardPreview,
  position?: number,
): boolean {
  const content = {
    type: "smartCard",
    attrs: preview,
  };
  return typeof position === "number"
    ? editor.commands.insertContentAt(position, content)
    : editor.chain().focus().insertContent(content).run();
}

export const SmartCardExtension = Node.create<SocialOptions>({
  name: "smartCard",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions: () => ({ x: false, facebook: false, loadMode: "immediate" }),
  addNodeView() {
    return socialNodeView(this.options);
  },

  addAttributes() {
    return {
      url: { default: "", rendered: false },
      provider: { default: "generic", rendered: false },
      providerLabel: { default: "", rendered: false },
      title: { default: "", rendered: false },
      description: { default: "", rendered: false },
      imageUrl: { default: null, rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure.jw-card",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const provider = PROVIDERS.find((value) =>
            node.classList.contains(`jw-card-${value}`),
          );
          const link = node.querySelector<HTMLAnchorElement>("a.jw-card-link");
          const url = safeHttpsUrl(link?.getAttribute("href"));
          const title =
            link?.querySelector("strong")?.textContent?.trim() ?? "";
          if (!provider || !link || !url || !title) return false;
          const rawImage = link
            .querySelector<HTMLImageElement>("img.jw-card-image")
            ?.getAttribute("src");
          const imageUrl = rawImage ? safeHttpsUrl(rawImage) : null;
          if (
            rawImage &&
            (!imageUrl || new URL(imageUrl).hostname !== new URL(url).hostname)
          ) {
            return false;
          }
          return {
            url,
            provider,
            providerLabel:
              link.getAttribute("title")?.trim() || new URL(url).hostname,
            title: title.slice(0, 160),
            description: (
              link.querySelector("p")?.textContent?.trim() ?? ""
            ).slice(0, 300),
            imageUrl,
          };
        },
      },
    ];
  },

  renderHTML({ node }): DOMOutputSpec {
    const provider = PROVIDERS.includes(
      node.attrs.provider as SmartCardProvider,
    )
      ? (node.attrs.provider as SmartCardProvider)
      : "generic";
    const linkChildren: DOMOutputSpec[] = [];
    if (node.attrs.imageUrl) {
      linkChildren.push([
        "img",
        {
          class: "jw-card-image",
          src: node.attrs.imageUrl,
          alt: "",
          loading: "lazy",
        },
      ]);
    }
    linkChildren.push(["strong", String(node.attrs.title)]);
    if (node.attrs.description) {
      linkChildren.push(["p", String(node.attrs.description)]);
    }
    return [
      "figure",
      { class: `jw-card jw-card-${provider}` },
      [
        "a",
        {
          class: "jw-card-link",
          href: node.attrs.url,
          target: "_blank",
          rel: "noopener noreferrer",
          title: node.attrs.providerLabel,
        },
        ...linkChildren,
      ],
    ];
  },
});
