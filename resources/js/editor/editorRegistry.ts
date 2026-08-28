import type { Editor } from "@tiptap/core";

class EditorRegistry {
  readonly #instances = new Map<string, Map<string, Editor>>();

  get size(): number {
    let count = 0;
    for (const locales of this.#instances.values()) {
      count += locales.size;
    }
    return count;
  }

  has(containerId: string, locale: string): boolean {
    return this.#instances.get(containerId)?.has(locale) ?? false;
  }

  get(containerId: string, locale: string): Editor | undefined {
    return this.#instances.get(containerId)?.get(locale);
  }

  set(containerId: string, locale: string, editor: Editor): void {
    const locales =
      this.#instances.get(containerId) ?? new Map<string, Editor>();
    const previous = locales.get(locale);
    if (previous && previous !== editor) {
      previous.destroy();
    }
    locales.set(locale, editor);
    this.#instances.set(containerId, locales);
  }

  destroy(containerId: string): void {
    const locales = this.#instances.get(containerId);
    if (!locales) return;
    for (const editor of locales.values()) {
      editor.destroy();
    }
    this.#instances.delete(containerId);
  }

  destroyAll(): void {
    for (const containerId of [...this.#instances.keys()]) {
      this.destroy(containerId);
    }
  }
}

export const editorRegistry = new EditorRegistry();
