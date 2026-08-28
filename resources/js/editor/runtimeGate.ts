export const SERVER_WRITE_POLICY_READY = false;

export function isEditorWriteEnabled(
  readOnly: boolean,
  disabled: boolean,
): boolean {
  return SERVER_WRITE_POLICY_READY && !readOnly && !disabled;
}
