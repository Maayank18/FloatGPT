export const THEME_NAMES = ['dark', 'light', 'cream', 'mocha', 'pistachio', 'harbor'] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/** Older warm-light and near-black themes fold into the ones that remain. */
export function resolveTheme(theme: string | undefined): ThemeName {
  if (theme === 'peach') return 'cream';
  if (theme === 'midnight') return 'dark';
  if (theme && (THEME_NAMES as readonly string[]).includes(theme)) return theme as ThemeName;
  return 'dark';
}
