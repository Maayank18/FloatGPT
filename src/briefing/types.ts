export interface BriefSource {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
  publishedDate?: string;
  category?: 'launch' | 'hire' | 'update' | 'person' | 'general';
}

export type MeetingTrack = 'Sales & Pitch' | 'Partnership' | 'Hiring & Interview' | 'Investor & Due Diligence' | 'General' | string;

export interface PreBriefItem {
  id: string;
  company: string;
  person?: string;
  meetingTrack: string;
  customTrack?: string;
  meetingTime?: string;
  createdAt: number;
  summary: string;
  sources: BriefSource[];
  status: 'ready' | 'loading' | 'error';
  error?: string;
}

export interface TavilySearchOptions {
  apiKey: string;
  query: string;
  searchDepth?: 'basic' | 'advanced';
  topic?: 'news' | 'general';
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'none';
  maxResults?: number;
}

