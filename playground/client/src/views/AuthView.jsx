import React, { useState } from 'react';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from '../../../../src/lib/firebase';

export const AuthView = () => {
  const [authMode, setAuthMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user && fullName) {
          await updateProfile(userCredential.user, { displayName: fullName });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setAuthError('Incorrect email or password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('An account with this email already exists.');
      } else {
        setAuthError(err.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err.message);
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
        <p className="text-[14px] text-text-muted text-center mb-6 leading-relaxed">Log in to sync your intelligent workspace across all devices.</p>
        
        {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">{authError}</div>}
        
        <div className="space-y-4">
          <div className="flex bg-bg/50 p-1.5 rounded-xl border border-card-border mb-4">
            <button
              type="button"
              onClick={() => setAuthMode('signin')}
              className={`flex-1 text-[14px] py-2 rounded-lg font-medium transition-all ${authMode === 'signin' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`flex-1 text-[14px] py-2 rounded-lg font-medium transition-all ${authMode === 'signup' ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" required className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
              </div>
            )}
            <div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required autoComplete="off" className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
            </div>
            <div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoComplete="new-password" className="w-full bg-bg/80 border border-card-border rounded-xl px-4 py-2.5 text-[14px] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-text-muted/70" />
            </div>
            <button type="submit" className="w-full py-3 mt-4 bg-accent hover:bg-accent-hover text-white rounded-xl text-[14px] font-medium transition-colors shadow-lg shadow-accent/20">
              {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-4 py-3">
            <div className="h-px bg-card-border flex-1"></div>
            <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Or</span>
            <div className="h-px bg-card-border flex-1"></div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-gray-50 text-black rounded-xl text-[14px] font-medium transition-colors shadow-sm border border-gray-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};
