import React, { useState } from 'react';
import { signInWithEmail, signInWithGoogleAccount, signUpWithEmail } from '../../../../src/lib/accountSession';
import { authErrorMessage } from '../../../../src/lib/authErrors';
import { GoogleMark } from '../../../../src/components/GoogleMark';

export const AuthView = ({ initialError = '' }) => {
  const [authMode, setAuthMode] = useState('signin');
  const [authError, setAuthError] = useState(initialError);
  const [authNotice, setAuthNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setAuthError('');
    setAuthNotice('');
    setBusy(true);
    try {
      await signInWithGoogleAccount();
    } catch (err) {
      setAuthError(err?.code ? authErrorMessage(err.code, 'signin') : (err?.message || 'Google sign-in did not finish. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const fullName = String(data.get('name') || '').trim();
    setBusy(true);
    try {
      if (authMode === 'signup') {
        if (password.length < 6) {
          setAuthError('Use a password of at least 6 characters.');
          return;
        }
        await signUpWithEmail(email, password, fullName);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setAuthError(err?.message || 'Sign-in did not finish. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#050505] flex items-center justify-center font-sans relative overflow-hidden">
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      
      {/* Floating Glowing Orbs */}
      <div className="absolute top-[20%] left-[15%] w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[15%] w-[30rem] h-[30rem] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Geometric Accents */}
      <div className="absolute top-[15%] right-[10%] w-64 h-64 border border-white/5 rounded-full rotate-45 pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[10%] w-96 h-96 border border-indigo-500/10 rounded-full pointer-events-none"></div>

      {/* Brand Doodling Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5">
        <div className="text-[180px] font-black tracking-tighter text-white leading-none rotate-[-5deg] scale-150">FLOATGPT</div>
      </div>
      
      <div className="bg-[#111111]/80 backdrop-blur-3xl border border-white/10 px-10 py-12 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.5)] max-w-[460px] w-full relative z-10 animate-in fade-in zoom-in-95 duration-500 my-8 overflow-y-auto max-h-[90vh] hide-scrollbar">
        <div className="flex justify-center mb-6">
          <img src="/logo-2-chat-circular.png" alt="FloatGPT Logo" className="w-16 h-16 rounded-2xl shadow-lg border border-white/10" />
        </div>
        <h2 className="text-2xl font-semibold text-text-primary text-center mb-2 tracking-tight">Welcome to FloatGPT</h2>
        <p className="text-[14px] text-text-muted text-center mb-6 leading-relaxed">Log in with your email. Chats stay on this device.</p>
        
        {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center leading-relaxed">{authError}</div>}
        {authNotice && <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl text-center leading-relaxed">{authNotice}</div>}
        
        <div className="space-y-4">
          <div className="flex bg-bg/50 p-1.5 rounded-xl border border-card-border mb-4">
            <button
              type="button"
              onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthNotice(''); }}
              className={`flex-1 text-[14px] py-2 rounded-lg font-medium transition-all ${authMode === 'signin' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthNotice(''); }}
              className={`flex-1 text-[14px] py-2 rounded-lg font-medium transition-all ${authMode === 'signup' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Create Account
            </button>
          </div>

          <button type="button" onClick={handleGoogle} disabled={busy} className="w-full py-3 bg-white text-[#1f1f1f] hover:bg-white/90 disabled:opacity-60 rounded-xl text-[14px] font-medium transition-colors flex items-center justify-center gap-2.5">
            <GoogleMark />
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-text-muted">
            <div className="h-px flex-1 bg-card-border" />
            or email
            <div className="h-px flex-1 bg-card-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <input name="name" type="text" placeholder="Full Name" autoComplete="name" className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
              </div>
            )}
            <div>
              <input name="email" type="email" placeholder="Email address" required autoComplete="email" className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
            </div>
            <div>
              <input name="password" type="password" placeholder={authMode === 'signup' ? 'Password (min 6 characters)' : 'Password'} required autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
            </div>
            <button type="submit" disabled={busy} className="w-full py-3 mt-4 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white rounded-xl text-[14px] font-medium transition-colors shadow-lg shadow-accent/20">
              {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
