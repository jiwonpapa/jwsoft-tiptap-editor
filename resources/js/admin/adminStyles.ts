import { DARK_THEME } from "@/theme";

export const ADMIN_STYLE_ID = "jwsoft-tiptap-admin-styles";
const root = ".jwsoft-tiptap-admin";
// Host Select portals are scoped to an open Select on our settings page.
const popup = `body:has(${root} button[aria-haspopup="listbox"][aria-expanded="true"]) > [role="listbox"]`;
const surfaces = `:is(${root}, ${popup})`;

export const ADMIN_CSS = `
${surfaces} { --jw-admin-surface: var(--color-white, #fff); --jw-admin-input: var(--color-gray-100, #f3f4f6); --jw-admin-border: var(--color-gray-200, #e5e7eb); --jw-admin-ink: var(--color-gray-900, #111827); --jw-admin-muted: var(--color-gray-600, #4b5563); --jw-admin-accent: var(--color-blue-600, #2563eb); color: var(--jw-admin-ink); color-scheme: light; }
${DARK_THEME} ${surfaces} { --jw-admin-surface: var(--color-gray-800, #1f2937); --jw-admin-input: var(--color-gray-700, #374151); --jw-admin-border: var(--color-gray-600, #4b5563); --jw-admin-ink: var(--color-gray-100, #f3f4f6); --jw-admin-muted: var(--color-gray-300, #d1d5db); --jw-admin-accent: var(--color-blue-400, #60a5fa); color-scheme: dark; }
${root} :is(.admin-card, .sticky-footer-buttons), ${popup} { background-color: var(--jw-admin-surface); border-color: var(--jw-admin-border); color: var(--jw-admin-ink); }
${root} :is(h1, h3, .form-label, .section-heading-md) { color: var(--jw-admin-ink); }
${root} .form-hint { color: var(--jw-admin-muted); font-weight: 400; }
${root} :is(.input, select, button[aria-haspopup="listbox"]) { background-color: var(--jw-admin-input); border-color: var(--jw-admin-border); color: var(--jw-admin-ink); }
${root} :is(.input, select, button):focus-visible { outline: 2px solid var(--jw-admin-accent); outline-offset: 2px; }
${root} .btn-secondary { background-color: var(--jw-admin-surface); border-color: var(--jw-admin-border); color: var(--jw-admin-ink); }
${root} .btn-primary { background-color: var(--color-blue-600, #2563eb); color: var(--color-white, #fff); }
${root} .btn:disabled { opacity: .55; }
${popup} [role="option"] { color: var(--jw-admin-ink); }
${popup} [role="option"]:is(:hover, [aria-selected="true"]) { background-color: var(--jw-admin-input); color: var(--jw-admin-accent); }
${root} .alert-warning { background-color: var(--color-yellow-50, #fefce8); border-color: var(--color-yellow-200, #fef08a); color: var(--color-yellow-900, #713f12); }
${root} .alert-info { background-color: var(--color-blue-50, #eff6ff); border-color: var(--color-blue-200, #bfdbfe); color: var(--color-blue-900, #1e3a8a); }
${root} .alert-danger { background-color: var(--color-red-50, #fef2f2); border-color: var(--color-red-200, #fecaca); color: var(--color-red-900, #7f1d1d); }
${DARK_THEME} ${root} .alert-warning { background-color: color-mix(in srgb, var(--color-yellow-900, #713f12) 20%, var(--jw-admin-surface)); border-color: var(--color-yellow-800, #854d0e); color: var(--color-yellow-100, #fef9c3); }
${DARK_THEME} ${root} .alert-info { background-color: color-mix(in srgb, var(--color-blue-900, #1e3a8a) 20%, var(--jw-admin-surface)); border-color: var(--color-blue-800, #1e40af); color: var(--color-blue-100, #dbeafe); }
${DARK_THEME} ${root} .alert-danger { background-color: color-mix(in srgb, var(--color-red-900, #7f1d1d) 20%, var(--jw-admin-surface)); border-color: var(--color-red-800, #991b1b); color: var(--color-red-100, #fee2e2); }
${root} :is(.alert-warning, .alert-info, .alert-danger) :is(h3, p) { color: inherit; }
${root} :is(.alert-warning, .alert-info, .alert-danger) { display: block; overflow-wrap: anywhere; }
${root} :is(.alert-warning, .alert-info, .alert-danger) h3 { margin-bottom: .5rem; }
`;

export function injectAdminStyles(): void {
  if (document.getElementById(ADMIN_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ADMIN_STYLE_ID;
  style.textContent = ADMIN_CSS;
  document.head.appendChild(style);
}
