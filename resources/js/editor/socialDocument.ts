import { EDITOR_POLICY } from "@/generated/editorPolicy";
import type { SocialEmbed } from "./socialPolicy";

interface Payload {
  embed: SocialEmbed;
  sdk: string;
  channel: string;
  origin: string;
  width: number;
}

/** Runs in a disposable display frame. No user HTML or provider response is evaluated. */
function bootstrap(payload: Payload) {
  const target = document.getElementById("post")!;
  const sdkWindow = window as typeof window & {
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
  };
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
  new ResizeObserver(() => {
    if (ready) report("rendered");
  }).observe(target);
  if (payload.embed.provider === "facebook") {
    const post = document.createElement("div");
    post.className = "fb-post";
    post.dataset.href = payload.embed.url;
    post.dataset.width = String(payload.width);
    post.dataset.showText = "true";
    target.append(post);
  }
  const script = document.createElement("script");
  script.src = payload.sdk;
  script.async = true;
  script.onerror = () => report("error");
  script.onload = async () => {
    try {
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
        if (!result) return report("error");
        ready = true;
        report("rendered");
      } else {
        if (!sdkWindow.FB) return report("error");
        sdkWindow.FB.init({ xfbml: false, version: "v23.0" });
        sdkWindow.FB.XFBML.parse(target, () => {
          ready = true;
          report("rendered");
        });
      }
    } catch {
      report("error");
    }
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
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;padding:0;background:#fff}#post{width:100%;overflow:hidden}iframe{max-width:100%}</style></head><body><div id="post"></div><script nonce="${nonce}">(${bootstrap.toString()})(${json})</script></body></html>`;
}
