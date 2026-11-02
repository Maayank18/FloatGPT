import assert from 'node:assert/strict';
import {
  findReferenceImage,
  isReferenceSubject,
  referenceMarkdown,
  selectNaturePhoto,
  selectReferenceImage,
  selectWikipediaImage,
  selectWikipediaTitle
} from './referenceImage';

assert.equal(isReferenceSubject('lord rama'), true);
assert.equal(isReferenceSubject('taj mahal'), true);
assert.equal(isReferenceSubject('a tiger'), true);
assert.equal(isReferenceSubject('albert einstein'), true);
assert.equal(isReferenceSubject('a house'), false);
assert.equal(isReferenceSubject('a red house on a quiet street'), false);
assert.equal(isReferenceSubject('a bird wearing a hat'), false);
assert.equal(isReferenceSubject('a woman'), false);
assert.equal(isReferenceSubject('a portrait of a woman in a red coat'), false);

const payload = {
  query: {
    pages: {
      a: {
        title: 'File:Bandarawela Murugan Kovil.jpg',
        index: 1,
        imageinfo: [{
          mime: 'image/jpeg',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/murugan.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Murugan.jpg',
          extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: 'A' } }
        }]
      },
      b: {
        title: 'File:Procession of Lord Rama 30.jpg',
        index: 2,
        imageinfo: [{
          mime: 'image/jpeg',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/procession.jpg?utm_source=commons',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Procession_of_Lord_Rama_30.jpg',
          extmetadata: {
            LicenseShortName: { value: 'CC BY-SA 4.0' },
            Artist: { value: '<a href="/wiki/User:Zahed.zk">Zahed.zk</a>' }
          }
        }]
      },
      c: {
        title: 'File:Rama painting.jpg',
        index: 3,
        imageinfo: [{
          mime: 'image/jpeg',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/rama.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Rama_painting.jpg',
          extmetadata: { LicenseShortName: { value: 'Public domain' }, Artist: { value: 'Unknown' } }
        }]
      },
      d: {
        title: 'File:Rama icon.svg',
        index: 0,
        imageinfo: [{
          mime: 'image/svg+xml',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/icon.png',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Rama_icon.svg'
        }]
      }
    }
  }
};

const hit = selectReferenceImage('lord rama', payload);
assert.ok(hit);
assert.equal(hit?.thumbUrl, 'https://upload.wikimedia.org/wikipedia/commons/thumb/rama.jpg');
assert.equal(hit?.license, 'Public domain');
assert.equal(selectReferenceImage('a house', payload), null);

const shinchan = {
  query: {
    pages: {
      train: {
        title: 'File:Tobu 51056 (Crayon Shinchan blue) Miyamaedaira Station 20170507.jpg',
        index: 1,
        imageinfo: [{
          mime: 'image/jpeg',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/train.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Train.jpg',
          extmetadata: { LicenseShortName: { value: 'CC BY 2.0' }, Artist: { value: 'yagi-s' } }
        }]
      },
      character: {
        title: 'File:Crayon Shin-chan.png',
        index: 4,
        imageinfo: [{
          mime: 'image/png',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/shinchan.png',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Crayon_Shin-chan.png',
          extmetadata: {
            LicenseShortName: { value: 'Public domain' },
            Artist: { value: 'Unknown' },
            Restrictions: { value: 'trademarked' }
          }
        }]
      }
    }
  }
};
const character = selectReferenceImage('shinchan', shinchan);
assert.equal(character?.thumbUrl, 'https://upload.wikimedia.org/wikipedia/commons/thumb/shinchan.png');
assert.equal(selectReferenceImage('shinchan', { query: { pages: { train: shinchan.query.pages.train } } }), null);
assert.equal(selectReferenceImage('pikachu', {
  query: {
    pages: {
      cake: {
        title: 'File:Eatable Pikachu.jpg',
        index: 1,
        imageinfo: [{
          mime: 'image/jpeg',
          thumbwidth: 960,
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/cake.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Eatable_Pikachu.jpg',
          extmetadata: { LicenseShortName: { value: 'CC BY 2.0' }, Artist: { value: 'A' } }
        }]
      }
    }
  }
}), null);

const wiki = selectWikipediaImage('lord rama', {
  query: {
    pages: {
      station: {
        title: 'Rama station',
        index: 1,
        pageimage: 'Station.jpg',
        fullurl: 'https://en.wikipedia.org/wiki/Rama_station',
        thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/station.jpg', width: 960 }
      },
      article: {
        title: 'Rama',
        index: 2,
        pageimage: 'Rama_in_Adhyatma_Ramayana.jpg',
        fullurl: 'https://en.wikipedia.org/wiki/Rama',
        thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/rama-wiki.jpg?utm=1', width: 960 }
      }
    }
  }
});
assert.equal(wiki?.fileName, 'Rama_in_Adhyatma_Ramayana.jpg');
assert.equal(wiki?.pageUrl, 'https://en.wikipedia.org/wiki/Rama');
assert.equal(wiki?.thumbUrl, 'https://upload.wikimedia.org/wikipedia/commons/thumb/rama-wiki.jpg');

