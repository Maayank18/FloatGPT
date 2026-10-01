import { recordDownload } from '../_installStore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  try {
    const result = await recordDownload(req.body);
    res.setHeader('Cache-Control', 'no-store');
    if (result.status) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(200).json(result);
  } catch {
    res.status(503).json({ error: 'Download count is unavailable.' });
  }
}
