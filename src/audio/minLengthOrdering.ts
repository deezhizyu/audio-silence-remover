import type { SilenceCategoryKey } from './types';

/**
 * The three categories' min lengths must stay non-decreasing (short <= medium <= long).
 * Editing one value cascades outward in both directions so the ordering is never violated:
 * raising a value pushes the categories above it up if they'd otherwise fall below it, and
 * lowering a value pulls the categories below it down if they'd otherwise exceed it.
 */
export function cascadeMinLengthOrdering(
  minLengthsByCategory: Record<SilenceCategoryKey, number>,
  changedCategory: SilenceCategoryKey,
): Record<SilenceCategoryKey, number> {
  const orderedCategories: SilenceCategoryKey[] = ['short', 'medium', 'long'];
  const orderedValues = orderedCategories.map(category => minLengthsByCategory[category]);
  const changedIndex = orderedCategories.indexOf(changedCategory);

  for (let index = changedIndex + 1; index < orderedValues.length; index++) {
    if (orderedValues[index] < orderedValues[index - 1]) {
      orderedValues[index] = orderedValues[index - 1];
    }
  }

  for (let index = changedIndex - 1; index >= 0; index--) {
    if (orderedValues[index] > orderedValues[index + 1]) {
      orderedValues[index] = orderedValues[index + 1];
    }
  }

  return {
    short: orderedValues[0],
    medium: orderedValues[1],
    long: orderedValues[2],
  };
}
