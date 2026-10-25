/**
 * Live facts that must not be guessed by the model.
 * A question hits the network only after a tight local match, and then only one feed.
 * Stocks stay refused until a market key exists. Playback commands are left to the media router.
 */

export type LiveAnswer = {
  message: string;
  actionExecuted: string;
};

type LiveFact =
  | { kind: 'weather'; place: string }
  | { kind: 'fx'; amount: number; from: string; to: string }
  | { kind: 'crypto'; id: string; label: string }
  | { kind: 'stock' }
  | { kind: 'music'; query: string }
  | { kind: 'game'; query: string }
  | { kind: 'holiday'; code: string; label: string }
  | { kind: 'quake' }
  | { kind: 'wiki'; query: string }
  | { kind: 'air'; place: string }
  | { kind: 'iss' }
  | { kind: 'f1' }
  | { kind: 'book'; query: string }
  | { kind: 'npm'; name: string }
  | { kind: 'pypi'; name: string };

const TIMEOUT_MS = 8000;
const cache = new Map<string, { at: number; message: string }>();

const CURRENCY: Array<[RegExp, string]> = [
  [/\b(usd|dollars?|bucks)\b/g, 'USD'],
  [/\b(inr|rupees?|rs)\b/g, 'INR'],
  [/\b(eur|euros?)\b/g, 'EUR'],
  [/\b(gbp|pounds?|sterling)\b/g, 'GBP'],
  [/\b(jpy|yen)\b/g, 'JPY'],
  [/\b(aed|dirhams?)\b/g, 'AED'],
  [/\b(sgd)\b/g, 'SGD'],
  [/\b(cad)\b/g, 'CAD'],
  [/\b(aud)\b/g, 'AUD'],
];

const COINS: Array<[RegExp, string, string]> = [
  [/\b(bitcoin|btc)\b/, 'bitcoin', 'Bitcoin'],
  [/\b(ethereum|eth)\b/, 'ethereum', 'Ethereum'],
  [/\b(solana|sol)\b/, 'solana', 'Solana'],
  [/\b(dogecoin|doge)\b/, 'dogecoin', 'Dogecoin'],
  [/\b(ripple|xrp)\b/, 'ripple', 'XRP'],
];

const HOLIDAYS: Array<[RegExp, string, string]> = [
  [/\b(india|bharat)\b/, '', 'India'],
  [/\b(?:in|for|of)\s+(?:the\s+)?(?:united states|usa|u\.s\.?|america|us)\b|\b(?:us|usa|american)\s+holidays?\b/, 'US', 'the United States'],
  [/\b(?:in|for|of)\s+(?:the\s+)?(?:united kingdom|britain|england|scotland|wales|uk)\b|\b(?:uk|british)\s+holidays?\b/, 'GB', 'the United Kingdom'],
  [/\bgermany\b/, 'DE', 'Germany'],
  [/\bfrance\b/, 'FR', 'France'],
  [/\bcanada\b/, 'CA', 'Canada'],
  [/\baustralia\b/, 'AU', 'Australia'],
  [/\bjapan\b/, 'JP', 'Japan'],
  [/\bitaly\b/, 'IT', 'Italy'],
  [/\bspain\b/, 'ES', 'Spain'],
  [/\bbrazil\b/, 'BR', 'Brazil'],
  [/\bmexico\b/, 'MX', 'Mexico'],
  [/\b(netherlands|holland)\b/, 'NL', 'the Netherlands'],
  [/\bsingapore\b/, 'SG', 'Singapore'],
  [/\b(south korea|korea)\b/, 'KR', 'South Korea'],
  [/\bchina\b/, 'CN', 'China'],
];

const WEATHER_LABEL: Record<number, string> = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm',
  99: 'Thunderstorm',
};

