import FilerobotImageEditor from "filerobot-image-editor";
import type {
  ImageEditorConstructor,
  ImageEditorVendor,
} from "@/features/image-editor/vendorTypes";

const Editor = FilerobotImageEditor as unknown as ImageEditorConstructor;
const vendor: ImageEditorVendor = Object.freeze({
  Editor,
  TABS: Editor.TABS,
  TOOLS: Editor.TOOLS,
});

window.__JWSoftImageEditorVendor = vendor;
