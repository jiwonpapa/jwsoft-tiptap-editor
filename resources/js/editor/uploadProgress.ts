export function uploadPhaseLabel(
  phase: "starting" | "uploading" | "processing",
  locale: string,
): string {
  const labels = {
    starting: ["업로드 준비 중…", "Preparing upload…"],
    uploading: ["업로드 중…", "Uploading…"],
    processing: ["업로드 완료 · 영상 확인 중…", "Processing video…"],
  };
  return labels[phase][locale === "en" ? 1 : 0];
}