const line = referenceMarkdown('lord rama', hit!);
assert.ok(line.startsWith('![lord rama](https://upload.wikimedia.org/'));
assert.match(line, /Wikimedia Commons/);
const wikiLine = referenceMarkdown('lord rama', {
  thumbUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/rama-wiki.jpg',
  pageUrl: 'https://en.wikipedia.org/wiki/Rama',
  artist: 'Unknown',
  license: 'Public domain',
  source: 'Wikipedia'
});
assert.match(wikiLine, /Source: \[Wikipedia\]\(https:\/\/en.wikipedia.org\/wiki\/Rama\)/);
assert.match(line, /Public domain/);
assert.equal(line.includes('pollinations'), false);

const commonsFile = (title: string) => ({
  title,
  index: 1,
  imageinfo: [{
    mime: 'image/jpeg',
    thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/x.jpg',
    thumbwidth: 960,
    descriptionurl: `https://commons.wikimedia.org/wiki/${title}`,
    extmetadata: { LicenseShortName: { value: 'CC BY 2.0' } }
  }]
});
for (const title of ['File:Pikachu_Pillows.jpg', 'File:Wearing_Pikachu_(31651470496).jpg', 'File:Doraemon_1979Logo.jpg']) {
  const subject = title.includes('Doraemon') ? 'doraemon' : 'pikachu';
  assert.equal(selectReferenceImage(subject, { query: { pages: { 1: commonsFile(title) } } }), null, title);
}

const taxon = (overrides: Record<string, any> = {}, photo: Record<string, any> = {}) => ({
  id: 41967,
  name: 'Panthera tigris',
  preferred_common_name: 'Tiger',
  rank: 'species',
  iconic_taxon_name: 'Mammalia',
  is_active: true,
  default_photo: {
    license_code: 'cc-by-nc',
    attribution: '(c) Jane Doe, some rights reserved (CC BY-NC)',
    medium_url: 'https://inaturalist-open-data.s3.amazonaws.com/photos/1/medium.jpg',
    original_dimensions: { width: 2048, height: 1365 },
    ...photo
  },
  ...overrides
});

const tiger = selectNaturePhoto('a tiger', {
  results: [taxon(), taxon({ id: 2, name: 'Esox masquinongy', preferred_common_name: 'Muskellunge', iconic_taxon_name: 'Actinopterygii' })]
});
assert.equal(tiger?.thumbUrl, 'https://inaturalist-open-data.s3.amazonaws.com/photos/1/large.jpg');
assert.equal(tiger?.pageUrl, 'https://www.inaturalist.org/taxa/41967');
assert.equal(tiger?.artist, 'Jane Doe');
assert.equal(tiger?.license, 'CC BY-NC');
assert.match(referenceMarkdown('a tiger', tiger!), /Source: \[iNaturalist\]\(https:\/\/www.inaturalist.org\/taxa\/41967\) · CC BY-NC · Jane Doe/);
assert.equal(selectNaturePhoto('panthera tigris', { results: [taxon()] })?.license, 'CC BY-NC');

// A loose name match goes to the encyclopedia instead.
assert.equal(selectNaturePhoto('peacock', {
  results: [
    taxon({ name: 'Aglais io', preferred_common_name: 'European Peacock Butterfly', iconic_taxon_name: 'Insecta' }),
    taxon({ name: 'Pavo cristatus', preferred_common_name: 'Indian Peafowl', iconic_taxon_name: 'Aves' })
  ]
}), null);
assert.equal(selectNaturePhoto('tiger', { results: [taxon({}, { license_code: null })] }), null);
assert.equal(selectNaturePhoto('tiger', { results: [taxon({}, { medium_url: 'https://example.com/photos/1/medium.jpg' })] }), null);
assert.equal(selectNaturePhoto('tiger', { results: [taxon({ rank: 'genus' })] }), null);
assert.equal(selectNaturePhoto('mango', {
  results: [taxon({ name: 'Mangifera indica', preferred_common_name: 'Mango', iconic_taxon_name: 'Plantae' })]
}), null);
assert.equal(selectNaturePhoto('human', {
  results: [taxon({ name: 'Homo sapiens', preferred_common_name: 'Human', iconic_taxon_name: 'Mammalia' })]
}), null);
assert.equal(selectNaturePhoto('tiger', null), null);
assert.equal(selectNaturePhoto('tiger', { results: 'nope' }), null);

const json = (body: any, ok = true) => ({ ok, json: async () => body }) as Response;
const seen: string[] = [];
const natureFirst = await findReferenceImage('bald eagle', (async (url: string) => {
  seen.push(String(url));
  return json({ results: [taxon({ id: 5305, name: 'Haliaeetus leucocephalus', preferred_common_name: 'Bald Eagle', iconic_taxon_name: 'Aves' })] });
}) as typeof fetch);
assert.equal(natureFirst?.source, 'iNaturalist');
assert.equal(seen.length, 1);
assert.ok(seen[0].startsWith('https://api.inaturalist.org/v1/taxa/autocomplete?'));

