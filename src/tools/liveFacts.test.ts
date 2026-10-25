import assert from 'node:assert/strict';
import { answerLiveFact, detectLiveFact } from './liveFacts';

assert.deepEqual(detectLiveFact('please tell current rate of one dollar'), { kind: 'fx', amount: 1, from: 'USD', to: 'INR' });
assert.deepEqual(detectLiveFact('how much is 75,000 rupees in dollars'), { kind: 'fx', amount: 75000, from: 'INR', to: 'USD' });
assert.deepEqual(detectLiveFact('weather in New Delhi'), { kind: 'weather', place: 'new delhi' });
assert.deepEqual(detectLiveFact('what is the weather'), { kind: 'weather', place: '' });
assert.deepEqual(detectLiveFact('bitcoin price'), { kind: 'crypto', id: 'bitcoin', label: 'Bitcoin' });
assert.equal(detectLiveFact('what is bitcoin'), null);
assert.equal(detectLiveFact('open chrome'), null);
assert.equal(detectLiveFact('I paid 5 dollars for coffee'), null);
assert.deepEqual(detectLiveFact('apple stock price'), { kind: 'stock' });
assert.deepEqual(detectLiveFact('who sings Creep'), { kind: 'music', query: 'creep' });
assert.deepEqual(detectLiveFact('music by Radiohead'), { kind: 'music', query: 'radiohead' });
assert.equal(detectLiveFact('play music'), null);
assert.equal(detectLiveFact('pause the song'), null);
assert.equal(detectLiveFact('write me a song'), null);
assert.deepEqual(detectLiveFact('price of the game Elden Ring'), { kind: 'game', query: 'elden ring' });
assert.deepEqual(detectLiveFact('how much is the game Hades'), { kind: 'game', query: 'hades' });
assert.deepEqual(detectLiveFact('next holiday in India'), { kind: 'holiday', code: '', label: 'India' });
assert.deepEqual(detectLiveFact('next holiday in the US'), { kind: 'holiday', code: 'US', label: 'the United States' });
assert.equal(detectLiveFact('happy holidays'), null);
assert.deepEqual(detectLiveFact('any earthquakes today'), { kind: 'quake' });
assert.deepEqual(detectLiveFact('wikipedia Chandrayaan'), { kind: 'wiki', query: 'chandrayaan' });
assert.equal(detectLiveFact('Can you please open Wispr Flow Wikipedia if possible?'), null);
assert.equal(detectLiveFact('I was asking ki please open Wikipedia for me on the web.'), null);
assert.deepEqual(detectLiveFact('AQI in Delhi'), { kind: 'air', place: 'delhi' });
assert.deepEqual(detectLiveFact('where is the ISS'), { kind: 'iss' });
assert.deepEqual(detectLiveFact('last F1 result'), { kind: 'f1' });
assert.deepEqual(detectLiveFact('book titled Dune'), { kind: 'book', query: 'dune' });
assert.deepEqual(detectLiveFact('latest version of react on npm'), { kind: 'npm', name: 'react' });
assert.equal(detectLiveFact('npm install react'), null);

const weather = await answerLiveFact('weather in Delhi', async (url) => {
  const href = String(url);
  if (href.includes('geocoding-api')) {
    return new Response(JSON.stringify({
      results: [{ name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.65, longitude: 77.23 }],
    }));
  }
  return new Response(JSON.stringify({
    current: {
      time: '2026-10-02T14:15',
      temperature_2m: 35.1,
      apparent_temperature: 35.5,
      relative_humidity_2m: 31,
      weather_code: 0,
      wind_speed_10m: 11.5,
    },
  }));
});
assert.ok(weather?.message.includes('35.1°C'));
assert.ok(weather?.message.includes('Open-Meteo'));
assert.equal(weather?.message.includes('I think'), false);

const rate = await answerLiveFact('current rate of one dollar', async () => new Response(JSON.stringify({
  amount: 1,
  base: 'USD',
  date: '2026-10-01',
  rates: { INR: 96.33 },
})));
assert.ok(rate?.message.includes('96.33'));
assert.ok(rate?.message.includes('Frankfurter'));

const down = await answerLiveFact('ethereum price', async () => {
  throw new Error('offline');
});
assert.ok(down?.message.includes('will not guess'));

const song = await answerLiveFact('who sings Creep', async () => new Response(JSON.stringify({
  results: [{ trackName: 'Creep', artistName: 'Radiohead', collectionName: 'Pablo Honey', releaseDate: '1993-01-01' }],
})));
assert.ok(song?.message.includes('Creep'));
assert.ok(song?.message.includes('Radiohead'));
assert.ok(song?.message.includes('iTunes'));

const deal = await answerLiveFact('price of the game Elden Ring', async () => new Response(JSON.stringify([
  { external: 'ELDEN RING', cheapest: '52.89' },
])));
assert.ok(deal?.message.includes('52.89'));
assert.ok(deal?.message.includes('CheapShark'));

let holidayCalls = 0;
const india = await answerLiveFact('next holiday in India', async () => {
  holidayCalls += 1;
  return new Response('[]');
});
assert.equal(holidayCalls, 0);
assert.ok(india?.message.includes('India'));

const played = await answerLiveFact('play music', async () => {
  throw new Error('playback must not call a feed');
});
assert.equal(played, null);

console.log('live fact tests passed');
