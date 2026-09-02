import type { Extensions } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableKit } from "@tiptap/extension-table";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { ClassTokenExtension } from "@/editor/classTokens";
import { PolicyImage } from "@/editor/imageNode";
import {
  PolicyTextStyle,
  PolicySubscript,
  PolicySuperscript,
} from "@/editor/inlineStyle";
import { PolicyTaskItem, PolicyTaskList } from "@/editor/taskList";
import { MediaEmbedExtension } from "@/editor/mediaEmbed";
import type { MediaPlaybackOptions } from "@/editor/mediaPlayer";
import { SmartCardExtension } from "@/editor/smartCard";
import type { SocialOptions } from "@/editor/socialPolicy";

export interface EditorModuleOptions {
  placeholder: string;
  mediaPlayback?: MediaPlaybackOptions;
  socialEmbeds?: SocialOptions;
}

const PolicyTable = Table.extend({
  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return ["table", HTMLAttributes, ["tbody", 0]];
  },
});

/** Bundled, reviewed modules only. No untrusted dynamic registration API. */
const modules: ReadonlyArray<{
  id: string;
  create: (options: EditorModuleOptions) => Extensions;
}> = [
  {
    id: "writing",
    create: ({ placeholder }) => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          defaultProtocol: "https",
          openOnClick: false,
          protocols: ["https", "mailto", "tel"],
          HTMLAttributes: { target: null, rel: null, class: null },
        },
      }),
      ClassTokenExtension,
      PolicyTextStyle,
      PolicySubscript,
      PolicySuperscript,
      PolicyTaskList,
      PolicyTaskItem,
      Placeholder.configure({ placeholder }),
    ],
  },
  {
    id: "image",
    create: () => [PolicyImage.configure({ allowBase64: false })],
  },
  {
    id: "table",
    create: () => [
      TableKit.configure({ table: false }),
      PolicyTable.configure({ resizable: false, View: null }),
    ],
  },
  {
    id: "media",
    create: ({ mediaPlayback }) => [
      MediaEmbedExtension.configure(mediaPlayback ?? {}),
    ],
  },
  {
    id: "social",
    create: ({ socialEmbeds }) => [
      SmartCardExtension.configure(socialEmbeds ?? {}),
    ],
  },
];

export const BUILTIN_EDITOR_MODULES = Object.freeze(
  modules.map(({ id }) => id),
);

export function createEditorExtensions(
  options: EditorModuleOptions,
): Extensions {
  // Keep parsers even when insertion/upload is off so existing documents survive.
  return modules.flatMap((module) => module.create(options));
}
