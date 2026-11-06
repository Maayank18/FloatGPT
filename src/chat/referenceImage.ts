const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'to', 'from']);
const TITLE_WORD = new Set([
  'lord', 'god', 'goddess', 'deity', 'divine', 'saint', 'king', 'queen',
  'prince', 'princess', 'emperor', 'empress', 'mount', 'mt', 'city'
]);
const COLOR = new Set(['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'black', 'white']);
const GENERIC = new Set([
  'house', 'home', 'car', 'cup', 'mug', 'phone', 'laptop', 'chair', 'table', 'book',
  'computer', 'robot', 'tree', 'flower', 'cake', 'pizza', 'street', 'road', 'room',
  'sky', 'cloud', 'mountain', 'river', 'beach', 'forest', 'ocean', 'building',
  'bike', 'bicycle', 'ball', 'box', 'bottle', 'shirt', 'dress', 'hat', 'food',
  'castle', 'boat', 'plane', 'train', 'clock', 'lamp', 'door', 'window', 'bridge'
]);
const GENERIC_PERSON = new Set([
  'person', 'people', 'human', 'humans', 'man', 'men', 'woman', 'women', 'girl', 'girls',
  'boy', 'boys', 'child', 'children', 'kid', 'kids', 'baby', 'portrait', 'face', 'faces',
  'someone', 'somebody', 'guy', 'guys', 'lady', 'ladies', 'crowd', 'family', 'couple'
]);
const SCENE = /\b(wearing|holding|riding|flying|looking at|made of|next to|in front of)\b|\b(with|on|in|under|beside)\s+(a|an|the|some)\b/i;
const SKIP_FILE = /\b(icon|logo|map|flag|diagram|locator|symbol|emblem|seal|coin|stamp|banner|poster|screenshot|scan|svg|pictogram)\b/i;
const PREFER_FILE = /\b(painting|statue|murti|idol|portrait|artwork|sculpture|anime|cartoon|character)\b/i;
const DOWNRANK_FILE = /\b(procession|festival|crowd|group|ceremony|temple|kovil|mosque|church|building|aerial)\b/i;
const OFF_SUBJECT = /\b(train|station|railway|tram|bus|metro|subway|anniversary|keychain|livery|circuit|circuito|stadium|airport|merchandise|cake|cookie|candy|snack|edible|eatable|food|lunch|latte|plush|plushies|toys?|cosplay|costumes?|wearing|dressed|parade|rice|pillows?|cushions?|balloons?|figurines?|stickers?|mugs?|shirts?|tshirts?)\b/i;

export type ReferenceHit = {
  thumbUrl: string;
  pageUrl: string;
  artist: string;
  license: string;
  source?: string;
};

export type WikipediaPick = {
  fileName: string;
  thumbUrl: string;
  pageUrl: string;
};

const cache = new Map<string, ReferenceHit | null>();

function wordsOf(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP.has(word));
}

function subjectTokens(subject: string): string[] {
  return wordsOf(subject).filter((word) => !TITLE_WORD.has(word) && !COLOR.has(word));
}

/** A short named subject can use a Commons photo. A composed scene is drawn instead. */
export function isReferenceSubject(subject: string): boolean {
  const clean = subject.replace(/\s+/g, ' ').trim();
  if (!clean || SCENE.test(clean)) return false;
  const tokens = subjectTokens(clean);
  if (tokens.length === 0 || tokens.length > 4) return false;
  if (tokens.every((token) => GENERIC.has(token) || GENERIC_PERSON.has(token))) return false;
  return true;
}

function plainTitle(fileTitle: string): string {
  return fileTitle
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/-/g, '')
    .replace(/(\d)([a-z])/gi, '$1 $2')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .toLowerCase();
}

/** India matches Indian and cat matches cats, so plain word forms still count. */
function hasWord(text: string, token: string): boolean {
  if (new RegExp(`\\b${token}\\b`, 'i').test(text)) return true;
  if (token.length < 3) return false;
  return text.split(/[^a-z0-9]+/).some((word) => {
    if (word.length < 3 || Math.abs(word.length - token.length) !== 1) return false;
    return word.startsWith(token) || token.startsWith(word);
  });
}

/** A flag, map, or logo file is skipped unless that is what was asked for. */
function skippedFile(title: string, tokens: string[]): boolean {
  const found = title.match(new RegExp(SKIP_FILE.source, 'gi')) || [];
  return found.some((word) => !tokens.some((token) => hasWord(word.toLowerCase(), token)));
}

function rasterThumb(info: any): boolean {
  const mime = String(info?.mime || '');
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') return true;
  return mime === 'image/svg+xml' && /\.png(?:\?|$)/i.test(String(info?.thumburl || ''));
}

