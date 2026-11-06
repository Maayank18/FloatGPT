import assert from 'node:assert';
import { formatSourcesMarkdown, synthesizePreBrief } from '../preBriefSynthesizer';
import { cleanSnippet, cleanTitle } from '../tavilyClient';
import { BriefSource, PreBriefItem } from '../types';
import { generatePreBriefPdf } from '../preBriefPdfGenerator';

console.log('--- Testing PreBrief Synthesis & Formatting ---');

// 1. Sources markdown formatting
const testSources: BriefSource[] = [
  {
    title: 'Stripe Launches Agent Toolkit',
    url: 'https://techcrunch.com/2026/10/stripe-agents',
    domain: 'techcrunch.com',
    snippet: 'Stripe announced new developer APIs for autonomous billing agents.',
    publishedDate: '2026-10-18',
  },
  {
    title: 'Stripe Expands EU Pay by Bank',
    url: 'https://reuters.com/2026/10/stripe-eu',
    domain: 'reuters.com',
    snippet: 'Direct bank payments expanded across 12 European countries.',
    publishedDate: '2026-10-22',
  },
];

const md = formatSourcesMarkdown(testSources);
assert(md.includes('techcrunch.com'), 'Markdown should format domain');
assert(md.includes('https://techcrunch.com/2026/10/stripe-agents'), 'Markdown should include full URL');
assert(md.includes('reuters.com'), 'Markdown should include second source');
console.log('✅ PASS: Sources markdown formatting passed');

const emptyMd = formatSourcesMarkdown([]);
assert(emptyMd.includes('No external sources'), 'Empty sources should return graceful note');
console.log('✅ PASS: Empty sources graceful fallback passed');

// 2. cleanSnippet crawler cleanup
const noisySnippet = '• microsoft: # Microsoft ID: zjGHmpGgUF8p Website: www.microsoft.com Legal name: Microsoft Corporation Headquarters: Redmond VIEW DETAILS > Official Microsoft Blog Microsoft announces Maia 300 chip';
const cleaned = cleanSnippet(noisySnippet);
assert(!cleaned.includes('zjGHmpGgUF8p'), 'Should remove company ID crawler artifacts');
assert(!cleaned.includes('VIEW DETAILS >'), 'Should strip VIEW DETAILS boilerplate');
assert(!cleaned.includes('Official Microsoft Blog'), 'Should strip blog title repeating artifacts');
assert(cleaned.includes('Maia 300 chip'), 'Should preserve real content');
console.log('✅ PASS: cleanSnippet crawler artifact filtering passed');

// 3. Person intelligence in fallback synthesis
async function testPersonSynthesis() {
  const personSources: BriefSource[] = [
    {
      title: 'Kushal Vijay - Ex-Microsoft SDE, Educator',
      url: 'https://linkedin.com/in/kushalvijay',
      domain: 'linkedin.com',
      snippet: 'Software engineer and tech career mentor with experience leading engineering interviews and data structures.',
    },
  ];

  const brief = await synthesizePreBrief({
    company: 'Microsoft',
    person: 'Kushal Vijay',
    meetingTrack: 'Custom Track / Need...',
    customNeed: 'SDE-2 DSA & System Design Interview',
    sources: personSources,
    personSources,
  });

  assert(brief.includes('Kushal Vijay Profile'), 'Brief must include dedicated Person Profile section');
  assert(brief.includes('SDE-2 DSA & System Design Interview'), 'Brief must anchor to custom need');
  assert(brief.includes('linkedin.com'), 'Brief must link person source domain');
  console.log('✅ PASS: Person profile & custom need synthesis passed');
}

// 4. 30-Day Radar categorization tags
async function testRadarCategorization() {
  const companySources: BriefSource[] = [
    {
      title: 'Google launches Gemini 2.0 Flash',
      url: 'https://blog.google/technology/ai/gemini-2/',
      domain: 'blog.google',
      snippet: 'Google announced Gemini 2.0 Flash with real-time streaming multimodal capabilities.',
      category: 'launch',
    },
    {
      title: 'Google hires ex-OpenAI researcher as VP',
      url: 'https://reuters.com/technology/google-hires-vp',
      domain: 'reuters.com',
      snippet: 'Key executive appointment to lead agentic foundation models.',
      category: 'hire',
    },
  ];

  const brief = await synthesizePreBrief({
    company: 'Google',
    meetingTrack: 'Partnership',
    meetingTime: 'Today at 4:00 PM',
    sources: companySources,
    companySources,
  });

  assert(brief.includes('[Product Launch]'), 'Must tag launch items with [Product Launch]');
  assert(brief.includes('[Executive Hire]'), 'Must tag hire items with [Executive Hire]');
  assert(brief.includes('blog.google'), 'Must cite trustworthy domain blog.google');
  console.log('✅ PASS: 30-Day Radar categorization tags passed');
}

// 5. Executive PDF Generation & Block Division
function testPdfGeneration() {
  const item: PreBriefItem = {
    id: 'test_brief_123',
    company: 'Stripe',
    person: 'Patrick Collison',
    meetingTrack: 'Partnership',
    customTrack: 'Agentic Checkout Integration',
    meetingTime: 'Tomorrow at 10:00 AM',
    createdAt: Date.now(),
    summary: `## 1. 30-Second Executive Snapshot
- **Company Context**: Stripe powers internet commerce with high-velocity API infrastructure.
- **Patrick Collison Profile**: Co-founder & CEO driving long-term strategic architectural bets.
- **Meeting Objective**: Agentic Checkout Integration (Tomorrow at 10:00 AM).

## 2. Last 30 Days Radar (News, Launches, Hires & Updates)
• **[Product Launch] Agentic Commerce Toolkit**: Launched developer SDK for automated agent billing ([stripe.com](https://stripe.com)).
• **[Executive Hire] VP of Global Banking**: Appointed former central banker to oversee settlement network ([reuters.com](https://reuters.com)).

## 3. Strategic Meeting Angles
- Align protocol primitives with Stripe's new agentic checkout roadmap.
- Guarantee sub-second settlement SLA for agent-initiated transactions.

## 4. Top 3 High-Impact Discussion Questions
1. How does Stripe plan to handle fraud liability for non-human agent authorizations?
2. What is the SLA guarantee for real-time wallet settlement?
3. What would define a 100% win for this pilot by Q1?`,
    sources: [
      {
        title: 'Stripe Agentic Toolkit',
        url: 'https://stripe.com/news/agents',
        domain: 'stripe.com',
        category: 'launch',
      },
    ],
    status: 'ready',
  };

  const { blob, filename } = generatePreBriefPdf(item);
  assert(blob instanceof Blob, 'PDF result must return binary Blob');
  assert(blob.size > 500, 'PDF size must be greater than 500 bytes');
  assert.equal(blob.type, 'application/pdf', 'Blob type must be application/pdf');
  assert.equal(filename, 'Stripe_PreBrief_Dossier.pdf', 'Filename must match standard schema');
  console.log(`✅ PASS: Executive PDF Generation verified (${blob.size} bytes, ${filename})`);
}

testPersonSynthesis()
  .then(() => testRadarCategorization())
  .then(() => testPdfGeneration())
  .then(() => {
    console.log('PreBrief unit tests completed successfully.');
  });
