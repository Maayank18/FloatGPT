export interface PriceOffer {
  store: string;
  title: string;
  price: number;
  url: string;
}

const STOP = new Set(['buy', 'price', 'prices', 'best', 'cheap', 'cheapest', 'online', 'the', 'a', 'an', 'for', 'in', 'india', 'from', 'with', 'and', 'or', 'to', 'of', 'new', 'deal']);
const ACCESSORY = /\b(case|cover|charger|cable|screen guard|tempered|skin|pouch|adapter|magsafe|stand|holder)\b/i;
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function cleanShoppingQuery(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function queryTokens(query: string): string[] {
  return cleanShoppingQuery(query)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !STOP.has(word));
}

export function offerMatches(title: string, query: string): boolean {
  const tokens = queryTokens(query);
  if (!tokens.length) return false;
  const hay = title.toLowerCase();
  if (!tokens.every((token) => hay.includes(token))) return false;
  if (!ACCESSORY.test(query) && ACCESSORY.test(title)) return false;
  return true;
}

export function rupees(raw: string): number {
  const cleaned = String(raw || '').replace(/[^\d.,]/g, '').replace(/,/g, '').replace(/\.00$/, '');
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount);
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

function lowestMatch(offers: PriceOffer[], query: string): PriceOffer | null {
  const ranked = offers
    .filter((offer) => offer.price >= 20 && offer.price < 50_000_000 && offerMatches(offer.title, query))
    .sort((a, b) => a.price - b.price);
  return ranked[0] || null;
}

function amazonTitle(card: string, query: string): string {
  const heading = card.match(/<h2\b[\s\S]*?<\/h2>/i)?.[0] || '';
  const spans = [...heading.matchAll(/<span[^>]*>([^<]{2,180})<\/span>/g)].map((match) => decode(match[1]));
  const alts = [...card.matchAll(/\balt="([^"]{12,240})"/g)]
    .map((match) => decode(match[1]).replace(/^Sponsored Ad\s*-\s*/i, ''));
  const candidates = [...spans, ...alts].filter(Boolean);
  return candidates.find((title) => offerMatches(title, query)) || candidates.sort((a, b) => b.length - a.length)[0] || '';
}

export function parseAmazonSearch(html: string, query: string): PriceOffer | null {
  const offers: PriceOffer[] = [];
  for (const card of html.split('data-asin="').slice(1)) {
    const asin = card.slice(0, 10);
    if (!/^B0[A-Z0-9]{8}$/.test(asin)) continue;
    const title = amazonTitle(card, query);
    const price = rupees((card.match(/a-offscreen">₹\s*([\d,]+)/) || [])[1] || '');
    if (!title || !price) continue;
    offers.push({ store: 'Amazon.in', title, price, url: `https://www.amazon.in/dp/${asin}` });
  }
  return lowestMatch(offers, query);
}

export function parseFlipkartSearch(html: string, query: string): PriceOffer | null {
  const offers: PriceOffer[] = [];
  const listed = /href="(\/[^"]+\/p\/[^"?]+)[^"]*"[\s\S]{0,2500}?class="RG5Slk">([^<]+)<[\s\S]{0,2200}?₹\s*([\d,]+)/g;
  const grid = /class="pIpigb"[^>]*title="([^"]+)"[^>]*href="(\/[^"]+\/p\/[^"?]+)[\s\S]{0,2800}?₹\s*([\d,]+)/g;
  for (const match of html.matchAll(listed)) {
    offers.push({
      store: 'Flipkart',
      title: decode(match[2]),
      price: rupees(match[3]),
      url: `https://www.flipkart.com${match[1]}`,
    });
  }
  for (const match of html.matchAll(grid)) {
    offers.push({
      store: 'Flipkart',
      title: decode(match[1]),
      price: rupees(match[3]),
      url: `https://www.flipkart.com${match[2]}`,
    });
  }
  return lowestMatch(offers, query);
}

export function parsePoorvikaSearch(html: string, query: string): PriceOffer | null {
  const offers: PriceOffer[] = [];
  const pattern = /href="(\/[^"]+\/p)"[\s\S]{0,600}?<b>([^<]+)<\/b>[\s\S]{0,900}?₹\s*([\d,]+)/g;
  for (const match of html.matchAll(pattern)) {
    offers.push({
      store: 'Poorvika',
      title: decode(match[2]),
      price: rupees(match[3]),
      url: `https://www.poorvika.com${match[1]}`,
    });
  }
  return lowestMatch(offers, query);
}

export function parseAptronixSearch(html: string, query: string): PriceOffer | null {
  const offers: PriceOffer[] = [];
  const pattern = /href="(\/products\/[^"]+)"[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]{0,800}?₹\s*([\d,]+)/g;
  for (const match of html.matchAll(pattern)) {
    offers.push({
      store: 'Aptronix',
      title: decode(match[2]),
      price: rupees(match[3]),
      url: `https://www.aptronixindia.com${match[1].split('?')[0]}`,
    });
  }
  return lowestMatch(offers, query);
}

const LABELS: Record<string, string> = {
  'amazon.in': 'Amazon.in',
  'amazon.com': 'Amazon',
  'flipkart.com': 'Flipkart',
  'poorvika.com': 'Poorvika',
  'aptronixindia.com': 'Aptronix',
  'croma.com': 'Croma',
  'reliancedigital.in': 'Reliance Digital',
  'vijaysales.com': 'Vijay Sales',
  'jiomart.com': 'JioMart',
  'bigbasket.com': 'BigBasket',
  'blinkit.com': 'Blinkit',
  'zeptonow.com': 'Zepto',
  'nykaa.com': 'Nykaa',
  'myntra.com': 'Myntra',
  'tatacliq.com': 'Tata CLiQ',
  'apple.com': 'Apple',
};