/** Trademark notices still allow the picture to be shown. A copyright block does not. */
function blocksDisplay(restrictions: string): boolean {
  return /\b(copyright|non-free|nonfree|permission|consent|personality)\b/i.test(restrictions);
}

function metaValue(info: any, key: string): string {
  const raw = info?.extmetadata?.[key]?.value;
  return typeof raw === 'string' ? raw : '';
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function usableImage(page: any, tokens: string[]): { hit: ReferenceHit; score: number; index: number } | null {
  const info = page?.imageinfo?.[0];
  if (!rasterThumb(info)) return null;
  const thumb = String(info?.thumburl || '');
  if (!thumb.startsWith('https://') || !/wikimedia\.org/i.test(thumb)) return null;
  if (Number(info?.thumbwidth || info?.width || 0) < 400) return null;
  if (blocksDisplay(metaValue(info, 'Restrictions'))) return null;
  const title = plainTitle(String(page?.title || ''));
  if (!title || skippedFile(title, tokens) || OFF_SUBJECT.test(title)) return null;
  if (!tokens.every((token) => hasWord(title, token))) return null;

  const words = title.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !/^\d+$/.test(word) && !STOP.has(word));
  const extra = words.filter((word) => !tokens.some((token) => hasWord(word, token)));
  if (extra.length > 2) return null;
  if (extra.length >= 2 && !PREFER_FILE.test(title)) return null;
  let score = 40 - extra.length * 4;
  if (PREFER_FILE.test(title)) score += 8;
  if (DOWNRANK_FILE.test(title)) score -= 6;
  if (extra.length === 0) score += 10;
  if (score < 18) return null;
  const artist = plainText(metaValue(info, 'Artist')).slice(0, 80);
  const license = plainText(metaValue(info, 'LicenseShortName')).slice(0, 40);
  const pageUrl = String(info?.descriptionurl || '');
  const safePage = pageUrl.startsWith('https://commons.wikimedia.org/')
    ? pageUrl
    : `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || ''))}`;
  const thumbUrl = thumb.split('?')[0];
  return {
    hit: { thumbUrl, pageUrl: safePage, artist, license, source: 'Wikimedia Commons' },
    score,
    index: Number(page?.index || 99)
  };
}

/** Pick the Commons file whose title names the subject. Null when nothing qualifies. */
export function selectReferenceImage(subject: string, payload: any): ReferenceHit | null {
  const tokens = subjectTokens(subject);
  if (tokens.length === 0) return null;
  const pages = payload?.query?.pages;
  if (!pages || typeof pages !== 'object') return null;
  const ranked = Object.values(pages)
    .map((page) => usableImage(page, tokens))
    .filter((item): item is { hit: ReferenceHit; score: number; index: number } => Boolean(item))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.hit || null;
}

/** The encyclopedia article's lead picture, when the article title is the subject. */
export function selectWikipediaImage(subject: string, payload: any): WikipediaPick | null {
  const tokens = subjectTokens(subject);
  if (tokens.length === 0) return null;
  const pages = payload?.query?.pages;
  if (!pages || typeof pages !== 'object') return null;
  const ranked = Object.values(pages)
    .map((page: any) => {
      const title = plainTitle(String(page?.title || ''));
      if (page?.pageprops && 'disambiguation' in page.pageprops) return null;
      if (!title || /\b(disambiguation|list of)\b/i.test(title) || OFF_SUBJECT.test(title)) return null;
      if (!tokens.every((token) => hasWord(title, token))) return null;
      const thumb = String(page?.thumbnail?.source || '');
      const width = Number(page?.thumbnail?.width || 0);
      const fileName = String(page?.pageimage || '');
      const pageUrl = String(page?.fullurl || '');
      if (!fileName || !thumb.startsWith('https://') || width < 400 || !pageUrl.startsWith('https://')) return null;
      const words = title.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !/^\d+$/.test(word) && !STOP.has(word));
      const extra = words.filter((word) => !tokens.some((token) => hasWord(word, token)));
      if (extra.length > 3) return null;
      return { fileName, thumbUrl: thumb.split('?')[0], pageUrl, index: Number(page?.index || 99) };
    })
    .filter((item): item is WikipediaPick & { index: number } => Boolean(item))
    .sort((a, b) => a.index - b.index);
  const best = ranked[0];
  if (!best) return null;
  return { fileName: best.fileName, thumbUrl: best.thumbUrl, pageUrl: best.pageUrl };
}

/**
 * The article Wikipedia itself opens for these exact words, after its redirects.
 * "Indian flag" opens Flag of India and "peacock" opens Peafowl.
 */
