import type { Editor } from "@tiptap/core";
import { editorText } from "@/editor/locale";
import { syncEditorValue } from "@/editor/stateSync";
import { analyzeLegacyHtml } from "@/policy/runtimePolicy";
import type { PolicyConsent } from "@/editor/policyConsent";

export function renderLegacyWarning(options: {
  shell: HTMLElement;
  mount: HTMLElement;
  onContinue: () => void;
  locale: string;
}): void {
  const warning = document.createElement("div");
  warning.className = "jwsoft-tiptap-legacy-warning";
  warning.setAttribute("role", "alert");

  const message = document.createElement("div");
  message.textContent = editorText(
    options.locale,
    "이 글에 inline style·전용 class·지원하지 않는 HTML 서식이 있습니다. 설치·활성화·조회만으로 저장된 원문은 바뀌지 않습니다. 이 글을 jw-editor에서 수정 후 저장할 때 서식이 달라질 수 있으며 자동 변환되지 않습니다. 확인 전에는 편집·저장이 차단됩니다. 원문을 유지하려면 읽기 전용을 선택하십시오. 문제가 있으면 저장하지 말고 jw-editor를 비활성화한 뒤 CKEditor를 다시 활성화하십시오.",
  );
  warning.appendChild(message);

  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-legacy-actions";

  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "jwsoft-tiptap-legacy-action";
  continueButton.dataset.primary = "true";
  continueButton.textContent = editorText(
    options.locale,
    "위험 확인 후 편집 계속",
  );
  continueButton.addEventListener("click", () => {
    options.onContinue();
    warning.remove();
  });

  const keepReadOnlyButton = document.createElement("button");
  keepReadOnlyButton.type = "button";
  keepReadOnlyButton.className = "jwsoft-tiptap-legacy-action";
  keepReadOnlyButton.textContent = editorText(options.locale, "읽기 전용 유지");
  keepReadOnlyButton.addEventListener("click", () => {
    keepReadOnlyButton.disabled = true;
    message.textContent = editorText(
      options.locale,
      "읽기 전용으로 유지했습니다. 변경을 승인하기 전에는 저장이 차단됩니다.",
    );
  });

  actions.append(continueButton, keepReadOnlyButton);
  warning.appendChild(actions);
  options.shell.insertBefore(warning, options.mount);
}

export function configureLegacyEditing(options: {
  editor: Editor;
  toolbar: HTMLElement;
  mount: HTMLElement;
  content: string;
  containerId: string;
  name: string;
  locale: string;
  multilingual: boolean;
  consent: PolicyConsent;
}): void {
  const analysis = analyzeLegacyHtml(options.content, options.editor.getHTML());
  const setEditable = (approved: boolean) => {
    options.consent.set(options.locale, approved);
    options.editor.setEditable(approved);
    document
      .getElementById(options.containerId)
      ?.setAttribute("aria-readonly", String(!approved));
  };
  setEditable(!analysis.hasLoss);
  if (!analysis.hasLoss) return;
  renderLegacyWarning({
    shell: options.mount,
    mount: options.toolbar,
    locale: options.locale,
    onContinue: () => {
      setEditable(true);
      syncEditorValue({
        core: window.G7Core,
        name: options.name,
        locale: options.locale,
        value: analysis.canonicalEditorHtml,
        multilingual: options.multilingual,
      });
    },
  });
}