const NOT_A_SHOP = /(?:^|\.)(duckduckgo|google|bing|youtube|wikipedia|facebook|instagram|twitter|reddit|quora|pinterest|linkedin|yahoo|ndtv|theverge|indianexpress|timesofindia|hindustantimes|gadgets360|businesstoday|moneycontrol|livemint|indiatoday)\./i;

export function storeName(url: string): string {
  const host = hostOf(url);
  for (const [domain, name] of Object.entries(LABELS)) {
    if (host === domain || host.endsWith(`.${domain}`)) return name;
  }
  const label = host.split('.').slice(-2, -1)[0] || host;
  if (!label) return 'Store';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function skipUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host || NOT_A_SHOP.test(host)) return true;
  return /\/(?:news|articles?|blog)\//i.test(url);
}

function unwrapDdg(href: string): string {
  const raw = decode(href);
  const packed = raw.match(/[?&]uddg=([^&]+)/);
  const url = packed ? decodeURIComponent(packed[1]) : (raw.startsWith('http') ? raw : '');
  if (!url.startsWith('http') || url.includes('duckduckgo.com')) return '';
  return url;
}

export interface WebLead {
  title: string;
  url: string;
  price: number;
}

export function parseWebLeads(html: string): WebLead[] {
  const leads: WebLead[] = [];
  const pattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const url = unwrapDdg(match[1]);
    if (!url || skipUrl(url)) continue;
    const title = decode(match[2].replace(/<[^>]+>/g, ' '));
    const around = html.slice(match.index || 0, (match.index || 0) + match[0].length + 600);
    const price = rupees((around.match(/(?:₹|Rs\.?|INR)\s*([\d,]{2,})/i) || [])[1] || '');
    leads.push({ title, url, price });
    if (leads.length === 12) break;
  }
  return leads;
}

export function parsePagePrice(html: string, query: string, pageUrl: string): PriceOffer | null {
  const title = decode(
    (html.match(/property="og:title"[^>]*content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i) || [])[1] || ''
  );
  if (!offerMatches(title, query)) return null;
  const tagged = html.match(/"priceCurrency"\s*:\s*"INR"[\s\S]{0,120}?"price"\s*:\s*"?(\d[\d.]*)"?/i)
    || html.match(/"price"\s*:\s*"?(\d[\d.]*)"?[\s\S]{0,120}?"priceCurrency"\s*:\s*"INR"/i);
  const rupee = html.match(/₹\s*([\d,]{2,})/);
  const price = rupees(tagged?.[1] || rupee?.[1] || '');
  if (price < 20) return null;
  return { store: storeName(pageUrl), title: title.slice(0, 140), price, url: pageUrl };
}

async function readText(url: string, fetchImpl: typeof fetch, timeout: number): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': BROWSER, 'Accept-Language': 'en-IN,en;q=0.9' },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  if (!response.ok) return '';
  return response.text();
}

async function readStore(url: string, parse: (html: string, query: string) => PriceOffer | null, query: string, fetchImpl: typeof fetch): Promise<PriceOffer | null> {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': BROWSER, 'Accept-Language': 'en-IN,en;q=0.9' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });
  if (!response.ok) return null;
  return parse(await response.text(), query);
}

function lowestPerStore(offers: PriceOffer[]): PriceOffer[] {
  const byStore = new Map<string, PriceOffer>();
  for (const offer of offers) {
    const key = offer.store.toLowerCase();
    const previous = byStore.get(key);
    if (!previous || offer.price < previous.price) byStore.set(key, offer);
  }
  return [...byStore.values()].sort((a, b) => a.price - b.price).slice(0, 6);
}

export async function comparePrices(rawQuery: string, fetchImpl: typeof fetch = fetch): Promise<PriceOffer[]> {
  const query = cleanShoppingQuery(rawQuery);
  if (queryTokens(query).length === 0) return [];
  const encoded = encodeURIComponent(query);
  const webUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${query} price`)}`;
  const [storeSettled, webHtml] = await Promise.all([
    Promise.allSettled([
      readStore(`https://www.amazon.in/s?k=${encoded}`, parseAmazonSearch, query, fetchImpl),
      readStore(`https://www.flipkart.com/search?q=${encoded}`, parseFlipkartSearch, query, fetchImpl),
      readStore(`https://www.poorvika.com/s?q=${encoded.replace(/%20/g, '+')}`, parsePoorvikaSearch, query, fetchImpl),
      readStore(`https://www.aptronixindia.com/search?q=${encoded.replace(/%20/g, '+')}`, parseAptronixSearch, query, fetchImpl),
    ]),
    readText(webUrl, fetchImpl, 12000).catch(() => ''),
  ]);
  const direct = storeSettled
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((offer): offer is PriceOffer => !!offer);
  const covered = new Set(direct.map((offer) => hostOf(offer.url)));
  const discovered: PriceOffer[] = [];
  const follow: WebLead[] = [];
  for (const lead of parseWebLeads(webHtml)) {
    if (!offerMatches(lead.title, query)) continue;
    if (lead.price >= 20) {
      discovered.push({ store: storeName(lead.url), title: lead.title, price: lead.price, url: lead.url });
      continue;
    }
    if (!covered.has(hostOf(lead.url)) && follow.length < 4) follow.push(lead);
  }
  const pages = await Promise.allSettled(follow.map(async (lead) => {
    const html = await readText(lead.url, fetchImpl, 8000);
    return html ? parsePagePrice(html, query, lead.url) : null;
  }));
  const opened = pages
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((offer): offer is PriceOffer => !!offer);
  return lowestPerStore([...direct, ...discovered, ...opened]);
}
