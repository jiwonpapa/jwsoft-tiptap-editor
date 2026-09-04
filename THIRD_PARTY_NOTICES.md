# Third-Party Notices

jw-editor is licensed under Apache-2.0. The components below retain their own licenses and copyright notices; inclusion does not relicense those components.

Release ZIP files preserve the exact JavaScript license texts under `licenses/npm/`. PHP dependency license files remain inside `vendor-bundle.zip`, with package manifests at `licenses/npm-manifest.json` and `licenses/composer-manifest.json`.

DOMPurify declares `MPL-2.0 OR Apache-2.0`; this distribution uses the Apache-2.0 option and includes both upstream license files for traceability. No Tiptap Pro package is included.

## JavaScript runtime dependencies

| Package                                    | License                   |
| ------------------------------------------ | ------------------------- |
| `@tiptap/core@3.30.5`                      | `MIT`                     |
| `@tiptap/extension-blockquote@3.30.5`      | `MIT`                     |
| `@tiptap/extension-bold@3.30.5`            | `MIT`                     |
| `@tiptap/extension-bullet-list@3.30.5`     | `MIT`                     |
| `@tiptap/extension-code@3.30.5`            | `MIT`                     |
| `@tiptap/extension-code-block@3.30.5`      | `MIT`                     |
| `@tiptap/extension-document@3.30.5`        | `MIT`                     |
| `@tiptap/extension-dropcursor@3.30.5`      | `MIT`                     |
| `@tiptap/extension-gapcursor@3.30.5`       | `MIT`                     |
| `@tiptap/extension-hard-break@3.30.5`      | `MIT`                     |
| `@tiptap/extension-heading@3.30.5`         | `MIT`                     |
| `@tiptap/extension-horizontal-rule@3.30.5` | `MIT`                     |
| `@tiptap/extension-image@3.30.5`           | `MIT`                     |
| `@tiptap/extension-italic@3.30.5`          | `MIT`                     |
| `@tiptap/extension-link@3.30.5`            | `MIT`                     |
| `@tiptap/extension-list@3.30.5`            | `MIT`                     |
| `@tiptap/extension-list-item@3.30.5`       | `MIT`                     |
| `@tiptap/extension-list-keymap@3.30.5`     | `MIT`                     |
| `@tiptap/extension-ordered-list@3.30.5`    | `MIT`                     |
| `@tiptap/extension-paragraph@3.30.5`       | `MIT`                     |
| `@tiptap/extension-placeholder@3.30.5`     | `MIT`                     |
| `@tiptap/extension-strike@3.30.5`          | `MIT`                     |
| `@tiptap/extension-table@3.30.5`           | `MIT`                     |
| `@tiptap/extension-text@3.30.5`            | `MIT`                     |
| `@tiptap/extension-text-align@3.30.5`      | `MIT`                     |
| `@tiptap/extension-underline@3.30.5`       | `MIT`                     |
| `@tiptap/extensions@3.30.5`                | `MIT`                     |
| `@tiptap/pm@3.30.5`                        | `MIT`                     |
| `@tiptap/starter-kit@3.30.5`               | `MIT`                     |
| `@types/trusted-types@2.0.7`               | `MIT`                     |
| `dompurify@3.4.14`                         | `(MPL-2.0 OR Apache-2.0)` |
| `linkifyjs@4.3.3`                          | `MIT`                     |
| `lucide@1.37.0`                            | `ISC`                     |
| `orderedmap@2.1.1`                         | `MIT`                     |
| `prosemirror-changeset@2.4.2`              | `MIT`                     |
| `prosemirror-commands@1.7.2`               | `MIT`                     |
| `prosemirror-dropcursor@1.8.3`             | `MIT`                     |
| `prosemirror-gapcursor@1.4.1`              | `MIT`                     |
| `prosemirror-history@1.5.0`                | `MIT`                     |
| `prosemirror-inputrules@1.5.1`             | `MIT`                     |
| `prosemirror-keymap@1.2.3`                 | `MIT`                     |
| `prosemirror-model@1.25.11`                | `MIT`                     |
| `prosemirror-schema-list@1.5.1`            | `MIT`                     |
| `prosemirror-state@1.4.4`                  | `MIT`                     |
| `prosemirror-tables@1.8.5`                 | `MIT`                     |
| `prosemirror-transform@1.12.0`             | `MIT`                     |
| `prosemirror-view@1.42.3`                  | `MIT`                     |
| `rope-sequence@1.3.4`                      | `MIT`                     |
| `social-media-parser@0.3.0`                | `MIT`                     |
| `typescript@5.9.3`                         | `Apache-2.0`              |
| `w3c-keyname@2.2.8`                        | `MIT`                     |

## PHP runtime dependencies

| Package                                | License |
| -------------------------------------- | ------- |
| `league/uri@7.8.1`                     | `MIT`   |
| `league/uri-interfaces@7.8.1`          | `MIT`   |
| `masterminds/html5@2.11.0`             | `MIT`   |
| `psr/http-factory@1.1.0`               | `MIT`   |
| `psr/http-message@2.0`                 | `MIT`   |
| `symfony/deprecation-contracts@v3.7.1` | `MIT`   |
| `symfony/html-sanitizer@v7.4.14`       | `MIT`   |

## Principal attribution

- Tiptap packages: Copyright (c) 2025 Tiptap GmbH, MIT License.
- ProseMirror, orderedmap, rope-sequence, and w3c-keyname: Copyright Marijn Haverbeke and contributors, MIT License.
- DOMPurify: Dr.-Ing. Mario Heiderich and Cure53, Apache-2.0 option selected.
- linkifyjs: Copyright (c) 2024 Nick Frasser, MIT License.
- Symfony packages: Fabien Potencier and Symfony contributors, MIT License.
- PHP-FIG packages, League URI, and Masterminds HTML5 retain the copyright notices shipped in `vendor-bundle.zip`.

This file is generated from `package-lock.json` and `composer.lock`. Run `npm run generate:notices` after dependency changes.
