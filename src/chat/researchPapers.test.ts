import assert from 'node:assert/strict';
import { cleanResearchTopic, formatResearch, parseArxivAtom } from './researchPapers';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed>
  <entry>
    <id>http://arxiv.org/abs/2006.15120v1</id>
    <published>2020-06-26T17:58:12Z</published>
    <title>Hurricane genesis is favorable on terrestrial exoplanets
orbiting late-type M dwarf stars</title>
    <summary>Hurricanes are one of the most extreme storm systems that occur on Earth. The rest is longer.</summary>
    <author><name>Thaddeus D. Komacek</name></author>
    <author><name>Daniel R. Chavas</name></author>
    <author><name>Dorian S. Abbot</name></author>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/1712.06820v2</id>
    <published>2017-12-19T00:00:00Z</published>
    <title>A Survey on Dialogue Systems: Recent Advances and New Frontiers</title>
    <summary>Reviews conversational agents.</summary>
    <author><name>Zhou, L.</name></author>
  </entry>
</feed>`;

const papers = parseArxivAtom(xml);
assert.equal(papers.length, 2);
assert.equal(papers[0].url, 'https://arxiv.org/abs/2006.15120');
assert.match(papers[0].title, /Hurricane genesis/);
assert.equal(papers[0].year, '2020');
assert.match(papers[0].authors, /Komacek/);
assert.equal(papers[1].url, 'https://arxiv.org/abs/1712.06820');
assert.match(papers[1].title, /Dialogue Systems/);

const reply = formatResearch('AI assistant', papers);
assert.match(reply, /Hurricane genesis[\s\S]*https:\/\/arxiv.org\/abs\/2006\.15120/);
assert.match(reply, /Dialogue Systems[\s\S]*https:\/\/arxiv.org\/abs\/1712\.06820/);
assert.equal(reply.includes('Dialogue Systems') && reply.includes('2006.15120') && reply.indexOf('Dialogue Systems') < reply.indexOf('2006.15120'), false);

assert.equal(cleanResearchTopic('on AI assistant'), 'AI assistant');
assert.equal(formatResearch('AI assistant', []), 'No arXiv papers matched “AI assistant”. Try a shorter or more specific topic.');

console.log('research paper checks passed');
