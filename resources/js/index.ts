export const JWSoftTiptapEditorBuild = Object.freeze({
  identifier: "jwsoft-tiptap-editor",
  stage: "environment-scaffold",
  version: "0.1.0-alpha.1",
});

declare global {
  interface Window {
    JWSoftTiptapEditorBuild?: typeof JWSoftTiptapEditorBuild;
  }
}

window.JWSoftTiptapEditorBuild = JWSoftTiptapEditorBuild;
