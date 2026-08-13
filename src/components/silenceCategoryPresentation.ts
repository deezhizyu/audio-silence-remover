import type { SilenceCategoryKey } from '../audio/types';

export const SILENCE_CATEGORY_LABELS: Record<SilenceCategoryKey, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
};

export const SILENCE_CATEGORY_COLOR_VARS: Record<SilenceCategoryKey, string> = {
  short: '--color-silence-short',
  medium: '--color-silence-medium',
  long: '--color-silence-long',
};

export function resolveSilenceCategoryColor(category: SilenceCategoryKey): string {
  return `var(${SILENCE_CATEGORY_COLOR_VARS[category]})`;
}
