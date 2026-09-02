/** Invoke immediately so preventDefault precedes the browser's native action. */
export function listenAsync(
  target: EventTarget,
  type: string,
  handler: (event: Event) => Promise<void>,
  onError: () => void,
): void {
  target.addEventListener(type, (event) => {
    try {
      handler(event).catch(onError);
    } catch {
      onError();
    }
  });
}

export function bindAsyncForm(
  form: HTMLFormElement,
  submit: HTMLButtonElement,
  error: HTMLElement,
  locale: string,
  handler: (event: Event) => Promise<void>,
): void {
  listenAsync(form, "submit", handler, () => {
    submit.disabled = false;
    error.hidden = false;
    error.textContent =
      locale === "en"
        ? "The action failed. Please try again."
        : "처리에 실패했습니다. 다시 시도해 주세요.";
  });
}

export function installSourceCopy(
  button: HTMLButtonElement,
  source: HTMLTextAreaElement,
  message: HTMLElement,
  refresh: () => void,
  english: boolean,
): void {
  listenAsync(
    button,
    "click",
    async () => {
      refresh();
      message.textContent = "";
      await navigator.clipboard.writeText(source.value);
      message.textContent = english ? "Copied." : "복사했습니다.";
    },
    () => {
      source.focus();
      source.select();
      message.textContent = english
        ? "Press Ctrl/⌘ + C to copy the selection."
        : "선택된 내용을 Ctrl/⌘ + C로 복사하세요.";
    },
  );
}
