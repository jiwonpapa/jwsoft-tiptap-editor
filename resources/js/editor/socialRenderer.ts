import { createSocialPlayer } from "./socialPlayer";
import type { SocialOptions } from "./socialPolicy";

const rendered = new Map<
  HTMLElement,
  {
    player: NonNullable<ReturnType<typeof createSocialPlayer>>;
    original: HTMLElement;
    signature: string;
  }
>();
let observer: MutationObserver | null = null;
let options: SocialOptions = {
  x: false,
  facebook: false,
  loadMode: "immediate",
};
let lifecycle = false;

export function enhanceContentSocial(current: SocialOptions = options): number {
  const signature = JSON.stringify(current);
  let count = 0;
  for (const [figure, entry] of rendered) {
    if (
      figure.isConnected &&
      entry.player.dom.parentElement === figure &&
      entry.signature === signature
    )
      continue;
    entry.player.destroy();
    if (figure.isConnected && entry.player.dom.parentElement === figure)
      figure.replaceChildren(...entry.original.childNodes);
    rendered.delete(figure);
  }
  for (const figure of document.querySelectorAll<HTMLElement>(
    ".jwsoft-tiptap-content figure.jw-card",
  )) {
    if (figure.closest(".jwsoft-tiptap-editable") || rendered.has(figure))
      continue;
    const provider = figure.classList.contains("jw-card-x")
      ? "x"
      : figure.classList.contains("jw-card-facebook")
        ? "facebook"
        : "";
    const source = figure.querySelector<HTMLAnchorElement>("a.jw-card-link");
    const player = createSocialPlayer(
      source?.getAttribute("href") ?? "",
      provider,
      current,
    );
    if (!player) continue;
    const original = figure.cloneNode(true) as HTMLElement;
    rendered.set(figure, { player, original, signature });
    figure.replaceChildren(player.dom);
    count++;
  }
  return count;
}

export function stopContentSocialObserver(): void {
  observer?.disconnect();
  observer = null;
  for (const [figure, entry] of rendered) {
    entry.player.destroy();
    if (entry.player.dom.parentElement === figure)
      figure.replaceChildren(...entry.original.childNodes);
  }
  rendered.clear();
}

export function startContentSocialObserver(current: SocialOptions): void {
  options = current;
  if (!lifecycle) {
    lifecycle = true;
    window.addEventListener("pagehide", stopContentSocialObserver);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) startContentSocialObserver(options);
    });
  }
  if (!observer) {
    observer = new MutationObserver(() => enhanceContentSocial(options));
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["href", "class"],
    });
  }
  enhanceContentSocial(current);
}
