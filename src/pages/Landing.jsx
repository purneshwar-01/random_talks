import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RadioTower, Mail, Lock, ShieldCheck, Users, Briefcase, Sparkles, ArrowLeft, CheckCircle } from 'lucide-react';

function friendlyError(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use'))
    return 'That email is already registered — try signing in instead.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'Incorrect email or password.';
  if (code.includes('invalid-email')) return 'That email address looks invalid.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('auth/operation-not-allowed'))
    return 'Email/Password sign-in is disabled in Firebase Console > Authentication.';
  if (code.includes('too-many-requests'))
    return 'Too many attempts. Please wait a moment and try again.';
  if (code.includes('user-not-found') || code.includes('auth/user-not-found'))
    return 'No account found with that email address.';
  return err?.message || 'Something went wrong. Please try again.';
}

export default function Landing() {
  const { signIn, signUp, sendPasswordReset } = useAuth();
  // mode: 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email);
        setResetSent(true);
      } else if (mode === 'signup') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setResetSent(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900 font-sans">
      <div className="bg-white border border-slate-200 p-8 md:p-10 max-w-md w-full rounded-2xl shadow-sm space-y-6 relative overflow-hidden animate-fade-in">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-50 blur-2xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-cyan-50 blur-2xl rounded-full pointer-events-none" />

        {/* Brand */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#FCA311] text-[#14213D] shadow-[0_10px_25px_-5px_rgba(252,163,17,0.35)]">
            <RadioTower className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">RandomTalks Pro</h1>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Purpose-Based Stranger &amp; Friends Network
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
              <span className="text-[11px] font-bold flex items-center gap-1 text-[#14213D] bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Briefcase size={12} /> Tech &amp; Career
            </span>
              <span className="text-[11px] font-bold flex items-center gap-1 text-amber bg-amber/10 px-3 py-1 rounded-full border border-amber/30">
              <Users size={12} /> Friends
            </span>
              <span className="text-[11px] font-bold flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/30">
              <Sparkles size={12} /> Verified
            </span>
          </div>
        </div>

        {/* ── FORGOT PASSWORD success state ── */}
        {mode === 'forgot' && resetSent ? (
          <div className="relative z-10 text-center space-y-4">
            <CheckCircle size={48} className="text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">Check your inbox</h3>
            <p className="text-sm text-slate-600">
              A password-reset link has been sent to <strong>{email}</strong>. Check your spam folder if you don&apos;t see it.
            </p>
            <button
              onClick={() => switchMode('signin')}
              className="text-xs font-semibold text-primary hover:text-white transition flex items-center justify-center gap-1 mx-auto"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </button>
          </div>
        ) : (
          /* ── AUTH FORM ── */
          <form onSubmit={handleSubmit} className="relative z-10 space-y-4 text-left">
            {/* Back link for forgot mode */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700 transition"
              >
                <ArrowLeft size={13} /> Back to Sign In
              </button>
            )}

            {mode === 'forgot' && (
              <div className="p-4 bg-amber/10 border border-amber/30 rounded-xl text-xs text-amber font-medium">
                Enter your registered email. We&apos;ll send a secure reset link — no OTP to copy, just click the link.
              </div>
            )}

            {/* Email */}
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Mail size={14} className="text-blue-600" />
                {mode === 'forgot' ? 'Your Registered Email' : 'Email Address'}
              </label>
              <input
                required
                type="email"
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition text-sm font-medium"
              />
            </div>

            {/* Password — hidden in forgot mode */}
            {mode !== 'forgot' && (
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Lock size={14} className="text-blue-600" /> Password
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition text-sm font-medium"
                />
                {/* Forgot Password trigger — only on sign-in */}
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition float-right"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-300 font-semibold bg-red-500/10 p-3 rounded-xl border border-red-400/30 clear-both">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] font-bold text-[#14213D] shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] disabled:opacity-50 text-sm clear-both"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'signup'
                ? 'Create Account'
                : mode === 'forgot'
                ? 'Send Reset Link'
                : 'Sign In'}
            </button>
          </form>
        )}

        {/* Mode switcher */}
        {!resetSent && (
          <div className="relative z-10 text-center space-y-2 pt-2 border-t border-slate-200">
            {mode !== 'forgot' && (
              <button
                onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
                className="text-xs font-semibold text-slate-500 hover:text-blue-700 transition"
              >
                {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            )}
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
              <ShieldCheck size={13} className="text-emerald-400" /> 18+ Only • Safe &amp; Moderated Environment
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
