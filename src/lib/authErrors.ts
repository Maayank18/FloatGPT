/** Plain messages for Firebase Auth. The raw SDK text is not shown in the form. */
export function authErrorMessage(code: string | undefined, mode: 'signin' | 'signup'): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
      return mode === 'signup'
        ? 'Could not create the account. Use a valid email and a password of at least 6 characters.'
        : 'That email and password did not match. Create an account if this is your first time, use Google if you signed up that way, or reset the password.';
    case 'auth/email-already-in-use':
      return 'This email already has an account. Sign in, continue with Google, or reset the password.';
    case 'auth/weak-password':
      return 'Use a password of at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
      return 'Enter the password. If the field looks filled, click it and type the password again.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is turned off in the Firebase project.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute, then try again.';
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check the connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This address is not allowed to use Firebase sign-in. Open FloatGPT from localhost or floatgpt.vercel.app.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/popup-blocked':
      return 'The Google window was closed before sign-in finished. Try Google again, or use email.';
    default:
      return 'Sign-in did not finish. Try again, use Google, or reset the password.';
  }
}
