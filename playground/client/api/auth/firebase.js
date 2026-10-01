import { bodyOf, loginWithFirebase } from '../_account.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  try {
    const result = await loginWithFirebase(bodyOf(req));
    res.status(result.status).json(result.error ? { error: result.error } : { token: result.token, user: result.user });
  } catch (err) {
    console.error('[Account google]', err instanceof Error ? err.message : 'failed');
    res.status(500).json({ error: 'Could not sign in with Google. Try again.' });
  }
}
