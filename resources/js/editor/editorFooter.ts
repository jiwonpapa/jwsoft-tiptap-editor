import { installSourceCopy } from "@/editor/asyncEvent";
import type { Editor } from "@tiptap/core";
import { createDialog } from "@/editor/dialog";
import { sanitizeClientHtml } from "@/policy/runtimePolicy";
import manifest from "../../../plugin.json";

/** Product chrome is outside the document and never participates in saving. */
export function createEditorFooter(
  editor: Editor,
  locale: string,
): HTMLElement {
  const en = locale === "en";
  const footer = document.createElement("div");
  footer.className = "jwsoft-editor-footer";
  const identity = document.createElement("div");
  identity.className = "jwsoft-editor-identity";
  const name = document.createElement("span");
  name.textContent = "jw-editor";
  const version = document.createElement("span");
  version.textContent = `v${manifest.version}`;
  const help = document.createElement("button");
  help.type = "button";
  help.className = "jwsoft-editor-help-button";
  help.textContent = "?";
  help.title = help.ariaLabel = en ? "jw-editor help" : "jw-editor 도움말";
  identity.append(name, version, help);
  const count = document.createElement("span");
  count.className = "jwsoft-editor-count";
  footer.append(identity, count);

  const content = document.createElement("div");
  content.className = "jwsoft-editor-help";
  const about = document.createElement("p");
  about.textContent = `jw-editor · v${manifest.version} · Apache-2.0`;
  content.append(about);
  const tips = document.createElement("ul");
  for (const text of en
    ? [
        "Select text to format it. Use the image, video and link tools to insert media.",
        "Paste a supported URL on an empty line, or type it and press Enter. Availability depends on administrator settings.",
        "Ctrl/⌘ + Z undoes an edit. Escape closes this dialog. Changes are saved with the page’s Save button.",
        "Existing content is not changed by installation. Unsupported formatting may change only when you edit and save it.",
      ]
    : [
        "글자를 선택해 서식을 바꾸고 이미지·동영상·링크 도구로 미디어를 넣습니다.",
        "빈 줄에 지원 URL을 붙여넣거나 입력 후 Enter를 누르세요. 관리자 설정에 따라 사용 가능한 기능이 다릅니다.",
        "Ctrl/⌘ + Z로 실행취소하고 Esc로 창을 닫습니다. 본문은 글쓰기 화면의 저장 버튼으로 저장합니다.",
        "설치만으로 기존 글은 바뀌지 않습니다. 기존 글을 수정 후 저장할 때 지원하지 않는 서식이 달라질 수 있습니다.",
      ]) {
    const item = document.createElement("li");
    item.textContent = text;
    tips.append(item);
  }
  content.append(tips);
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = en
    ? "HTML source (read-only)"
    : "HTML 소스 보기 (읽기 전용)";
  const explanation = document.createElement("p");
  explanation.textContent = en
    ? "Sanitized HTML of the current editor content, not the original stored HTML. Player scripts are not stored. Source editing is not available."
    : "현재 편집 내용의 정제된 HTML입니다. 저장된 원본 HTML과 다를 수 있으며 플레이어 실행 코드는 저장하지 않습니다. 소스 편집은 지원하지 않습니다.";
  const source = document.createElement("textarea");
  source.readOnly = true;
  source.spellcheck = false;
  source.setAttribute(
    "aria-label",
    en ? "Read-only HTML source" : "읽기 전용 HTML 소스",
  );
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = en ? "Copy HTML" : "HTML 복사";
  const message = document.createElement("span");
  message.setAttribute("role", "status");
  const refresh = () => {
    if (editor.isDestroyed) return;
    const html = sanitizeClientHtml(editor.getHTML());
    if (source.value === html) return;
    source.value = html;
    message.textContent = "";
  };
  details.addEventListener("toggle", () => {
    if (details.open) refresh();
  });
  installSourceCopy(copy, source, message, refresh, en);
  const actions = document.createElement("div");
  actions.className = "jwsoft-editor-source-actions";
  actions.append(copy, message);
  details.append(summary, explanation, source, actions);
  content.append(details);
  const docs = document.createElement("a");
  docs.href = "https://github.com/jiwonpapa/jwsoft-tiptap-editor#readme";
  docs.target = "_blank";
  docs.rel = "noopener noreferrer";
  docs.textContent = en
    ? "Documentation and installation ↗"
    : "설치·사용 안내 ↗";
  content.append(docs);
  const dialog = createDialog({
    title: en ? "jw-editor help" : "jw-editor 도움말",
    trigger: help,
    content,
    locale,
    editor,
  });
  help.addEventListener("click", refresh);
  footer.append(dialog.element);
  const update = () => {
    const length = Array.from(editor.state.doc.textContent).length;
    count.textContent = en
      ? `${length.toLocaleString()} characters`
      : `${length.toLocaleString()}자`;
  };
  editor.on("update", update);
  editor.on("destroy", () => {
    editor.off("update", update);
    footer.remove();
  });
  update();
  return footer;
}