function normalize(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[₹]/g, ' inr ')
    .replace(/\$/g, ' usd ')
    .replace(/^(can you|could you|would you|please|just|kindly|tell me|hey|hi|hello)\s+/i, '')
    .replace(/^(please|tell me|tell)\s+/i, '')
    .replace(/\s+(please|thanks|thank you)\b/gi, '')
    .replace(/[?!.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mentionsRate(text: string): boolean {
  return /\b(rate|price|cost|worth|convert|kitna|kitne|exchange)\b/.test(text);
}

function cleanQuery(value: string): string {
  return value
    .replace(/\b(right now|currently|today|please|on itunes|on apple music|on steam)\b/g, '')
    .replace(/^(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPlayback(text: string): boolean {
  if (/^(play|pause|resume|unpause|stop|mute)\b/.test(text)) return true;
  return /\b(play|pause|resume|unpause|mute|volume)\b/.test(text)
    && /\b(music|song|track|video|playback)\b/.test(text)
    && !/\b(who sings|who sang|called|titled|named|look up|lookup)\b/.test(text);
}

function placeAfter(text: string, topic: string): string {
  const named = text.match(new RegExp(`\\b(?:${topic})\\s+(?:in|of|at|for|near)\\s+([a-z][a-z\\s.'-]{1,40})`));
  let place = cleanQuery(named?.[1] || '');
  if (/^(it|this|that|outside|here|there|like|model|code|paper|file|app|system|chat)$/.test(place)) place = '';
  return place;
}

function packageName(text: string): string {
  const scoped = text.match(/@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*/);
  if (scoped) return scoped[0];
  const of = text.match(/\b(?:of|for|package)\s+([a-z0-9][a-z0-9._-]*)/);
  const name = of?.[1] || '';
  if (!name || /^(npm|pypi|pip|the|a|an|version|latest)$/.test(name)) return '';
  return name;
}

function detectMusic(text: string): LiveFact | null {
  if (isPlayback(text)) return null;
  const patterns = [
    /\bwho\s+sings\s+(.+)/,
    /\bwho\s+sang\s+(.+)/,
    /\b(?:song|track)\s+(?:called|titled|named)\s+(.+)/,
    /\bmusic\s+by\s+(.+)/,
    /\bsongs?\s+by\s+(.+)/,
    /\b(?:find|search|look up|lookup)\s+(?:the\s+)?(?:song|track|music)\s+(.+)/,
  ];
  if (/\b(song|track|music)\b/.test(text)) {
    patterns.push(/\b(?:artist|singer)\s+(?:of|for)\s+(?:the\s+)?(?:song\s+)?(.+)/);
  }
  for (const pattern of patterns) {
    const query = cleanQuery(text.match(pattern)?.[1] || '');
    if (query.length >= 2) return { kind: 'music', query };
  }
  return null;
}

function detectGame(text: string): LiveFact | null {
  if (!/\b(game|steam)\b/.test(text) || !/\b(price|cost|deal|sale|cheap|cheapest|how much)\b/.test(text)) return null;
  const called = text.match(/\b(?:game|steam(?:\s+game)?)\s+(?:called|titled|named)\s+(.+)/);
  const priced = text.match(/\b(?:price|cost|deal|cheapest)\s+(?:of|for)\s+(?:the\s+)?(?:game\s+|steam\s+)?(.+)/);
  const howMuch = text.match(/\bhow much(?:\s+is|\s+does)?\s+(?:the\s+)?(?:game\s+|steam\s+)?(.+)/);
  const leading = text.match(/\b([a-z0-9][a-z0-9:'\s.-]{1,40}?)\s+(?:game\s+)?(?:price|deal|cost)\b/);
  const query = cleanQuery(called?.[1] || priced?.[1] || howMuch?.[1] || leading?.[1] || '')
    .replace(/\b(game|steam|price|deal|cost|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { kind: 'game', query };
}

function detectHoliday(text: string): LiveFact | null {
  if (!/\b(holiday|holidays)\b/.test(text)) return null;
  if (!/\b(next|upcoming|when|public|date|calendar)\b/.test(text)) return null;
  if (/\b(song|music|book|movie|game)\b/.test(text)) return null;
  for (const [pattern, code, label] of HOLIDAYS) {
    if (pattern.test(text)) return { kind: 'holiday', code, label };
  }
  return { kind: 'holiday', code: '', label: '' };
}

function detectWiki(text: string): LiveFact | null {
  if (!/\b(wikipedia|wiki)\b/.test(text)) return null;
  if (/\b(open|launch|show|start|visit|kholo|kholdo|tab|browser)\b/.test(text)) return null;
  if (/\bon the web\b/.test(text)) return null;
  const query = cleanQuery(text
    .replace(/\b(on|from|search|look up|lookup|find|what is|what's|tell me about)\b/g, ' ')
    .replace(/\b(wikipedia|wiki)\b/g, ' '));
  return { kind: 'wiki', query };
}

function detectPackage(text: string, kind: 'npm' | 'pypi'): LiveFact | null {
  const marker = kind === 'npm' ? /\b(npm|node package)\b/ : /\b(pypi|pip package)\b/;
  if (!marker.test(text) || !/\b(version|latest)\b/.test(text)) return null;
  return { kind, name: packageName(text) };
}

export function detectLiveFact(raw: string): LiveFact | null {
  const text = normalize(raw);
  if (!text || text.split(/\s+/).length > 28) return null;

  if (/\b(weather|forecast|temperature|mausam)\b/.test(text) && !/\b(song|track|who sings|who sang)\b/.test(text)) {
    const named = text.match(/\b(?:weather|forecast|temperature|mausam)\s+(?:in|of|at|for|ka|ki)\s+([a-z][a-z\s.'-]{1,40})/);
    const trailing = text.match(/\b([a-z][a-z\s.'-]{1,40})\s+(?:ka|ki|ke)\s+mausam\b/);
    let place = cleanQuery(named?.[1] || trailing?.[1] || '');
    if (/^(it|this|that|outside|here|there|like|model|code|paper|file|app|system|chat)$/.test(place)) place = '';
    return { kind: 'weather', place };
  }

  if (/\b(aqi|air quality|pm2\.5|pm2_5)\b/.test(text)) {
    return { kind: 'air', place: placeAfter(text, 'aqi|air quality|pm2\\.5|pm2_5') };
  }

  if (/\b(stock|share) price\b/.test(text) || /\b(nse|bse|nasdaq|nyse)\b/.test(text) && /\b(price|quote|rate)\b/.test(text)) {
    return { kind: 'stock' };
  }

  const coin = COINS.find(([pattern]) => pattern.test(text));
  if (coin && mentionsRate(text)) {
    return { kind: 'crypto', id: coin[1], label: coin[2] };
  }

  const music = detectMusic(text);
  if (music) return music;
  const game = detectGame(text);
  if (game) return game;
  const holiday = detectHoliday(text);
  if (holiday) return holiday;
  if (/\b(earthquake|earthquakes)\b/.test(text)) return { kind: 'quake' };
  const wiki = detectWiki(text);
  if (wiki) return wiki;
  if (/\b(where is|where's|position of|location of)\b/.test(text) && /\b(iss|international space station)\b/.test(text)) {
    return { kind: 'iss' };
  }
  if (/\b(formula 1|formula one|f1)\b/.test(text) && /\b(result|results|winner|won|last|latest|race)\b/.test(text)) {
    return { kind: 'f1' };
  }
  if (/\b(book|isbn)\b/.test(text) && /\b(titled|called|named|isbn|find|search|look up|lookup)\b/.test(text)) {
    const titled = text.match(/\b(?:titled|called|named|isbn)\s+([a-z0-9][a-z0-9\s.'-]{1,60})/);
    const found = text.match(/\b(?:find|search|look up|lookup)\s+(?:the\s+)?book\s+(.+)/);
    return { kind: 'book', query: cleanQuery(titled?.[1] || found?.[1] || '') };
  }
  const npm = detectPackage(text, 'npm');
  if (npm) return npm;
  const pypi = detectPackage(text, 'pypi');
  if (pypi) return pypi;

  if (!mentionsRate(text) && !/\b(inr|usd|eur|gbp|rupees?|dollars?)\b/.test(text)) return null;
  const hits: Array<{ code: string; index: number }> = [];
  for (const [pattern, code] of CURRENCY) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      hits.push({ code, index: match.index });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const unique: string[] = [];
  for (const hit of hits) {
    if (!unique.includes(hit.code)) unique.push(hit.code);
  }
  if (unique.length === 0) return null;
  const explicitRate = mentionsRate(text) || unique.length >= 2 || /\b(dollar|rupee) rate\b/.test(text);
  if (!explicitRate) return null;

  const amountMatch = text.match(/(\d[\d,]*(?:\.\d+)?)|(?:\b(one|ek|a|an)\b)/);
  const amount = amountMatch?.[1]
    ? Number(amountMatch[1].replace(/,/g, ''))
    : 1;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let from = unique[0];
  let to = unique[1];
  if (!to) {
    if (from === 'USD') to = 'INR';
    else if (from === 'INR') {
      from = 'USD';
      to = 'INR';
    } else {
      to = 'USD';
    }
  }
  if (from === to) return null;
  return { kind: 'fx', amount, from, to };
}

async function readJson(url: string, fetchImpl: typeof fetch): Promise<any> {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'FloatGPT/2.2.1' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Feed returned ${response.status}`);
  return response.json();
}

function plain(value: unknown): string {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function need(kind: string, message: string): LiveAnswer {
  return { message, actionExecuted: `live_${kind}_need_query` };
}

function cached(key: string, ttlMs: number): string | null {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > ttlMs) {
    cache.delete(key);
    return null;
  }
  return row.message;
}

function remember(key: string, message: string): string {
  cache.set(key, { at: Date.now(), message });
  return message;
}

async function weather(place: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!place) {
    return {
      message: 'Which city? Ask again with a place, for example “weather in Delhi”.',
      actionExecuted: 'live_weather_need_place',
    };
  }
  const key = `weather:${place}`;
  const hit = cached(key, 10 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_weather' };

  const geo = await readJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=5&language=en&format=json`,
    fetchImpl
  );
  const found = Array.isArray(geo?.results) ? geo.results[0] : null;
  if (!found) {
    return {
      message: `I could not find a city named “${place}”. Try the city and country.`,
      actionExecuted: 'live_weather_unknown_place',
    };
  }
  const current = await readJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${found.latitude}&longitude=${found.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`,
    fetchImpl
  );
  const now = current?.current;
  if (!now || typeof now.temperature_2m !== 'number') {
    throw new Error('Weather feed had no current observation');
  }
  const label = WEATHER_LABEL[Number(now.weather_code)] || 'Current conditions';
  const where = [found.name, found.admin1, found.country].filter(Boolean).join(', ');
  const message = remember(key, [
    `**${where}**`,
    `${label}, ${now.temperature_2m}°C. Feels like ${now.apparent_temperature}°C.`,
    `Humidity ${now.relative_humidity_2m}%. Wind ${now.wind_speed_10m} km/h.`,
    `Source: Open-Meteo, observed ${now.time}.`,
  ].join('\n'));
  return { message, actionExecuted: 'live_weather' };
}

async function fx(fact: Extract<LiveFact, { kind: 'fx' }>, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  const key = `fx:${fact.amount}:${fact.from}:${fact.to}`;
  const hit = cached(key, 30 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_fx' };

  const payload = await readJson(
    `https://api.frankfurter.app/latest?from=${fact.from}&to=${fact.to}`,
    fetchImpl
  );
  const rate = Number(payload?.rates?.[fact.to]);
  if (!Number.isFinite(rate)) throw new Error('FX feed had no rate');
  const converted = fact.amount * rate;
  const money = (value: number, code: string) =>
    `${value.toLocaleString('en-IN', { maximumFractionDigits: value >= 100 ? 2 : 4 })} ${code}`;
  const message = remember(key, [
    `**${money(fact.amount, fact.from)} = ${money(converted, fact.to)}**`,
    `1 ${fact.from} = ${rate.toLocaleString('en-IN', { maximumFractionDigits: 4 })} ${fact.to}.`,
    `Source: Frankfurter, European Central Bank reference rate for ${payload.date}. This is not a bank’s live dealing price.`,
  ].join('\n'));
  return { message, actionExecuted: 'live_fx' };
}

async function crypto(fact: Extract<LiveFact, { kind: 'crypto' }>, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  const key = `crypto:${fact.id}`;
  const hit = cached(key, 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_crypto' };

  const payload = await readJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${fact.id}&vs_currencies=usd,inr`,
    fetchImpl
  );
  const row = payload?.[fact.id];
  if (!row || typeof row.usd !== 'number') throw new Error('Crypto feed had no price');
  const usd = Number(row.usd).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const inr = Number(row.inr).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const message = remember(key, [
    `**${fact.label}** is $${usd} USD, about ₹${inr}.`,
    'Source: CoinGecko. The price moves, and this is not an order-book quote from an exchange.',
  ].join('\n'));
  return { message, actionExecuted: 'live_crypto' };
}

async function music(query: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!query) return need('music', 'Which song or artist? For example, “who sings Creep” or “music by Radiohead”.');
  const key = `music:${query}`;
  const hit = cached(key, 60 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_music' };
  const payload = await readJson(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=3&country=us`,
    fetchImpl
  );
  const rows = Array.isArray(payload?.results) ? payload.results.slice(0, 3) : [];
  if (!rows.length) {
    return { message: `I could not find “${query}” in the Apple music catalog.`, actionExecuted: 'live_music_empty' };
  }
  const lines = rows.map((row: any) => {
    const year = String(row.releaseDate || '').slice(0, 4);
    return `• **${row.trackName}** — ${row.artistName}${row.collectionName ? `, ${row.collectionName}` : ''}${year ? ` (${year})` : ''}`;
  });
  const message = remember(key, [
    lines.join('\n'),
    'Source: Apple iTunes Search. This is catalog metadata, not playback.',
  ].join('\n'));
  return { message, actionExecuted: 'live_music' };
}

async function game(query: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!query) return need('game', 'Which game? For example, “price of the game Elden Ring”.');
  const key = `game:${query}`;
  const hit = cached(key, 30 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_game' };
  const payload = await readJson(
    `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(query)}&limit=3`,
    fetchImpl
  );
  const rows = Array.isArray(payload) ? payload.slice(0, 3) : [];
  if (!rows.length) {
    return { message: `I could not find a store price for “${query}”.`, actionExecuted: 'live_game_empty' };
  }
  const lines = rows.map((row: any) => `• **${row.external}** — cheapest tracked price $${row.cheapest} USD`);
  const message = remember(key, [
    lines.join('\n'),
    'Source: CheapShark. These are tracked store prices in USD, not a live Steam cart.',
  ].join('\n'));
  return { message, actionExecuted: 'live_game' };
}

async function holiday(fact: Extract<LiveFact, { kind: 'holiday' }>, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!fact.code && fact.label) {
    return {
      message: `This holiday calendar does not include ${fact.label}.`,
      actionExecuted: 'live_holiday_unsupported',
    };
  }
  if (!fact.code) {
    return need('holiday', 'Which country? For example, “next holiday in the US”. This calendar does not include India.');
  }
  const key = `holiday:${fact.code}`;
  const hit = cached(key, 12 * 60 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_holiday' };
  const payload = await readJson(`https://date.nager.at/api/v3/NextPublicHolidays/${fact.code}`, fetchImpl);
  const rows = Array.isArray(payload) ? payload.slice(0, 3) : [];
  if (!rows.length) throw new Error('Holiday feed was empty');
  const lines = rows.map((row: any) => `• **${row.date}** — ${row.localName || row.name}`);
  const message = remember(key, [
    `Next public holidays in ${fact.label}:`,
    lines.join('\n'),
    'Source: Nager.Date.',
  ].join('\n'));
  return { message, actionExecuted: 'live_holiday' };
}

async function quake(fetchImpl: typeof fetch): Promise<LiveAnswer> {
  const hit = cached('quake', 5 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_quake' };
  const payload = await readJson(
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=3&orderby=time',
    fetchImpl
  );
  const rows = Array.isArray(payload?.features) ? payload.features : [];
  if (!rows.length) throw new Error('Earthquake feed was empty');
  const lines = rows.map((row: any) => {
    const props = row.properties || {};
    const when = typeof props.time === 'number' ? new Date(props.time).toISOString().replace('.000Z', 'Z') : '';
    return `• **M${props.mag}** — ${props.place}${when ? ` (${when})` : ''}`;
  });
  const message = remember('quake', [
    'Latest earthquakes:',
    lines.join('\n'),
    'Source: USGS.',
  ].join('\n'));
  return { message, actionExecuted: 'live_quake' };
}

async function wiki(query: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!query) return need('wiki', 'What should I look up on Wikipedia?');
  const key = `wiki:${query}`;
  const hit = cached(key, 60 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_wiki' };
  const payload = await readJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&origin=*`,
    fetchImpl
  );
  const rows = Array.isArray(payload?.query?.search) ? payload.query.search.slice(0, 3) : [];
  if (!rows.length) {
    return { message: `Wikipedia had no article matching “${query}”.`, actionExecuted: 'live_wiki_empty' };
  }
  const lines = rows.map((row: any) => `• **${row.title}** — ${plain(row.snippet)}`);
  const message = remember(key, [
    lines.join('\n'),
    'Source: Wikipedia (CC BY-SA).',
  ].join('\n'));
  return { message, actionExecuted: 'live_wiki' };
}

async function air(place: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!place) return need('air', 'Which city? For example, “AQI in Delhi”.');
  const key = `air:${place}`;
  const hit = cached(key, 10 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_air' };
  const geo = await readJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`,
    fetchImpl
  );
  const found = Array.isArray(geo?.results) ? geo.results[0] : null;
  if (!found) {
    return { message: `I could not find a city named “${place}”.`, actionExecuted: 'live_air_unknown_place' };
  }
  const current = await readJson(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${found.latitude}&longitude=${found.longitude}&current=pm2_5,us_aqi`,
    fetchImpl
  );
  const now = current?.current;
  if (!now || typeof now.us_aqi !== 'number') throw new Error('Air-quality feed had no reading');
  const where = [found.name, found.country].filter(Boolean).join(', ');
  const message = remember(key, [
    `**${where}**`,
    `US AQI ${now.us_aqi}. PM2.5 ${now.pm2_5} μg/m³.`,
    `Source: Open-Meteo air quality, modeled at ${now.time}. This is a model, not a roadside sensor.`,
  ].join('\n'));
  return { message, actionExecuted: 'live_air' };
}

async function iss(fetchImpl: typeof fetch): Promise<LiveAnswer> {
  const hit = cached('iss', 30 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_iss' };
  const row = await readJson('https://api.wheretheiss.at/v1/satellites/25544', fetchImpl);
  if (typeof row?.latitude !== 'number' || typeof row?.longitude !== 'number') throw new Error('ISS feed had no position');
  const when = typeof row.timestamp === 'number' ? new Date(row.timestamp * 1000).toISOString().replace('.000Z', 'Z') : '';
  const message = remember('iss', [
    `**ISS** is at ${Number(row.latitude).toFixed(2)}°, ${Number(row.longitude).toFixed(2)}°.`,
    `Altitude ${row.altitude} km. Speed ${row.velocity} km/h.${when ? ` Observed ${when}.` : ''}`,
    'Source: Where the ISS at (community feed).',
  ].join('\n'));
  return { message, actionExecuted: 'live_iss' };
}

async function f1(fetchImpl: typeof fetch): Promise<LiveAnswer> {
  const hit = cached('f1', 60 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_f1' };
  const payload = await readJson('https://api.jolpi.ca/ergast/f1/current/last/results.json', fetchImpl);
  const race = payload?.MRData?.RaceTable?.Races?.[0];
  const results = Array.isArray(race?.Results) ? race.Results.slice(0, 3) : [];
  if (!race || !results.length) throw new Error('F1 feed had no race');
  const lines = results.map((row: any) => `• **P${row.position}** ${row.Driver?.givenName || ''} ${row.Driver?.familyName || ''}`.trim());
  const message = remember('f1', [
    `**${race.raceName}** (${race.date})`,
    lines.join('\n'),
    'Source: Jolpica, a community race archive. This is not the official Formula 1 timing feed.',
  ].join('\n'));
  return { message, actionExecuted: 'live_f1' };
}

async function book(query: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!query) return need('book', 'Which book? For example, “book titled Dune”.');
  const key = `book:${query}`;
  const hit = cached(key, 24 * 60 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: 'live_book' };
  const payload = await readJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1&fields=title,author_name,first_publish_year`,
    fetchImpl
  );
  const row = Array.isArray(payload?.docs) ? payload.docs[0] : null;
  if (!row?.title) {
    return { message: `Open Library had no book matching “${query}”.`, actionExecuted: 'live_book_empty' };
  }
  const author = Array.isArray(row.author_name) ? row.author_name.slice(0, 2).join(', ') : '';
  const message = remember(key, [
    `**${row.title}**${author ? ` — ${author}` : ''}${row.first_publish_year ? ` (${row.first_publish_year})` : ''}`,
    'Source: Open Library.',
  ].join('\n'));
  return { message, actionExecuted: 'live_book' };
}

async function packageVersion(kind: 'npm' | 'pypi', name: string, fetchImpl: typeof fetch): Promise<LiveAnswer> {
  if (!name) return need(kind, kind === 'npm' ? 'Which npm package? For example, “latest version of react on npm”.' : 'Which PyPI package? For example, “latest version of requests on pypi”.');
  const key = `${kind}:${name}`;
  const hit = cached(key, 60 * 60 * 1000);
  if (hit) return { message: hit, actionExecuted: `live_${kind}` };
  const url = kind === 'npm'
    ? `https://registry.npmjs.org/${name}/latest`
    : `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  const payload = await readJson(url, fetchImpl);
  const version = kind === 'npm' ? payload?.version : payload?.info?.version;
  if (!version) {
    return { message: `I could not find ${kind === 'npm' ? 'an npm' : 'a PyPI'} package named “${name}”.`, actionExecuted: `live_${kind}_empty` };
  }
  const message = remember(key, [
    `**${name}** latest version is ${version}.`,
    `Source: ${kind === 'npm' ? 'npm registry' : 'PyPI'}.`,
  ].join('\n'));
  return { message, actionExecuted: `live_${kind}` };
}

const FAIL_LABEL: Record<string, string> = {
  weather: 'weather',
  fx: 'exchange-rate',
  crypto: 'crypto',
  music: 'music',
  game: 'game-price',
  holiday: 'holiday',
  quake: 'earthquake',
  wiki: 'Wikipedia',
  air: 'air-quality',
  iss: 'ISS',
  f1: 'Formula 1',
  book: 'book',
  npm: 'npm',
  pypi: 'PyPI',
};

export async function answerLiveFact(raw: string, fetchImpl: typeof fetch = fetch): Promise<LiveAnswer | null> {
  const fact = detectLiveFact(raw);
  if (!fact) return null;
  if (fact.kind === 'stock') {
    return {
      message: 'I do not have a stock-price feed connected, so I will not guess a share price. A market key can be added later.',
      actionExecuted: 'live_stock_unavailable',
    };
  }
  try {
    if (fact.kind === 'weather') return await weather(fact.place, fetchImpl);
    if (fact.kind === 'fx') return await fx(fact, fetchImpl);
    if (fact.kind === 'crypto') return await crypto(fact, fetchImpl);
    if (fact.kind === 'music') return await music(fact.query, fetchImpl);
    if (fact.kind === 'game') return await game(fact.query, fetchImpl);
    if (fact.kind === 'holiday') return await holiday(fact, fetchImpl);
    if (fact.kind === 'quake') return await quake(fetchImpl);
    if (fact.kind === 'wiki') return await wiki(fact.query, fetchImpl);
    if (fact.kind === 'air') return await air(fact.place, fetchImpl);
    if (fact.kind === 'iss') return await iss(fetchImpl);
    if (fact.kind === 'f1') return await f1(fetchImpl);
    if (fact.kind === 'book') return await book(fact.query, fetchImpl);
    if (fact.kind === 'npm' || fact.kind === 'pypi') return await packageVersion(fact.kind, fact.name, fetchImpl);
    return null;
  } catch {
    return {
      message: `The ${FAIL_LABEL[fact.kind] || 'live'} feed did not answer. Try again in a moment. I will not guess this.`,
      actionExecuted: `live_${fact.kind}_failed`,
    };
  }
}
