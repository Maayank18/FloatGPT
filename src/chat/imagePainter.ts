import { buildImageUrl, composeImagePrompt } from './imagePrompt';
import { findReferenceImage, isReferenceSubject, referenceMarkdown, type ReferenceHit } from './referenceImage';

export type ImageKeySet = {
  openai?: string;
  google?: string;
  selected?: string;
};

/** Pictures stay on the free model. Saved chat keys are not used to draw. */
export function imageKeysFromState(_state?: {
  settings?: { aiConfig?: { selectedProvider?: string; apiKeys?: Record<string, string> } };
}): ImageKeySet {
  return {};
}

export async function renderDrawnImage(
  subject: string,
  preparedPrompt?: string,
  lookup: (subject: string) => Promise<ReferenceHit | null> = findReferenceImage
): Promise<string> {
  const caption = subject.replace(/\s+/g, ' ').trim().slice(0, 240);
  if (isReferenceSubject(caption)) {
    try {
      const found = await lookup(caption);
      if (found) return referenceMarkdown(caption, found);
    } catch {
      // A missed lookup still draws the picture.
    }
  }
  const prompt = (preparedPrompt || composeImagePrompt(caption)).slice(0, 900);
  const src = buildImageUrl(caption, Math.floor(Math.random() * 1_000_000_000), prompt);
  return `![${caption}](${src})\n\n*${caption}*`;
}
