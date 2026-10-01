import {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  browserPopupRedirectResolver,
} from './firebase';

/**
 * Google sign-in.
 * On this PC the account chooser stays in this tab and comes back to the same site.
 * On the published site it opens beside the page.
 * Returns false when this page is leaving for Google.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const localSecure =
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    (host === 'localhost' || host === '127.0.0.1');
  if (localSecure) {
    await signInWithRedirect(auth, provider);
    return false;
  }
  const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
  return !!result?.user;
}
