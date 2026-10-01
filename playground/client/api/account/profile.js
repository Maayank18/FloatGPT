import { readAccount, readProfile, saveProfile, bodyOf } from '../_account.mjs';

export default async function handler(req, res) {
  const account = readAccount(req);
  if (!account) {
    res.status(401).json({ error: 'Sign in again to continue.' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const result = await readProfile(account);
      res.status(200).json({ profile: result.profile, workspace: result.workspace, revision: result.revision });
      return;
    }
    if (req.method === 'PUT') {
      const result = await saveProfile(account, bodyOf(req));
      res.status(result.status).json(result.error ? { error: result.error } : { ok: true, revision: result.revision });
      return;
    }
    res.status(405).json({ error: 'Use GET or PUT.' });
  } catch (err) {
    console.error('[Account profile]', err instanceof Error ? err.message : 'failed');
    const message = req.method === 'PUT' ? 'Could not save your account data.' : 'Could not load your saved data.';
    res.status(500).json({ error: message });
  }
}
