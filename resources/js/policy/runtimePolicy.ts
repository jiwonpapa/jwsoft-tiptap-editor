import DOMPurify from "dompurify";

import {
  EDITOR_CLASS_TOKENS,
  EDITOR_DOMPURIFY_CONFIG,
  EDITOR_POLICY,
} from "@/generated/editorPolicy";

const URI_PATTERN =
  /^(?:(?:https|mailto|tel):|(?:[/?#.]|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$)))/i;
const allowedClassTokens = new Set<string>(EDITOR_CLASS_TOKENS);
const globalAttributes = new Set<string>(EDITOR_POLICY.globalAttributes);

export function isAllowedEditorUrl(value: string, media = false): boolean {
  const candidate = value.trim();
  if (
    !candidate ||
    /^[\s\u0000-\u001f\u007f]/u.test(candidate) ||
    /[\u202a-\u202e\u2066-\u2069]/u.test(candidate) ||
    candidate.startsWith("//")
  ) {
    return false;
  }

  try {
    const parsed = new URL(candidate, window.location.origin);
    const explicitScheme = /^[a-z][a-z0-9+.-]*:/i.exec(candidate)?.[0];
    if (!explicitScheme) {
      return media
        ? EDITOR_POLICY.media.allowRelative
        : EDITOR_POLICY.urls.allowRelativeLinks;
    }

    const scheme = parsed.protocol.slice(0, -1).toLowerCase();
    const schemes: readonly string[] = media
      ? EDITOR_POLICY.media.schemes
      : EDITOR_POLICY.urls.linkSchemes;
    if (!schemes.includes(scheme)) return false;
    if (scheme === "mailto" || scheme === "tel") return !media;
    if (parsed.username || parsed.password || !parsed.hostname) return false;

    const hosts: readonly string[] = media
      ? EDITOR_POLICY.media.allowedHosts
      : EDITOR_POLICY.urls.allowedLinkHosts;
    return (
      hosts.length === 0 ||
      hosts.some((host) => host.toLowerCase() === parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function normalizeElement(element: Element): void {
  const tag = element.tagName.toLowerCase();
  const definition =
    EDITOR_POLICY.elements[tag as keyof typeof EDITOR_POLICY.elements];
  if (!definition) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const allowedAttributes = new Set<string>([
    ...definition.attributes,
    ...globalAttributes,
  ]);
  for (const attribute of [...element.attributes]) {
    if (!allowedAttributes.has(attribute.name.toLowerCase())) {
      element.removeAttribute(attribute.name);
    }
  }

  if (element.hasAttribute("class")) {
    const tokens = [
      ...new Set(
        element
          .getAttribute("class")!
          .split(/\s+/u)
          .filter((token) => allowedClassTokens.has(token)),
      ),
    ];
    tokens.sort();
    if (tokens.length) element.setAttribute("class", tokens.join(" "));
    else element.removeAttribute("class");
  }

  for (const attribute of ["colspan", "rowspan", "width", "height"]) {
    const value = element.getAttribute(attribute);
    if (value === null) continue;
    if (!/^[1-9][0-9]{0,5}$/u.test(value)) element.removeAttribute(attribute);
    else element.setAttribute(attribute, String(Number(value)));
  }
  const start = element.getAttribute("start");
  if (start !== null) {
    if (!/^-?[0-9]{1,6}$/u.test(start)) element.removeAttribute("start");
    else element.setAttribute("start", String(Number(start)));
  }

  const enumeratedAttributes: Record<string, readonly string[]> = {
    dir: ["ltr", "rtl", "auto"],
    loading: ["lazy", "eager"],
    scope: ["row", "col", "rowgroup", "colgroup"],
  };
  for (const [attribute, allowed] of Object.entries(enumeratedAttributes)) {
    const value = element.getAttribute(attribute)?.toLowerCase();
    if (!value) continue;
    if (!allowed.includes(value)) element.removeAttribute(attribute);
    else element.setAttribute(attribute, value);
  }
  const lang = element.getAttribute("lang")?.toLowerCase();
  if (lang) {
    if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/u.test(lang))
      element.removeAttribute("lang");
    else element.setAttribute("lang", lang);
  }

  if (
    element.hasAttribute("href") &&
    !isAllowedEditorUrl(element.getAttribute("href")!, false)
  ) {
    element.removeAttribute("href");
  }
  if (
    element.hasAttribute("src") &&
    !isAllowedEditorUrl(element.getAttribute("src")!, true)
  ) {
    element.removeAttribute("src");
  }

  if (tag === "a") {
    const target = element.getAttribute("target")?.toLowerCase();
    if (target && !["_blank", "_self", "_parent", "_top"].includes(target)) {
      element.removeAttribute("target");
    } else if (target) {
      element.setAttribute("target", target);
    }

    const allowedRel = new Set([
      "noopener",
      "noreferrer",
      "nofollow",
      "ugc",
      "sponsored",
    ]);
    const rel = new Set(
      (element.getAttribute("rel") ?? "")
        .toLowerCase()
        .split(/\s+/u)
        .filter((token) => allowedRel.has(token)),
    );
    if (target === "_blank") {
      rel.add("noopener");
      rel.add("noreferrer");
    }
    if (rel.size) element.setAttribute("rel", [...rel].sort().join(" "));
    else element.removeAttribute("rel");
  }

  const attributes = [...element.attributes]
    .map(({ name, value }) => [name, value] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  for (const { name } of [...element.attributes]) element.removeAttribute(name);
  for (const [name, value] of attributes) element.setAttribute(name, value);
}

function cardProviderForHost(provider: string, host: string): boolean {
  const domains: Record<string, readonly string[]> = {
    instagram: ["instagram.com"],
    x: ["x.com", "twitter.com"],
    tiktok: ["tiktok.com"],
    facebook: ["facebook.com", "fb.watch"],
    threads: ["threads.net"],
  };
  if (provider === "generic") return host !== "";
  return (domains[provider] ?? []).some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

function normalizeCardFigures(root: DocumentFragment): void {
  const providers = [
    "generic",
    "instagram",
    "x",
    "tiktok",
    "facebook",
    "threads",
  ] as const;
  for (const figure of root.querySelectorAll<HTMLElement>("figure.jw-card")) {
    const matched = providers.filter((provider) =>
      figure.classList.contains(`jw-card-${provider}`),
    );
    const link = figure.querySelector<HTMLAnchorElement>("a.jw-card-link");
    const strong = link?.querySelector("strong");
    let parsed: URL | null = null;
    try {
      parsed = link ? new URL(link.getAttribute("href") ?? "") : null;
    } catch {
      parsed = null;
    }
    let valid =
      matched.length === 1 &&
      !!link &&
      !!strong?.textContent?.trim() &&
      parsed?.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      cardProviderForHost(matched[0] ?? "", parsed.hostname.toLowerCase());
    const image = link?.querySelector<HTMLImageElement>("img.jw-card-image");
    if (valid && image) {
      try {
        const imageUrl = new URL(image.getAttribute("src") ?? "");
        valid =
          imageUrl.protocol === "https:" &&
          !imageUrl.username &&
          !imageUrl.password &&
          !imageUrl.port &&
          imageUrl.hostname.toLowerCase() === parsed!.hostname.toLowerCase();
      } catch {
        valid = false;
      }
    }
    if (valid && link) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
      normalizeElement(link);
      continue;
    }
    for (const element of [
      figure,
      ...figure.querySelectorAll<HTMLElement>("*"),
    ]) {
      const classes = [...element.classList].filter(
        (token) => !token.startsWith("jw-card"),
      );
      if (classes.length) element.setAttribute("class", classes.join(" "));
      else element.removeAttribute("class");
      normalizeElement(element);
    }
  }
}

function normalizeImageFigures(root: DocumentFragment): void {
  const alignments = [
    "jw-image-align-left",
    "jw-image-align-center",
    "jw-image-align-right",
  ];
  const sizes = [
    "jw-image-size-25",
    "jw-image-size-50",
    "jw-image-size-75",
    "jw-image-size-100",
  ];
  for (const figure of root.querySelectorAll<HTMLElement>("figure.jw-image")) {
    const children = [...figure.children];
    const image = children[0];
    const caption = children[1];
    const valid =
      alignments.filter((token) => figure.classList.contains(token)).length ===
        1 &&
      sizes.filter((token) => figure.classList.contains(token)).length === 1 &&
      children.length <= 2 &&
      image instanceof HTMLImageElement &&
      isAllowedEditorUrl(image.getAttribute("src") ?? "", true) &&
      (!caption || caption.tagName.toLowerCase() === "figcaption");
    if (valid) continue;

    const classes = [...figure.classList].filter(
      (token) => !token.startsWith("jw-image"),
    );
    if (classes.length) figure.setAttribute("class", classes.join(" "));
    else figure.removeAttribute("class");
    normalizeElement(figure);
  }
}

function normalizeFragment(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of [...template.content.querySelectorAll("*")]) {
    normalizeElement(element);
  }
  normalizeImageFigures(template.content);
  normalizeCardFigures(template.content);
  return template.innerHTML;
}

export function sanitizeClientHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ...EDITOR_DOMPURIFY_CONFIG,
    ALLOWED_TAGS: [...EDITOR_DOMPURIFY_CONFIG.ALLOWED_TAGS],
    ALLOWED_ATTR: [...EDITOR_DOMPURIFY_CONFIG.ALLOWED_ATTR],
    FORBID_ATTR: [...EDITOR_DOMPURIFY_CONFIG.FORBID_ATTR],
    ALLOWED_URI_REGEXP: URI_PATTERN,
    KEEP_CONTENT: true,
  });
  return normalizeFragment(String(sanitized));
}

function normalizeRawHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of [...template.content.querySelectorAll("*")]) {
    for (const enumeratedAttribute of [
      "dir",
      "lang",
      "loading",
      "scope",
      "target",
    ]) {
      const value = element.getAttribute(enumeratedAttribute);
      if (value !== null)
        element.setAttribute(enumeratedAttribute, value.toLowerCase());
    }
    for (const numericAttribute of [
      "colspan",
      "rowspan",
      "width",
      "height",
      "start",
    ]) {
      const value = element.getAttribute(numericAttribute);
      if (value !== null && /^-?[0-9]{1,6}$/u.test(value))
        element.setAttribute(numericAttribute, String(Number(value)));
    }
    for (const tokenAttribute of ["class", "rel"]) {
      const value = element.getAttribute(tokenAttribute);
      if (value !== null) {
        element.setAttribute(
          tokenAttribute,
          [...new Set(value.toLowerCase().split(/\s+/u).filter(Boolean))]
            .sort()
            .join(" "),
        );
      }
    }
    const attributes = [...element.attributes]
      .map(({ name, value }) => [name.toLowerCase(), value] as const)
      .sort(([left], [right]) => left.localeCompare(right));
    for (const { name } of [...element.attributes])
      element.removeAttribute(name);
    for (const [name, value] of attributes) element.setAttribute(name, value);
  }
  return template.innerHTML;
}

function isEmptyDocument(html: string): boolean {
  const template = document.createElement("template");
  template.innerHTML = html;
  return (
    (template.content.textContent ?? "").trim() === "" &&
    !template.content.querySelector("img,table,hr")
  );
}

export interface LegacyHtmlAnalysis {
  hasLoss: boolean;
  canonicalEditorHtml: string;
  policyChanged: boolean;
  editorChanged: boolean;
}

export function analyzeLegacyHtml(
  originalHtml: string,
  editorHtml: string,
): LegacyHtmlAnalysis {
  const sanitizedOriginal = sanitizeClientHtml(originalHtml);
  const canonicalEditorHtml = sanitizeClientHtml(editorHtml);
  const bothEmpty =
    isEmptyDocument(originalHtml) && isEmptyDocument(canonicalEditorHtml);
  const policyChanged = normalizeRawHtml(originalHtml) !== sanitizedOriginal;
  const editorChanged = sanitizedOriginal !== canonicalEditorHtml;

  return {
    hasLoss: !bothEmpty && (policyChanged || editorChanged),
    canonicalEditorHtml,
    policyChanged,
    editorChanged,
  };
}
