import { SILENCE_CATEGORY_KEYS } from '../audio/types';
import { resolveSilenceCategoryColor, SILENCE_CATEGORY_LABELS } from './silenceCategoryPresentation';

export function Legend() {
  return (
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary">
      <span class="flex items-center gap-1.5">
        <span class="h-2 w-3.5 rounded-sm bg-text-tertiary/50" />
        Audio
      </span>
      {SILENCE_CATEGORY_KEYS.map(category => (
        <span key={category} class="flex items-center gap-1.5">
          <span class="h-2 w-3.5 rounded-sm" style={{ backgroundColor: resolveSilenceCategoryColor(category) }} />
          {SILENCE_CATEGORY_LABELS[category]} silence
        </span>
      ))}
    </div>
  );
}
