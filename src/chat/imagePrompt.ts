import { routeCommand } from './commandRouter';

const PERSON = /\b(person|people|human|humans|man|men|woman|women|girl|girls|boy|boys|face|faces|portrait|selfie|character|someone|somebody|lady|ladies|guy|guys|child|children|kid|kids|baby|couple|family|crowd|lord|god|goddess|deity|divine|king|queen|prince|princess|emperor|empress|saint|hero|heroine|warrior|sage|monk|priest)\b/i;
const NAMED_STYLE = /\b(cartoon|anime|photo|photograph|photographic|painting|watercolor|sketch|pixel|3d|vector|oil|illustration|comic)\b/i;

/** Pull the thing the user wants drawn. Null when this is not an image request. */
export function imageSubject(prompt: string): string | null {
  const route = routeCommand(prompt);
  if (route.command === 'image') {
    return route.strippedPrompt.replace(/\s+/g, ' ').trim();
  }

  const tidy = prompt
    .replace(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?/i, '')
    .replace(/\s+(?:please|thanks|thank you|for me)$/i, '')
    .replace(/[.?!]+$/g, '')
    .trim();

  const pictured = tidy.match(/^(?:create|make|generate|draw|paint|design|show me)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|drawing)\s+(?:of\s+)?(.+)$/i);
  if (pictured?.[1]) return pictured[1].replace(/\s+/g, ' ').trim();

  const named = tidy.match(/^(?:an?\s+)?(?:image|picture|photo|illustration)\s+of\s+(.+)$/i);
  if (named?.[1]) return named[1].replace(/\s+/g, ' ').trim();

  const drawn = tidy.match(/^draw\s+(?:me\s+)?(.+)$/i);
  if (drawn?.[1] && !/^(?:a\s+)?(?:conclusion|attention|line|blank|near|up|from|out)\b/i.test(drawn[1])) {
    return drawn[1].replace(/\s+/g, ' ').trim();
  }

  return null;
}

const SUBJECT_STOP = new Set([
  'a', 'an', 'the', 'of', 'and', 'with', 'in', 'on', 'for', 'to', 'from',
  'image', 'picture', 'photo', 'please', 'make', 'create', 'draw', 'me'
]);

function cleanPromptText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`]/g, ' ')
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function subjectWords(subject: string): string[] {
  return subject
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !SUBJECT_STOP.has(word));
}

/**
 * The picture prompt after the model has read the request.
 * The model's scene is used only when it still shows the asked subject
 * and does not invent a person. Otherwise the picture stays on the words the user typed.
 */
export function finalizeImagePrompt(subject: string, modelText: string): string {
  const asked = cleanPromptText(subject).slice(0, 240);
  const drafted = cleanPromptText(modelText).slice(0, 400);
  const words = subjectWords(asked);
  const body = drafted.toLowerCase();
  const head = body.slice(0, 120);
  const keepsSubject = words.length === 0 || words.every((word) => body.includes(word));
  const leadsWithSubject = words.length === 0 || words.every((word) => head.includes(word));
  const inventedPerson = Boolean(asked) && !PERSON.test(asked) && PERSON.test(drafted);
  let scene = asked;
  if (drafted && keepsSubject && !inventedPerson) {
    scene = leadsWithSubject ? drafted : `${asked}, ${drafted}`;
  }
  return composeImagePrompt(scene || asked);
}

/** The generation prompt. The user's subject stays first, and people are not added unless asked. */
export function composeImagePrompt(subject: string): string {
  const clean = subject.replace(/\s+/g, ' ').trim().slice(0, 240);
  const style = NAMED_STYLE.test(clean) ? '' : ' Rich color, sharp detail, the subject fills the frame.';
  const lock = PERSON.test(clean)
    ? ''
    : ' Only that subject. No people, no person, no face, no portrait, no human figure.';
  return `${clean}.${style}${lock}`.replace(/\s+/g, ' ').trim();
}

export function buildImageUrl(subject: string, seed: number, preparedPrompt?: string): string {
  const prompt = preparedPrompt || composeImagePrompt(subject);
  const wide = /\b(wide|landscape|panorama|banner)\b/i.test(subject);
  const tall = /\b(portrait|poster|vertical|tall)\b/i.test(subject);
  const width = wide ? 1280 : tall ? 768 : 1024;
  const height = wide ? 720 : tall ? 1024 : 1024;
  const params = new URLSearchParams({
    model: 'flux',
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: 'true',
    enhance: 'false',
    private: 'true',
    referrer: 'floatgpt.app'
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export function imageMarkdown(
  subject: string,
  seed = Math.floor(Math.random() * 1_000_000_000),
  preparedPrompt?: string
): string {
  const caption = subject.replace(/\s+/g, ' ').trim().slice(0, 240);
  const prompt = preparedPrompt || composeImagePrompt(caption);
  const url = buildImageUrl(caption, seed, prompt);
  return `![${caption}](${url})\n\n*${caption}*`;
}

/** A chat reply when the user asked for a picture outside /image. Null otherwise. */
export function imageReply(prompt: string): string | null {
  const route = routeCommand(prompt);
  if (route.command === 'image') {
    if (!route.strippedPrompt.trim()) {
      return 'Tell me what to draw.\n\n`/image a red house on a quiet street`';
    }
    // /image is understood by the model first, then drawn. Do not answer instantly.
    return null;
  }
  const subject = imageSubject(prompt);
  if (subject === null) return null;
  if (!subject) return null;
  return imageMarkdown(subject);
}
