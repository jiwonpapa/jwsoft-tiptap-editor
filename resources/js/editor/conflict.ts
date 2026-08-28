export function hasConflictingEditorRuntime(): boolean {
  return Boolean(window.__SirsoftCkeditor5 || window.CKEDITOR);
}
