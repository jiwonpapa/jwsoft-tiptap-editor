import { normalizeSocialUrl, type SocialOptions } from "./socialPolicy";
import { socialDocument } from "./socialDocument";

/** Common display-only renderer. SDKs are disposed with this frame, never serialized. */
export function createSocialPlayer(
  url: string,
  provider: string,
  options: SocialOptions,
) {
  const embed = normalizeSocialUrl(url);
  if (!embed || embed.provider !== provider || !options[embed.provider])
    return null;
  const dom = document.createElement("div");
  dom.className = "jw-social-surface";
  const viewport = document.createElement("div");
  viewport.className = "jw-social-viewport";
  const status = document.createElement("p");
  status.className = "jw-social-status";
  status.setAttribute("role", "status");
  const english = window.G7Core?.locale?.current?.() === "en";
  const label = provider === "x" ? "X" : "Facebook";
  const original = document.createElement("a");
  original.href = embed.url;
  original.target = "_blank";
  original.rel = "noopener noreferrer";
  original.textContent = `${label} · ${english ? "Open original" : "원문 열기"}`;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = `${label} ${english ? "Load post" : "게시물 불러오기"}`;
  const footer = document.createElement("div");
  footer.className = "jw-social-footer";
  footer.append(original, button);
  dom.append(viewport, status, footer);
  let frame: HTMLIFrameElement | null = null;
  let channel = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let height = 0;
  let width = 550;
  const clear = () => {
    clearTimeout(timer);
    frame?.remove();
    frame = null;
    viewport.style.height = "0px";
  };
  const failure = () => {
    clear();
    dom.dataset.state = "error";
    status.textContent = english
      ? "Unable to load this public post. It may be private, deleted, or blocked. Open the original or retry."
      : "게시물을 불러오지 못했습니다. 비공개·삭제·연결 차단 여부는 원문에서 확인해 주세요.";
    button.hidden = false;
    button.textContent = english ? "Retry" : "다시 시도";
  };
  const size = () => {
    if (!frame) return;
    const scale = Math.min(1, (dom.clientWidth || width) / width);
    frame.style.transform = `scale(${scale})`;
    viewport.style.height = `${Math.ceil(height * scale)}px`;
  };
  const load = () => {
    if (disposed) return;
    clear();
    dom.dataset.state = "loading";
    button.hidden = true;
    status.textContent = `${label} ${english ? "Loading post…" : "게시물 불러오는 중…"}`;
    const token = new Uint32Array(4);
    crypto.getRandomValues(token);
    channel = [...token].map((n) => n.toString(16).padStart(8, "0")).join("");
    width = Math.min(
      550,
      Math.max(provider === "x" ? 250 : 350, dom.clientWidth || 550),
    );
    frame = document.createElement("iframe");
    frame.title = `${label} ${english ? "post" : "게시물"}`;
    frame.className = "jw-social-frame";
    frame.width = String(width);
    frame.height = "0";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "fullscreen; encrypted-media; picture-in-picture";
    frame.srcdoc = socialDocument(embed, channel, channel, width);
    viewport.append(frame);
    timer = setTimeout(failure, 20000);
  };
  const message = (event: MessageEvent) => {
    if (
      !frame ||
      event.source !== frame.contentWindow ||
      event.origin !== window.location.origin ||
      event.data?.channel !== channel
    )
      return;
    if (event.data.state === "error") return failure();
    if (
      event.data.state !== "rendered" ||
      typeof event.data.height !== "number" ||
      !Number.isFinite(event.data.height) ||
      event.data.height < 50 ||
      event.data.height > 20000
    )
      return;
    clearTimeout(timer);
    height = event.data.height;
    frame.height = String(height);
    size();
    dom.dataset.state = "rendered";
    // Provider HTML can contain a privacy/login error. Do not call iframe creation a successful post fetch.
    status.textContent = english
      ? "If the provider cannot display this post, open the original."
      : "제공자 화면에서 게시물을 볼 수 없으면 원문을 확인해 주세요.";
  };
  window.addEventListener("message", message);
  const resize = new ResizeObserver(size);
  resize.observe(dom);
  button.addEventListener("click", load);
  if (options.loadMode === "immediate")
    queueMicrotask(() => {
      if (!disposed) load();
    });
  else {
    dom.dataset.state = "idle";
    status.textContent = english
      ? "Loading connects to the external provider."
      : "불러오면 외부 제공자에 연결됩니다.";
  }
  return {
    dom,
    destroy() {
      disposed = true;
      clear();
      resize.disconnect();
      window.removeEventListener("message", message);
    },
  };
}
