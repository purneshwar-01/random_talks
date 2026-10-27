import { Component, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Lenis from '@studio-freight/lenis';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Landing from './pages/Landing';
import ProfileSetup from './pages/ProfileSetup';
import Dashboard from './pages/Dashboard';
import CallRoom from './pages/CallRoom';
import SpotlightShell from './components/SpotlightShell';
import FluidLoadingOrb from './components/FluidLoadingOrb';
import { Zap, ArrowLeft, RefreshCw } from 'lucide-react';

/**
 * Route-level Error Boundary — displays a dark, sleek fallback UI with
 * [Retry Connection] and [Back to Dashboard] buttons if an unhandled error occurs.
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary] Unhandled error in route:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#07090E] flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#FCA311] flex items-center justify-center mx-auto shadow-inner">
              <Zap size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">Call Session Interrupted</h3>
              <p className="text-xs text-slate-300">
                An unexpected glitch occurred while loading this room. Click below to reconnect or return to your dashboard.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 rounded-xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} /> Retry Connection
              </button>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Full-screen loading splash — shown while Firebase Auth resolves the
 * session on the first page load / hard refresh.
 */
function LoadingSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 font-sans text-slate-900">
      <FluidLoadingOrb />
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-slate-900">Random Talks</p>
        <p className="text-xs text-slate-500">Connecting to your session...</p>
      </div>
    </div>
  );
}

const isUserSetupComplete = (p) =>
  Boolean(p?.isProfileComplete || p?.setupCompleted || (p?.username && p?.username.trim().length > 0));

/**
 * ProtectedRoute — redirects unauthenticated users to landing.
 * requireProfile: also redirects to /setup if profile isn't complete yet.
 *
 * SPEC-003: Captures the intended destination in sessionStorage before
 * redirecting to login, enabling seamless post-auth deep-link routing
 * for invite links (/call/:roomId).
 */
const ProtectedRoute = ({ children, requireProfile = false }) => {
  const { user, profile } = useAuth();
  if (!user) {
    // Store intended destination so the user lands there after auth
    const intended = window.location.pathname + window.location.search;
    if (intended && intended !== '/') {
      sessionStorage.setItem('rt_pending_redirect', intended);
    }
    return <Navigate to="/" replace />;
  }
  if (requireProfile && !isUserSetupComplete(profile)) return <Navigate to="/setup" replace />;
  return children;
};

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  // Show loading splash while Firebase resolves auth state on mount.
  // This prevents the redirect flicker on page refresh.
  if (loading) return <LoadingSplash />;

  // Determine where to send an authenticated user on the root route.
  // SPEC-003: Check for pending invite-link redirect stored by ProtectedRoute.
  const pendingRedirect = sessionStorage.getItem('rt_pending_redirect');
  const authedRedirect = (() => {
    if (!isUserSetupComplete(profile)) return '/setup';
    if (pendingRedirect) {
      sessionStorage.removeItem('rt_pending_redirect');
      return pendingRedirect;
    }
    return '/dashboard';
  })();

  return (
    <SpotlightShell>
      <Routes>
        {/* Public landing — if already signed in, skip to the right destination */}
        <Route path="/" element={user ? <Navigate to={authedRedirect} replace /> : <Landing />} />

        {/* Profile setup — accessible even if profile exists (for re-editing) */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <ProfileSetup />
            </ProtectedRoute>
          }
        />

        {/* Main app — requires completed profile */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requireProfile>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Video Call Rooms — supports /call/:roomId and /room/:roomId */}
        <Route
          path="/call/:roomId"
          element={
            <ProtectedRoute requireProfile>
              <RouteErrorBoundary>
                <CallRoom />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/room/:roomId"
          element={
            <ProtectedRoute requireProfile>
              <RouteErrorBoundary>
                <CallRoom />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        />
      </Routes>
    </SpotlightShell>
  );
}

export default function App() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
    });

    let animationFrameId;
    function raf(time) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }
    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