export function selectWikipediaTitle(payload: any): WikipediaPick | null {
  const pages = payload?.query?.pages;
  if (!pages || typeof pages !== 'object') return null;
  for (const page of Object.values(pages) as any[]) {
    if (!page || 'missing' in page || 'invalid' in page) continue;
    if (page.pageprops && 'disambiguation' in page.pageprops) continue;
    const title = plainTitle(String(page.title || ''));
    if (!title || /\b(list of|index of|outline of)\b/i.test(title) || OFF_SUBJECT.test(title)) continue;
    const thumb = String(page?.thumbnail?.source || '');
    const width = Number(page?.thumbnail?.width || 0);
    const fileName = String(page?.pageimage || '');
    const pageUrl = String(page?.fullurl || '');
    if (!fileName || !thumb.startsWith('https://') || width < 400 || !pageUrl.startsWith('https://')) continue;
    return { fileName, thumbUrl: thumb.split('?')[0], pageUrl };
  }
  return null;
}

function titleGuesses(subject: string): string[] {
  const base = subject.replace(/^(?:an?\s+|the\s+)/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!base) return [];
  const sentence = base.charAt(0).toUpperCase() + base.slice(1);
  const titled = base.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return [...new Set([sentence, titled])];
}

export function referenceMarkdown(caption: string, hit: ReferenceHit): string {
  const cleanCaption = caption.replace(/\s+/g, ' ').trim().slice(0, 240);
  const details = [hit.license, hit.artist].filter(Boolean).join(' · ');
  const credit = details ? ` · ${details}` : '';
  const source = hit.source || (/\.wikipedia\.org\//i.test(hit.pageUrl) ? 'Wikipedia' : 'Wikimedia Commons');
  return `![${cleanCaption}](${hit.thumbUrl})\n\n*${cleanCaption}*\n\nSource: [${source}](${hit.pageUrl})${credit}`;
}

function hitFromInfo(page: any, pageUrl: string, source: string): ReferenceHit | null {
  const info = page?.imageinfo?.[0];
  if (!rasterThumb(info)) return null;
  const thumb = String(info?.thumburl || info?.url || '');
  if (!thumb.startsWith('https://') || !/wikimedia\.org/i.test(thumb)) return null;
  if (Number(info?.thumbwidth || info?.width || 0) < 400) return null;
  if (blocksDisplay(metaValue(info, 'Restrictions'))) return null;
  if (metaValue(info, 'NonFree') || /\b(fair use|non-free|nonfree)\b/i.test(metaValue(info, 'LicenseShortName'))) return null;
  const filePage = String(info?.descriptionurl || '');
  return {
    thumbUrl: thumb.split('?')[0],
    pageUrl: pageUrl || (filePage.startsWith('https://') ? filePage : ''),
    artist: plainText(metaValue(info, 'Artist')).slice(0, 80),
    license: plainText(metaValue(info, 'LicenseShortName')).slice(0, 40),
    source
  };
}

const NATURE_RANK = new Set(['species', 'subspecies']);
const NATURE_GROUP = new Set([
  'Mammalia', 'Aves', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Insecta', 'Arachnida', 'Mollusca', 'Animalia'
]);
const NATURE_LICENSE: Record<string, string> = {
  cc0: 'CC0',
  pd: 'Public domain',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nd': 'CC BY-ND',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'cc-by-nc-nd': 'CC BY-NC-ND'
};
const NATURE_PHOTO_HOST = /^https:\/\/(inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\/photos\//;

function plainName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:an?|the)\s+/, '');
}

/** A wildlife photo, only when the subject is exactly an animal's common or scientific name. */
export function selectNaturePhoto(subject: string, payload: any): ReferenceHit | null {
  const asked = plainName(subject);
  if (!asked) return null;
  const results = Array.isArray(payload?.results) ? payload.results : [];
  for (const taxon of results) {
    if (!taxon || taxon.is_active === false || !NATURE_RANK.has(String(taxon.rank || ''))) continue;
    if (!NATURE_GROUP.has(String(taxon.iconic_taxon_name || ''))) continue;
    if (/^homo\b/i.test(String(taxon.name || ''))) continue;
    if (plainName(taxon.preferred_common_name) !== asked && plainName(taxon.name) !== asked) continue;
    const photo = taxon.default_photo;
    const license = NATURE_LICENSE[String(photo?.license_code || '').toLowerCase()];
    const medium = String(photo?.medium_url || '');
    if (!license || !NATURE_PHOTO_HOST.test(medium) || !/\/medium\.(jpe?g|png)$/i.test(medium)) continue;
    const width = Number(photo?.original_dimensions?.width || 0);
    if (width && width < 500) continue;
    const id = Number(taxon.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const artist = plainText(String(photo?.attribution || ''))
      .match(/^\(c\)\s*([^,]+)/i)?.[1]
      ?.trim()
      .slice(0, 80) || '';
    return {
      thumbUrl: medium.replace(/\/medium\.(jpe?g|png)$/i, '/large.$1'),
      pageUrl: `https://www.inaturalist.org/taxa/${id}`,
      artist,
      license,
      source: 'iNaturalist'
    };
  }
  return null;
}

// Wikimedia throttles clients that do not name themselves. Browsers may not set User-Agent, so this header is used.
const WIKIMEDIA_HEADERS = { 'Api-User-Agent': 'FloatGPT/2.3.1 (https://github.com/Maayank18/FloatGPT)' };
const RATE_LIMIT_WAIT_MS = 1500;

async function readJson(url: string, fetchImpl: typeof fetch, timeoutMs = 8000): Promise<any | null> {
  const wikimedia = /^https:\/\/[a-z.]*(wikipedia|wikimedia)\.org\//i.test(url);
  const init = (): RequestInit => ({
    signal: AbortSignal.timeout(timeoutMs),
    ...(wikimedia ? { headers: WIKIMEDIA_HEADERS } : {})
  });
  let response = await fetchImpl(url, init());
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_WAIT_MS));
    response = await fetchImpl(url, init());
  }
  if (response.status === 429) throw new LookupError('busy', true);
  if (!response.ok) throw new LookupError(`status ${response.status}`, false);
  return response.json();
}

