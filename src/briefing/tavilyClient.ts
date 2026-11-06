import { BriefSource, TavilySearchOptions } from './types';

function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'source';
  }
}

export function isNoiseDomain(urlOrDomain: string): boolean {
  if (!urlOrDomain) return false;
  const lower = urlOrDomain.toLowerCase();
  const noisePatterns = [
    'instagram.com',
    'facebook.com',
    'tiktok.com',
    'pinterest.com',
    'threads.net',
    'snapchat.com',
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'dailymotion.com',
    'twitter.com',
    'x.com',
    't.co',
    'linktr.ee',
  ];
  return noisePatterns.some((pattern) => lower.includes(pattern));
}

export function cleanTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/(?:Document:\s*)?EX-[0-9.]+\s*\d*\s*[a-z0-9_-]*exhibit[0-9a-z.]*\s*(?:EX-[0-9.]+\s*)?(?:Document\s+Exhibit\s+[0-9.]+\s*)?/gi, '')
    .replace(/^[0-9a-z_-]+\.(?:htm|html|pdf)\s*/i, '')
    .replace(/\b(?:Skip to content|Home|Blog|Log In|Sign Up|Hire an AI employee|Super-Agents|Photos and videos|Watch video|Reels|Posts)\b/gi, '')
    .replace(/â€¢/g, '')
    .replace(/^[•·\-\*\s]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanSnippet(text?: string): string {
  if (!text) return '';
  return text
    .replace(/â€¢/g, '')
    .replace(/^[•·\-\*\s]+/, '')
    .replace(/#\s*[A-Za-z0-9_-]*\s*ID:\s*\S+/gi, '')
    .replace(/(?:VIEW DETAILS\s*>\s*)+/gi, '')
    .replace(/(?:Official\s+[A-Za-z]+\s+Blog\s*)+/gi, '')
    .replace(/(?:Legal name|Headquarters|Website|LinkedIn):\s*[^•\n\r]+?(?=(?:Legal name|Headquarters|Website|LinkedIn|VIEW DETAILS|Official|[A-Z][a-z]+\s+(?:announces|unveils|launches|reports|introduces|appoints)|•|$|\n|\r))/gi, '')
    .replace(/(?:Document:\s*)?EX-[0-9.]+\s*\d*\s*[a-z0-9_-]*exhibit[0-9a-z.]*\s*(?:EX-[0-9.]+\s*)?(?:Document\s+Exhibit\s+[0-9.]+\s*)?/gi, '')
    .replace(/(?:Skip to content|Log\s*in\s*Sign\s*up|Sign\s*up\s*Log\s*in|Hire an AI employee|Super-Agents|Agent-to-AgentBenchmarksPricingBlog|Guides \d+|Terms of Service|Privacy Policy|Cookie Policy|All rights reserved)/gi, '')
    .replace(/(?:[A-Z\s]{3,30},\s*[A-Za-z]{2,15}\.?\s*–\s*(?:[A-Za-z]+\s*\d{1,2},\s*\d{4}\s*–\s*)?)/g, '')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
    .replace(/\b\d+[kKmM]?\+?\s*(?:followers|connections|likes|views|subscribers|@\w+)\b/gi, '')
    .replace(/\|\s*\d+[kKmM]?\s*@?[A-Za-z0-9_]+\s*\|?/gi, '')
    .replace(/#\w+/g, '')
    .replace(/\b(?:watch\s+video|reels?|subscribe|photos\s+and\s+videos)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function cleanPersonSnippet(text?: string): string {
  if (!text) return '';
  let res = cleanSnippet(text);
  res = res
    .replace(/#+\s*[A-Za-z0-9_]+/g, '')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '')
    .replace(/\b\d+[kKmM]?\+?\s*(?:followers|connections|@\w+)\b/gi, '')
    .replace(/\|\s*\d+[kKmM]?\s*@?[A-Za-z0-9_]+\s*\|?/gi, '')
    .replace(/\b(?:Headline|Current role|Seniority|Experience|Connections|Followers):\s*/gi, '')
    .replace(/\|\s*\|/g, '|')
    .replace(/[|•·-]\s*[|•·-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  res = res.replace(/^[#\sA-Za-z]+?(?=(?:Software|Engineer|Senior|Lead|Executive|Head|Director|Product|Developer|Manager|Founder|CEO|CTO|VP|Ex-))/i, '');
  return res.replace(/^[|•·\s-]+|[|•·\s-]+$/g, '').trim();
}

export function detectCategory(
  title?: string,
  snippet?: string,
  hintKind?: 'launch' | 'hire' | 'update' | 'person'
): 'launch' | 'hire' | 'update' | 'person' {
  if (hintKind === 'person') return 'person';
  const text = `${title || ''} ${snippet || ''}`.toLowerCase();
  
  if (/\b(hire|hired|appoint|appointed|appointment|joins|joined|named|director|vp|vice president|chief|ceo|cto|cfo|coo|leadership|executive|promoted)\b/i.test(text)) {
    return 'hire';
  }
  if (/\b(launch|launched|launches|releasing|release|released|releases|unveil|unveils|unveiled|v\d+(\.\d+)?|version|beta|api|sdk|platform|tool|app|feature|solution)\b/i.test(text)) {
    return 'launch';
  }
  return 'update';
}

export async function queryTavily(opts: TavilySearchOptions): Promise<{ answer?: string; sources: BriefSource[] }> {
  const { apiKey, query, searchDepth = 'advanced', topic = 'news', timeRange = 'month', maxResults = 5 } = opts;
  if (!apiKey) {
    throw new Error('Tavily API key is missing. Add VITE_TAVILY_API_KEY in .env or enter it in PreBrief.');
  }

  const payload: any = {
    api_key: apiKey,
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: true,
  };

  if (topic) {
    payload.topic = topic;
  }
  if (timeRange && timeRange !== 'none') {
    payload.time_range = timeRange;
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Tavily API key. Please check your key in PreBrief settings or .env.');
    }
    if (response.status === 429) {
      throw new Error('Tavily rate limit or credit limit reached. Please check your Tavily dashboard.');
    }
    throw new Error(`Tavily search failed (HTTP ${response.status}): ${errorText.slice(0, 150)}`);
  }

  const data = await response.json();
  const rawResults: any[] = Array.isArray(data.results) ? data.results : [];

  const sources: BriefSource[] = rawResults
    .filter((r) => {
      const url = String(r.url || '');
      const domain = extractDomain(url).toLowerCase();
      if (url.includes('tavily.com/knowledge') || domain.includes('tavily.com')) return false;
      if (isNoiseDomain(url) || isNoiseDomain(domain)) return false;
      return true;
    })
    .map((r) => ({
      title: cleanTitle(String(r.title || extractDomain(r.url))),
      url: String(r.url || '#'),
      domain: extractDomain(r.url),
      snippet: cleanSnippet(String(r.content || '')),
      publishedDate: r.published_date ? String(r.published_date) : undefined,
    }));

  return {
    answer: data.answer ? cleanSnippet(String(data.answer)) : undefined,
    sources,
  };
}

export async function conductPreBriefResearch(params: {
  apiKey: string;
  company: string;
  person?: string;
  meetingTrack?: string;
  customTrack?: string;
}): Promise<{
  sources: BriefSource[];
  companySources: BriefSource[];
  personSources: BriefSource[];
  answerNotes: string[];
}> {
  const { apiKey, company, person, meetingTrack, customTrack } = params;

  type QueryKind = 'launch' | 'hire' | 'update' | 'person';
  const promises: Promise<{ answer?: string; sources: BriefSource[]; kind: QueryKind }>[] = [];

  // 1. Launches & Major Product Announcements (Preceding 30 Days)
  const launchQuery = `${company} product launch release feature announcement last 30 days`;
  promises.push(
    queryTavily({
      apiKey,
      query: launchQuery,
      topic: 'news',
      timeRange: 'month',
      maxResults: 4,
    }).then((res) => ({ ...res, kind: 'launch' as const }))
  );

  // 2. Executive Hires & Key Appointments (Preceding 30 Days)
  const hireQuery = `${company} executive hire appointment leadership VP director joined last 30 days`;
  promises.push(
    queryTavily({
      apiKey,
      query: hireQuery,
      topic: 'news',
      timeRange: 'month',
      maxResults: 3,
    }).then((res) => ({ ...res, kind: 'hire' as const }))
  );

  // 3. Business Moves, Deals & Funding (Preceding 30 Days)
  const businessQuery = `${company} funding partnership acquisition strategic business news last 30 days`;
  promises.push(
    queryTavily({
      apiKey,
      query: businessQuery,
      topic: 'news',
      timeRange: 'month',
      maxResults: 3,
    }).then((res) => ({ ...res, kind: 'update' as const }))
  );

  // 4. Person Background & Career Profile (General Web Search, NOT restricted to 30-day news!)
  if (person && person.trim()) {
    const cleanPerson = person.trim();
    const personQuery1 = `"${cleanPerson}" ${company} linkedin background role career bio`;
    promises.push(
      queryTavily({
        apiKey,
        query: personQuery1,
        topic: 'general',
        timeRange: 'none',
        maxResults: 4,
      }).then((res) => ({ ...res, kind: 'person' as const }))
    );

    const trackContext = customTrack || meetingTrack || 'meeting';
    const personQuery2 = `"${cleanPerson}" ${company} ${trackContext} interview talk quote work`;
    promises.push(
      queryTavily({
        apiKey,
        query: personQuery2,
        topic: 'general',
        timeRange: 'none',
        maxResults: 3,
      }).then((res) => ({ ...res, kind: 'person' as const }))
    );
  }

  const settled = await Promise.allSettled(promises);
  const seenUrls = new Set<string>();
  const companySources: BriefSource[] = [];
  const personSources: BriefSource[] = [];
  const answerNotes: string[] = [];

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      const { answer, sources, kind } = res.value;
      if (answer && !answerNotes.includes(answer)) {
        answerNotes.push(answer);
      }
      for (const s of sources) {
        if (s.url && !seenUrls.has(s.url)) {
          seenUrls.add(s.url);
          const resolvedCategory = detectCategory(s.title, s.snippet, kind);
          const categorizedSource: BriefSource = {
            ...s,
            category: resolvedCategory,
            snippet: kind === 'person' ? cleanPersonSnippet(s.snippet) : cleanSnippet(s.snippet),
          };
          if (kind === 'person') {
            personSources.push(categorizedSource);
          } else {
            companySources.push(categorizedSource);
          }
        }
      }
    } else {
      console.warn('[PreBrief] Sub-query warning:', res.reason?.message || res.reason);
    }
  }

  const combinedSources = [...personSources, ...companySources].slice(0, 10);

  if (combinedSources.length === 0 && settled.some((r) => r.status === 'rejected')) {
    const firstError = (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
    throw new Error(firstError?.message || 'Failed to retrieve research from Tavily.');
  }

  return {
    sources: combinedSources,
    companySources: companySources.slice(0, 7),
    personSources: personSources.slice(0, 4),
    answerNotes,
  };
}
