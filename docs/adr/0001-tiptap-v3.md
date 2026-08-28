# ADR-0001: Tiptap v3 선택

- 상태: 승인
- 날짜: 2026-08-28

## 결정

MVP editor engine으로 Tiptap v3와 ProseMirror를 사용합니다. CKEditor, Lexical, 직접 ProseMirror, Slate는 기본 구현에서 제외합니다.

## 이유

- strict schema와 custom extension
- 기존 HTML parse/serialize 적합성
- MIT core와 self-host bundle
- G7 lifecycle adapter 안에서 framework 독립 실행 가능

## 결과

완성 UI는 직접 구성해야 합니다. Tiptap schema는 서버 보안을 대체하지 않습니다. Pro 기능은 별도 ADR이 필요합니다.
