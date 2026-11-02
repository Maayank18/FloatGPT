export type LiveHit = { source: string; title: string; url?: string };

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/json,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
};

export function cleanLiveQuery(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

function decode(value: string): string {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2).slice(0, 8);
}

export function wantsRates(query: string): boolean {
  return /\b(rate|rates|exchange|forex|rupee|inr|usd|dollar|euro|eur|pound|gbp)\b/i.test(query);
}

export function wantsTech(query: string): boolean {
  return /\b(ai|tech|startup|model|openai|gemini|gpu)\b/i.test(query);
}

export function wantsBroadNews(query: string): boolean {
  return /\b(latest|news|today|headline|affairs|happening|world)\b/i.test(query);
}

export function parseRss(xml: string, source: string, limit = 4): LiveHit[] {
  const hits: LiveHit[] = [];
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const item of items) {
    const title = decode((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    if (!title || title.length < 8) continue;
    const link = decode((item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || item.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || '');
    const from = decode((item.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || source);
    hits.push({ source: from || source, title: title.slice(0, 180), url: link.startsWith('http') ? link : undefined });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function parseDdg(html: string, limit = 5): LiveHit[] {
  const hits: LiveHit[] = [];
  const pattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(pattern)) {
    const packed = decode(match[1]).match(/[?&]uddg=([^&]+)/);
    const url = packed ? decodeURIComponent(packed[1]) : '';
    if (!url.startsWith('http') || url.includes('duckduckgo.com')) continue;
    const title = decode(match[2]).slice(0, 180);
    if (title.length < 8) continue;
    hits.push({ source: 'Web', title, url });
    if (hits.length >= limit) break;
  }
  return hits;
}

export function parseFrankfurter(json: string): LiveHit[] {
  try {
    const data = JSON.parse(json) as { base?: string; date?: string; rates?: Record<string, number> };
    const rates = data.rates || {};
    const lines = Object.entries(rates).slice(0, 6).map(([code, value]) => `${data.base || 'USD'} 1 = ${value} ${code}`);
    if (!lines.length) return [];
    return [{ source: 'Frankfurter', title: `${lines.join('; ')} (${data.date || 'latest'})` }];
  } catch {
    return [];
  }
}

export function parseHn(json: string, limit = 3): LiveHit[] {
  try {
    const data = JSON.parse(json) as { hits?: { title?: string; url?: string }[] };
    return (data.hits || []).slice(0, limit).flatMap((hit) => {
      const title = String(hit.title || '').trim();
      if (title.length < 8) return [];
      return [{ source: 'Hacker News', title: title.slice(0, 180), url: hit.url }];
    });
  } catch {
    return [];
  }
}

function keepRelevant(hits: LiveHit[], query: string, broad: boolean): LiveHit[] {
  const words = tokens(query);
  if (!words.length || broad) return hits;
  const matched = hits.filter((hit) => words.some((word) => hit.title.toLowerCase().includes(word)));
  return matched.length ? matched : hits.slice(0, 3);
}

export function formatLiveBrief(hits: LiveHit[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const hit of hits) {
    const key = hit.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${hit.source}: ${hit.title}${hit.url ? ` (${hit.url})` : ''}`);
    if (lines.length >= 8) break;
  }
  return lines.join('\n');
}

async function grab(url: string, ms = 7000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

type LiveKeys = { news?: string; gnews?: string };

function keysFromEnv(): LiveKeys {
  const env = typeof process !== 'undefined' ? process.env : undefined;
  return {
    news: env?.NEWS_API_KEY || '',
    gnews: env?.GNEWS_API_KEY || '',
  };
}

/** Public feeds first. A news key already on this machine is used when it is set. */
export async function collectLive(raw: string, keys: LiveKeys = keysFromEnv()): Promise<string> {
  const query = cleanLiveQuery(raw);
  if (!query) return '';
  const broad = wantsBroadNews(query);
  const jobs: Promise<LiveHit[]>[] = [
    grab(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`)
      .then((xml) => parseRss(xml, 'Google News', 5)),
    grab(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
      .then((html) => parseDdg(html, 4)),
  ];
  if (broad) {
    jobs.push(grab('https://feeds.bbci.co.uk/news/world/rss.xml').then((xml) => parseRss(xml, 'BBC', 3)));
  }
  if (wantsTech(query) || broad) {
    jobs.push(grab(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story`)
      .then((json) => parseHn(json, 3)));
  }
  if (wantsRates(query)) {
    jobs.push(grab('https://api.frankfurter.app/latest?from=USD&to=INR,EUR,GBP')
      .then((json) => parseFrankfurter(json)));
  }
  if (keys.news) {
    jobs.push(grab(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=3&sortBy=publishedAt&apiKey=${encodeURIComponent(keys.news)}`)
      .then((json) => {
        try {
          const data = JSON.parse(json) as { articles?: { title?: string; url?: string; source?: { name?: string } }[] };
          return (data.articles || []).flatMap((article) => {
            const title = String(article.title || '').trim();
            if (title.length < 8) return [];
            return [{ source: article.source?.name || 'News', title: title.slice(0, 180), url: article.url }];
          });
        } catch {
          return [];
        }
      }));
  }
  if (keys.gnews) {
    jobs.push(grab(`https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&max=3&lang=en&apikey=${encodeURIComponent(keys.gnews)}`)
      .then((json) => {
        try {
          const data = JSON.parse(json) as { articles?: { title?: string; url?: string; source?: { name?: string } }[] };
          return (data.articles || []).flatMap((article) => {
            const title = String(article.title || '').trim();
            if (title.length < 8) return [];
            return [{ source: article.source?.name || 'GNews', title: title.slice(0, 180), url: article.url }];
          });
        } catch {
          return [];
        }
      }));
  }

  const settled = await Promise.allSettled(jobs);
  const hits = settled.flatMap((item) => item.status === 'fulfilled' ? item.value : []);
  const rates = wantsRates(query);
  const ordered = rates
    ? [...hits.filter((hit) => hit.source === 'Frankfurter'), ...hits.filter((hit) => hit.source !== 'Frankfurter')]
    : hits;
  return formatLiveBrief(keepRelevant(ordered, query, broad || rates));
}
