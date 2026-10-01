import { authErrorMessage } from './authErrors';

function assert(cond: boolean, name: string) {
  if (!cond) throw new Error(name);
  console.log('  PASS', name);
}

{
  console.log('Auth error messages');
  assert(authErrorMessage('auth/invalid-credential', 'signin').includes('did not match'), 'sign-in mismatch');
  assert(authErrorMessage('auth/email-already-in-use', 'signup').includes('already has an account'), 'existing email');
  assert(authErrorMessage('auth/weak-password', 'signup').includes('6 characters'), 'weak password');
  assert(authErrorMessage('auth/missing-password', 'signin').includes('password'), 'missing password');
  console.log('ok');
}
