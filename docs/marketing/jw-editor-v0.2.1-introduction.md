# jw-editor v0.2.1 홍보용 소개글

아래 내용은 그누보드 관련 게시판, 개발 블로그, 커뮤니티 공지에 그대로 붙여 넣을 수 있는 Markdown 원고입니다.

---

## 게시글 제목

**[그누보드7 플러그인] jw-editor v0.2.1 — 이미지 편집·MP4 업로드·SNS 게시물까지 한 번에**

## 게시글 본문

![jw-editor — Rich-text editor for Gnuboard 7](https://raw.githubusercontent.com/jiwonpapa/jwsoft-tiptap-editor/main/docs/assets/jw-editor-intro.png)

그누보드7에서 글, 이미지, 동영상, SNS 게시물을 함께 작성할 수 있는 **jw-editor v0.2.1**을 공개했습니다.

jw-editor는 Tiptap·ProseMirror 기반의 독립 플러그인입니다. 그누보드7 코어를 수정하지 않고 설치하며, 게시판뿐 아니라 관리자 게시판, 상품 설명, 페이지 본문에서도 같은 편집 경험을 제공합니다.

### 주요 기능

- **문서 편집**: 제목, 굵게·기울임·밑줄, 글자색·강조색, 정렬, 목록, 체크리스트, 링크, 표, 찾기·바꾸기, 전체화면
- **이미지 업로드**: 파일 선택, 드래그 앤 드롭, 클립보드 붙여넣기, 진행 상태, 실패 재시도
- **내장 이미지 편집**: JPEG·PNG·WebP 자르기, 회전, 크기 변경, 보정과 필터 적용
- **원본 이미지 보존**: 편집본은 새 파일로 저장하고 원본과 대체 텍스트·캡션·정렬·표시 크기를 유지
- **동영상**: MP4 청크 업로드와 재개, 원본 파일명·확장자 보존, 실제 영상 비율을 유지하는 반응형 플레이어
- **외부 미디어**: YouTube·Vimeo 영상과 X·Facebook·Instagram·TikTok 공개 게시물 지원
- **링크 카드**: 일반 HTTPS 주소의 제목과 설명을 카드 형태로 표시
- **관리자 설정**: 기능별 ON/OFF, 업로드 용량, 툴바 구성, 에디터 높이, 외부 콘텐츠 로드 방식, 이미지 관리·정리
- **사용 환경**: 모바일, 다크 모드, 한영 UI, 다국어 본문, 글자 수, 도움말, 읽기 전용 HTML 보기·복사

### v0.2.1에서 달라진 점

- 본문 이미지를 선택했을 때 **이미지 편집** 버튼이 바로 보이도록 개선했습니다.
- G7 병합 번들 환경에서 이미지 편집 도구의 주소를 잘못 계산해 로딩에 실패하던 문제를 수정했습니다.
- 관리자 화면 업데이트 직후 이미지 편집 설정명이 번역 키로 보이던 문제를 보완했습니다.
- 선택 도구의 툴팁 때문에 생기던 불필요한 가로·세로 스크롤을 수정했습니다.
- 배포 파일을 수정하고 버전을 올리지 않으면 로컬 검사, CI, 릴리스 단계에서 자동 차단하도록 버전 정책을 강화했습니다.

### MP4 청크 업로드 오류 수정

동영상 업로드 시 **`chunk 필드는 필수입니다`** 또는 checksum 필수 오류가 발생하던 문제를 수정했습니다. PHP가 multipart PUT 파일을 정상적으로 파싱하지 못하던 것이 원인이었으며, 청크 전송과 공개 라우트를 multipart POST로 통일했습니다.

### 설치와 업데이트

그누보드7 관리자에서 **플러그인 → 플러그인 설치 → GitHub에서 설치**를 선택한 뒤 아래 주소를 입력합니다.

```text
https://github.com/jiwonpapa/jwsoft-tiptap-editor
```

기존 사용자는 관리자 플러그인 화면에서 **업데이트 확인**을 실행해 `v0.2.1`로 업데이트할 수 있습니다.

- 저장소: <https://github.com/jiwonpapa/jwsoft-tiptap-editor>
- v0.2.1 릴리스: <https://github.com/jiwonpapa/jwsoft-tiptap-editor/releases/tag/v0.2.1>
- 변경 기록: <https://github.com/jiwonpapa/jwsoft-tiptap-editor/blob/main/CHANGELOG.md>

### 설치 전에 확인해 주세요

- 지원 버전은 그누보드7 `7.0.9` 이상입니다.
- CKEditor 등 다른 에디터 플러그인과 동시에 활성화하지 마세요.
- 설치·활성화·조회만으로 기존 본문을 자동 변경하지 않습니다.
- 기존 글을 jw-editor로 수정해 저장하면 지원하지 않는 inline style, 전용 class, HTML 구조가 달라질 수 있습니다.
- 이미지 편집은 플러그인이 관리하는 JPEG·PNG·WebP가 대상입니다. GIF·AVIF·외부 이미지는 현재 편집 대상이 아닙니다.
- 비공개·삭제·접근 제한된 SNS 게시물과 제공자 SDK 실패는 강제로 표시하지 않습니다.

jw-editor는 Apache License 2.0으로 공개하며, 별도 npm 빌드나 Tiptap Pro 결제 없이 설치 패키지로 사용할 수 있습니다.

---

## 짧은 소개문

그누보드7용 **jw-editor v0.2.1**을 공개했습니다. 글·표·이미지 업로드와 내장 이미지 편집, MP4 청크 업로드, YouTube·Vimeo, X·Facebook·Instagram·TikTok 게시물까지 하나의 에디터에서 다룰 수 있습니다. G7 코어 수정 없이 GitHub 주소로 설치하고 관리자에서 기능별로 켜고 끌 수 있습니다.

<https://github.com/jiwonpapa/jwsoft-tiptap-editor>

## 한 줄 소개

**이미지 편집·MP4 업로드·SNS 게시물까지 지원하는 그누보드7용 오픈소스 리치 텍스트 에디터, jw-editor v0.2.1**

## 썸네일 문구

```text
jw-editor v0.2.1
그누보드7 에디터 플러그인
이미지 편집 · MP4 · SNS
```

## 추천 태그

```text
#그누보드7 #Gnuboard7 #에디터 #Tiptap #ProseMirror #이미지편집 #동영상업로드 #오픈소스 #jweditor
```