const fellBack: string[] = [];
const wikiAfterNature = await findReferenceImage('lord krishna', (async (url: string) => {
  fellBack.push(String(url));
  if (String(url).includes('inaturalist')) throw new Error('offline');
  return json(null, false);
}) as typeof fetch);
assert.equal(wikiAfterNature, null);
assert.ok(fellBack.some((url) => url.includes('en.wikipedia.org')));
assert.ok(fellBack.some((url) => url.includes('commons.wikimedia.org')));

// Wikipedia's own redirect decides the article, so "indian flag" opens Flag of India.
const flagPick = selectWikipediaTitle({
  query: {
    redirects: [{ from: 'Indian flag', to: 'Flag of India' }],
    pages: {
      '-1': { title: 'Indian Flag', missing: '' },
      14533: {
        title: 'Flag of India',
        index: 1,
        pageimage: 'Flag_of_India.svg',
        fullurl: 'https://en.wikipedia.org/wiki/Flag_of_India',
        thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/960px-Flag_of_India.svg.png', width: 960 }
      }
    }
  }
});
assert.equal(flagPick?.pageUrl, 'https://en.wikipedia.org/wiki/Flag_of_India');
assert.equal(selectWikipediaTitle({
  query: { pages: { 1: { title: 'Mercury', pageprops: { disambiguation: '' }, pageimage: 'x.jpg', fullurl: 'https://en.wikipedia.org/wiki/Mercury', thumbnail: { source: 'https://upload.wikimedia.org/x.jpg', width: 960 } } } }
}), null);
assert.equal(selectWikipediaTitle(null), null);

// Search hits still count when the title uses another form of the word.
assert.equal(selectWikipediaImage('indian flag', {
  query: { pages: { 1: { title: 'Flag of India', index: 1, pageimage: 'Flag_of_India.svg', fullurl: 'https://en.wikipedia.org/wiki/Flag_of_India', thumbnail: { source: 'https://upload.wikimedia.org/flag.png', width: 960 } } } }
})?.fileName, 'Flag_of_India.svg');

// A flag file is allowed when a flag was asked for, and skipped otherwise.
const svgFlag = (title: string) => ({
  ...commonsFile(title),
  imageinfo: [{ ...commonsFile(title).imageinfo[0], mime: 'image/svg+xml', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/flag.svg/960px-flag.svg.png' }]
});
assert.ok(selectReferenceImage('indian flag', { query: { pages: { 1: svgFlag('File:Flag of India.svg') } } }));
assert.equal(selectReferenceImage('india', { query: { pages: { 1: svgFlag('File:Flag of India.svg') } } }), null);

const wikiFetch = (fileMeta: Record<string, any>, calls: string[]) => (async (url: string) => {
  calls.push(String(url));
  if (String(url).includes('inaturalist')) return json({ results: [] });
  if (String(url).includes('titles=File')) {
    return json({ query: { pages: { 1: { title: 'File:Flag of India.svg', imageinfo: [{
      mime: 'image/svg+xml',
      thumburl: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/960px-Flag_of_India.svg.png',
      thumbwidth: 960,
      extmetadata: fileMeta
    }] } } } });
  }
  return json({ query: { pages: { 1: {
    title: 'Flag of India',
    pageimage: 'Flag_of_India.svg',
    fullurl: 'https://en.wikipedia.org/wiki/Flag_of_India',
    thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/41/Flag_of_India.svg/960px-Flag_of_India.svg.png', width: 960 }
  } } } });
}) as typeof fetch;

const flagCalls: string[] = [];
const flag = await findReferenceImage('indian flag', wikiFetch({ LicenseShortName: { value: 'PD-India' } }, flagCalls));
assert.equal(flag?.source, 'Wikipedia');
assert.equal(flag?.license, 'PD-India');
assert.ok(flagCalls.some((url) => url.includes('redirects=1')));
assert.ok(flagCalls.filter((url) => url.includes('wikipedia.org')).length === 2);
assert.equal(flagCalls.some((url) => url.includes('commons.wikimedia.org')), false);

const fairUse = await findReferenceImage('pikachu', wikiFetch({ LicenseShortName: { value: 'Fair use' }, NonFree: { value: 'true' } }, []));
assert.equal(fairUse, null);

// A busy Wikimedia is not remembered as "no picture", and the other Wikimedia lookups are skipped.
const busyCalls: string[] = [];
let busyNow = true;
const busyFetch = (async (url: string) => {
  busyCalls.push(String(url));
  if (String(url).includes('inaturalist')) return json({ results: [] });
  if (busyNow) return { ok: false, status: 429, json: async () => ({}) } as Response;
  return wikiFetch({ LicenseShortName: { value: 'PD' } }, [])(url);
}) as typeof fetch;
assert.equal(await findReferenceImage('flag of japan', busyFetch), null);
assert.equal(busyCalls.some((url) => url.includes('commons.wikimedia.org')), false);
busyNow = false;
assert.equal((await findReferenceImage('flag of japan', busyFetch))?.source, 'Wikipedia');

console.log('reference image tests passed');