class LookupError extends Error {
  constructor(message: string, readonly busy: boolean) {
    super(message);
  }
}

async function lookupNature(subject: string, fetchImpl: typeof fetch): Promise<ReferenceHit | null> {
  const search = subject.replace(/^(?:an?\s+|the\s+)/i, '').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams({ q: search, per_page: '10', is_active: 'true', locale: 'en' });
  const payload = await readJson(`https://api.inaturalist.org/v1/taxa/autocomplete?${params.toString()}`, fetchImpl, 5000);
  return payload ? selectNaturePhoto(subject, payload) : null;
}

async function pickWikipedia(subject: string, fetchImpl: typeof fetch): Promise<WikipediaPick | null> {
  const shared = {
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'pageimages|info|pageprops',
    piprop: 'thumbnail|name',
    pithumbsize: '960',
    ppprop: 'disambiguation',
    inprop: 'url'
  };
  const guesses = titleGuesses(subject);
  if (guesses.length) {
    const exact = new URLSearchParams({ ...shared, redirects: '1', titles: guesses.join('|') });
    const payload = await readJson(`https://en.wikipedia.org/w/api.php?${exact.toString()}`, fetchImpl);
    const pick = payload ? selectWikipediaTitle(payload) : null;
    if (pick) return pick;
  }
  const search = subject.replace(/^(?:an?\s+|the\s+)/i, '').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams({ ...shared, generator: 'search', gsrlimit: '5', gsrsearch: search });
  const payload = await readJson(`https://en.wikipedia.org/w/api.php?${params.toString()}`, fetchImpl);
  return payload ? selectWikipediaImage(subject, payload) : null;
}

async function lookupWikipedia(subject: string, fetchImpl: typeof fetch): Promise<ReferenceHit | null> {
  const pick = await pickWikipedia(subject, fetchImpl);
  if (!pick) return null;
  const fileParams = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: `File:${pick.fileName}`,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Artist|Restrictions|NonFree',
    iiurlwidth: '960'
  });
  const filePayload = await readJson(`https://en.wikipedia.org/w/api.php?${fileParams.toString()}`, fetchImpl);
  const page = Object.values(filePayload?.query?.pages || {})[0];
  const hit = hitFromInfo(page, pick.pageUrl, 'Wikipedia');
  return hit?.pageUrl ? hit : null;
}

async function lookupCommons(subject: string, fetchImpl: typeof fetch): Promise<ReferenceHit | null> {
  const search = subject.replace(/^(?:an?\s+|the\s+)/i, '').replace(/\s+/g, ' ').trim();
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '12',
    gsrsearch: `${search} filetype:bitmap`,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '960'
  });
  const payload = await readJson(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, fetchImpl);
  return selectReferenceImage(subject, payload);
}

export async function findReferenceImage(
  subject: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReferenceHit | null> {
  if (subjectTokens(subject).length === 0) return null;
  const key = plainName(subject);
  if (cache.has(key)) return cache.get(key) || null;
  // A miss is remembered only when every source answered. A busy or failed source is asked again next time.
  let unsure = false;
  let busy = false;
  const ask = async (run: () => Promise<ReferenceHit | null>, wikimedia: boolean) => {
    if (wikimedia && busy) return null;
    try {
      return await run();
    } catch (error) {
      unsure = true;
      if (wikimedia && error instanceof LookupError && error.busy) busy = true;
      return null;
    }
  };
  const hit =
    (await ask(() => lookupNature(subject, fetchImpl), false)) ||
    (await ask(() => lookupWikipedia(subject, fetchImpl), true)) ||
    (await ask(() => lookupCommons(subject, fetchImpl), true));
  if (hit || !unsure) cache.set(key, hit);
  return hit;
}
