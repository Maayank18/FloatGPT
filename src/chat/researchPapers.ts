export interface PaperHit {
  title: string;
  authors: string;
  year: string;
  url: string;
  line: string;
}

const ARXIV_ABS = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/i;

export function cleanResearchTopic(raw: string): string {
  return String(raw || '')
    .replace(/^(?:on|about|for)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseArxivAtom(xml: string): PaperHit[] {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/g) || [];
  const papers: PaperHit[] = [];
  for (const entry of entries) {
    const id = decodeXml((entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || '');
    const abs = id.match(ARXIV_ABS);
    if (!abs) continue;
    const url = `https://arxiv.org/abs/${abs[1]}`;
    const title = decodeXml((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    if (!title) continue;
    const names = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      .map((match) => decodeXml(match[1]))
      .filter(Boolean);
    const authors = names.length > 3 ? `${names.slice(0, 3).join(', ')}, et al.` : names.join(', ');
    const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1] || '';
    const year = (published.match(/\d{4}/) || [''])[0];
    const summary = decodeXml((entry.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || '');
    const line = summary.split(/(?<=\.)\s/)[0]?.slice(0, 220) || '';
    papers.push({ title, authors, year, url, line });
    if (papers.length === 4) break;
  }
  return papers;
}

export function formatResearch(topic: string, papers: PaperHit[]): string {
  if (!papers.length) {
    return `No arXiv papers matched “${topic}”. Try a shorter or more specific topic.`;
  }
  const items = papers.map((paper) => {
    const who = [paper.authors, paper.year].filter(Boolean).join(', ');
    const cite = who ? `${who}. ` : '';
    const about = paper.line ? `\n  ${paper.line}` : '';
    return `- **${paper.title}** — ${cite}${paper.url}${about}`;
  });
  return `Papers on ${topic}. Each title and link is from arXiv.\n\n${items.join('\n\n')}`;
}

export function arxivSearchUrl(topic: string, phrase: boolean): string {
  const clean = topic.replace(/[^\p{L}\p{N}\s.+-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const query = phrase
    ? `all:"${clean}"`
    : clean.split(' ').filter(Boolean).map((word) => `all:${word}`).join(' AND ');
  return `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=4&sortBy=relevance`;
}

export async function searchArxiv(topic: string, fetchImpl: typeof fetch = fetch): Promise<PaperHit[]> {
  const clean = cleanResearchTopic(topic);
  if (!clean) return [];
  const headers = { 'User-Agent': 'FloatGPT/2.3.0 (research)' };
  const load = async (phrase: boolean) => {
    const response = await fetchImpl(arxivSearchUrl(clean, phrase), {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`arxiv ${response.status}`);
    return parseArxivAtom(await response.text());
  };
  const phraseHits = await load(true);
  if (phraseHits.length > 0 || !clean.includes(' ')) return phraseHits;
  return load(false);
}

export async function lookupResearch(topic: string): Promise<string> {
  const clean = cleanResearchTopic(topic);
  if (!clean) return 'Add a topic after /research. Example: `/research AI assistant`';
  try {
    if (typeof window !== 'undefined') {
      const response = await fetch(`/api/research?q=${encodeURIComponent(clean)}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return 'I could not reach the paper index just now. Try /research again in a moment.';
      const body = await response.json();
      const papers = Array.isArray(body?.papers) ? body.papers as PaperHit[] : [];
      return formatResearch(clean, papers.filter((paper) => paper?.title && ARXIV_ABS.test(paper.url || '')));
    }
    return formatResearch(clean, await searchArxiv(clean));
  } catch {
    return 'I could not reach the paper index just now. Try /research again in a moment.';
  }
}
