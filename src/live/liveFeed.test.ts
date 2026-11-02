import assert from 'node:assert/strict';
import { formatLiveBrief, parseDdg, parseFrankfurter, parseRss, wantsRates } from './liveFeed';

const rss = `<?xml version="1.0"?><rss><channel><item><title>AI lab ships a new model</title><link>https://example.com/ai</link><source>BBC</source></item></channel></rss>`;
assert.equal(parseRss(rss, 'BBC')[0].title, 'AI lab ships a new model');

const ddg = `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fstory">Markets open higher today</a>`;
assert.equal(parseDdg(ddg)[0].url, 'https://example.com/story');

const rates = parseFrankfurter('{"base":"USD","date":"2026-11-01","rates":{"INR":88.2,"EUR":0.92}}');
assert.ok(rates[0].title.includes('INR'));
assert.equal(wantsRates('rupee rate today'), true);
assert.equal(wantsRates('hackathon plan'), false);

const brief = formatLiveBrief([
  { source: 'BBC', title: 'AI lab ships a new model', url: 'https://example.com/ai' },
  { source: 'BBC', title: 'AI lab ships a new model' },
]);
assert.equal(brief.split('\n').length, 1);
assert.ok(brief.includes('BBC'));

console.log('live feed tests passed');
