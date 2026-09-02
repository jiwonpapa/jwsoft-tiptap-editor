// Read both G7 theme signals without changing site state or storage.
export const DARK_THEME = ':is(html.dark, html[data-theme="dark"])';

export function withThemeSelectors(css: string): string {
  return css.replace(/html\.dark/g, DARK_THEME);
}
