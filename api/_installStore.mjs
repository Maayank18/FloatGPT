import { MongoClient } from 'mongodb';

let clientPromise = null;
let indexPromise = null;

function database() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise.then((client) => client.db('floatgpt'));
}

async function installs() {
  const db = await database();
  const collection = db.collection('installs');
  if (!indexPromise) indexPromise = collection.createIndex({ installId: 1 }, { unique: true });
  await indexPromise;
  return collection;
}

let downloadIndexPromise = null;

async function downloads() {
  const db = await database();
  const collection = db.collection('downloads');
  if (!downloadIndexPromise) downloadIndexPromise = collection.createIndex({ downloadId: 1 }, { unique: true });
  await downloadIndexPromise;
  return collection;
}

export function cleanInstall(body) {
  const installId = String(body?.installId || '').trim();
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(installId)) return null;
  const raw = String(body?.platform || 'win').toLowerCase();
  const platform = raw === 'mac' || raw === 'darwin' ? 'mac' : raw === 'linux' ? 'linux' : 'win';
  const version = String(body?.version || '').replace(/[^\w.-]/g, '').slice(0, 32);
  return { installId, platform, version };
}

// Installer downloads already on GitHub before this counter existed.
// Windows .exe assets sum to 27. macOS .dmg assets sum to 4.
// A new install is a row in `installs` and is added on top of these numbers.
const PREVIOUS_DOWNLOADS = { win: 27, mac: 4, linux: 0 };

async function countsByPlatform(collection) {
  const rows = await collection.aggregate([{ $group: { _id: '$platform', n: { $sum: 1 } } }]).toArray();
  return Object.fromEntries(rows.map((row) => [row._id, row.n]));
}

export async function readInstallCounts() {
  const [installBy, downloadBy] = await Promise.all([
    installs().then(countsByPlatform),
    downloads().then(countsByPlatform),
  ]);
  const installsWin = installBy.win || 0;
  const installsMac = installBy.mac || 0;
  const downloadsWin = downloadBy.win || 0;
  const downloadsMac = downloadBy.mac || 0;
  const linux = (installBy.linux || 0) + (downloadBy.linux || 0);
  const recordedWin = installsWin + downloadsWin;
  const recordedMac = installsMac + downloadsMac;
  const win = recordedWin + PREVIOUS_DOWNLOADS.win;
  const mac = recordedMac + PREVIOUS_DOWNLOADS.mac;
  return {
    win,
    mac,
    linux,
    total: win + mac + linux,
    previousWin: PREVIOUS_DOWNLOADS.win,
    previousMac: PREVIOUS_DOWNLOADS.mac,
    recordedWin,
    recordedMac,
    downloadsWin,
    downloadsMac,
    installsWin,
    installsMac,
  };
}

export async function recordInstall(body) {
  const row = cleanInstall(body);
  if (!row) return { status: 400, error: 'That install id is not valid.' };
  const collection = await installs();
  const result = await collection.updateOne(
    { installId: row.installId },
    { $setOnInsert: { installId: row.installId, platform: row.platform, version: row.version, kind: 'install', createdAt: new Date() } },
    { upsert: true }
  );
  const counts = await readInstallCounts();
  return { ok: true, counted: result.upsertedCount === 1, kind: 'install', ...counts };
}

export async function recordDownload(body) {
  const row = cleanInstall({ ...body, installId: body?.downloadId || body?.installId });
  if (!row) return { status: 400, error: 'That download id is not valid.' };
  const collection = await downloads();
  const result = await collection.updateOne(
    { downloadId: row.installId },
    { $setOnInsert: { downloadId: row.installId, platform: row.platform, version: row.version, kind: 'download', createdAt: new Date() } },
    { upsert: true }
  );
  const counts = await readInstallCounts();
  return { ok: true, counted: result.upsertedCount === 1, kind: 'download', ...counts };
}
