import { EDITOR_POLICY } from "@/generated/editorPolicy";
import type { SocialEmbed } from "./socialPolicy";

interface Payload {
  embed: SocialEmbed;
  sdk: string;
  channel: string;
  origin: string;
  width: number;
}

interface ProviderWindow extends Window {
  twttr?: {
    widgets: {
      createTweet: (
        id: string,
        target: HTMLElement,
        options: Record<string, unknown>,
      ) => Promise<HTMLElement | undefined>;
    };
  };
  FB?: {
    init: (options: Record<string, unknown>) => void;
    XFBML: { parse: (target: HTMLElement, callback: () => void) => void };
  };
  instgrm?: { Embeds: { process: () => void } };
}

function prepareProviderTarget(payload: Payload, target: HTMLElement): void {
  if (payload.embed.provider === "facebook") {
    const post = document.createElement("div");
    post.className = "fb-post";
    post.dataset.href = payload.embed.url;
    post.dataset.width = String(payload.width);
    post.dataset.showText = "true";
    target.append(post);
  } else if (payload.embed.provider === "instagram") {
    const post = document.createElement("blockquote");
    post.className = "instagram-media";
    post.dataset.instgrmPermalink = payload.embed.url;
    post.dataset.instgrmVersion = "14";
    const link = document.createElement("a");
    link.href = payload.embed.url;
    link.textContent = "Instagram";
    post.append(link);
    target.append(post);
  } else if (payload.embed.provider === "tiktok") {
    const post = document.createElement("blockquote");
    post.className = "tiktok-embed";
    post.setAttribute("cite", payload.embed.url);
    post.dataset.videoId = payload.embed.id;
    const section = document.createElement("section");
    const link = document.createElement("a");
    link.href = payload.embed.url;
    link.textContent = "TikTok";
    section.append(link);
    post.append(section);
    target.append(post);
  }
}

function waitForProviderFrame(
  target: HTMLElement,
  success: () => void,
  failure: () => void,
): void {
  let complete = false;
  const timer = setTimeout(() => {
    observer.disconnect();
    if (!complete) failure();
  }, 15_000);
  const inspect = () => {
    if (complete || !target.querySelector("iframe")) return;
    complete = true;
    clearTimeout(timer);
    observer.disconnect();
    success();
  };
  const observer = new MutationObserver(inspect);
  observer.observe(target, { childList: true, subtree: true });
  inspect();
}

async function renderProvider(
  payload: Payload,
  target: HTMLElement,
  sdkWindow: ProviderWindow,
  success: () => void,
  failure: () => void,
  waitForFrame: typeof waitForProviderFrame,
): Promise<void> {
  if (payload.embed.provider === "x") {
    const result = await sdkWindow.twttr?.widgets.createTweet(
      payload.embed.id,
      target,
      {
        dnt: true,
        conversation: "none",
        cards: "visible",
        width: payload.width,
        align: "center",
      },
    );
    return result ? success() : failure();
  }
  if (payload.embed.provider === "facebook") {
    if (!sdkWindow.FB) return failure();
    sdkWindow.FB.init({ xfbml: false, version: "v23.0" });
    return sdkWindow.FB.XFBML.parse(target, success);
  }
  if (payload.embed.provider === "instagram") {
    if (!sdkWindow.instgrm) return failure();
    sdkWindow.instgrm.Embeds.process();
  }
  waitForFrame(target, success, failure);
}

/** Runs in a disposable display frame. No user HTML or provider response is evaluated. */
function bootstrap(
  payload: Payload,
  prepareTarget: typeof prepareProviderTarget,
  render: typeof renderProvider,
  waitForFrame: typeof waitForProviderFrame,
) {
  const target = document.getElementById("post")!;
  const sdkWindow = window as ProviderWindow;
  let ready = false;
  const report = (state: string) =>
    parent.postMessage(
      {
        channel: payload.channel,
        state,
        height: Math.ceil(target.getBoundingClientRect().height),
      },
      payload.origin,
    );
  const success = () => {
    ready = true;
    report("rendered");
  };
  new ResizeObserver(() => {
    if (ready) report("rendered");
  }).observe(target);
  prepareTarget(payload, target);
  const script = document.createElement("script");
  script.src = payload.sdk;
  script.async = true;
  script.onerror = () => report("error");
  script.onload = () => {
    void render(
      payload,
      target,
      sdkWindow,
      success,
      () => report("error"),
      waitForFrame,
    ).catch(() => report("error"));
  };
  document.head.append(script);
}

export function socialDocument(
  embed: SocialEmbed,
  nonce: string,
  channel: string,
  width: number,
): string {
  const policy = EDITOR_POLICY.externalEmbeds[embed.provider];
  const csp = `default-src 'none'; base-uri 'none'; form-action 'none'; script-src 'nonce-${nonce}' ${policy.scriptOrigins.join(" ")}; connect-src ${policy.connectOrigins.join(" ")}; frame-src ${policy.frameOrigins.join(" ")}; img-src ${policy.imageOrigins.join(" ")}; style-src 'unsafe-inline';`;
  const payload: Payload = {
    embed,
    sdk: policy.sdkUrl,
    channel,
    origin: window.location.origin,
    width,
  };
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  const runtime = `(${bootstrap.toString()})(${payloadJson},${prepareProviderTarget.toString()},${renderProvider.toString()},${waitForProviderFrame.toString()})`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;padding:0;background:#fff}#post{width:100%;overflow:hidden}iframe{max-width:100%}</style></head><body><div id="post"></div><script nonce="${nonce}">${runtime}</script></body></html>`;
}
