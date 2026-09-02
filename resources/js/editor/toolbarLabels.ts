import type { ClassTokenCategory } from "@/editor/classTokens";

export const tokenLabels: Partial<
  Record<ClassTokenCategory, Record<string, string>>
> = {
  textSize: {
    "jw-text-sm": "작게",
    "jw-text-base": "기본",
    "jw-text-lg": "크게",
    "jw-text-xl": "매우 크게",
  },
  alignment: {
    "jw-align-left": "왼쪽",
    "jw-align-center": "가운데",
    "jw-align-right": "오른쪽",
    "jw-align-justify": "양쪽 정렬",
  },
  indentation: {
    "jw-indent-1": "들여쓰기 1단계",
    "jw-indent-2": "들여쓰기 2단계",
    "jw-indent-3": "들여쓰기 3단계",
    "jw-indent-4": "들여쓰기 4단계",
  },
  spacing: {
    "jw-space-tight": "좁게",
    "jw-space-normal": "기본",
    "jw-space-relaxed": "넓게",
  },
  table: {
    "jw-table": "기본 표",
    "jw-table-striped": "줄무늬 표",
  },
  image: {
    "jw-image": "이미지",
    "jw-image-align-left": "왼쪽",
    "jw-image-align-center": "가운데",
    "jw-image-align-right": "오른쪽",
    "jw-image-size-25": "너비 25%",
    "jw-image-size-50": "너비 50%",
    "jw-image-size-75": "너비 75%",
    "jw-image-size-100": "너비 100%",
    "jw-image-inline": "글 안",
    "jw-image-block": "가운데 블록",
    "jw-image-rounded": "둥근 모서리",
  },
  media: {
    "jw-media": "미디어",
    "jw-media-16x9": "16:9",
    "jw-media-9x16": "9:16",
    "jw-media-youtube": "YouTube",
    "jw-media-vimeo": "Vimeo",
    "jw-media-mp4": "MP4",
    "jw-media-source": "미디어 주소",
  },
  card: {
    "jw-card": "링크 카드",
    "jw-card-generic": "일반 링크 카드",
    "jw-card-instagram": "Instagram 카드",
    "jw-card-x": "X 카드",
    "jw-card-tiktok": "TikTok 카드",
    "jw-card-facebook": "Facebook 카드",
    "jw-card-threads": "Threads 카드",
    "jw-card-link": "카드 주소",
    "jw-card-image": "카드 이미지",
  },
};
