import { recordInstall } from '../_installStore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  try {
    const result = await recordInstall(req.body);
    res.setHeader('Cache-Control', 'no-store');
    if (result.status) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(200).json(result);
  } catch {
    res.status(503).json({ error: 'Install count is unavailable.' });
  }
}
