import { readInstallCounts } from '../_installStore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET.' });
    return;
  }
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await readInstallCounts());
  } catch {
    res.status(503).json({ error: 'Install count is unavailable.' });
  }
}
