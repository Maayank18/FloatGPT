import { currentUser, readAccount } from '../_account.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET.' });
    return;
  }
  const account = readAccount(req);
  if (!account) {
    res.status(401).json({ error: 'Sign in again to continue.' });
    return;
  }
  try {
    const result = await currentUser(account);
    res.status(result.status).json(result.error ? { error: result.error } : { user: result.user });
  } catch (err) {
    console.error('[Account me]', err instanceof Error ? err.message : 'failed');
    res.status(500).json({ error: 'Could not load the account.' });
  }
}
