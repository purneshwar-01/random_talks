import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  SlidersHorizontal,
  Loader2,
  X,
  LogOut,
  Briefcase,
  ShieldCheck,
  PhoneCall,
  MessageSquare,
  Trash2,
  Settings,
  Key,
  Clock,
  Globe,
  BookOpen,
  Gamepad2,
  Mic,
  Coffee,
  AlertTriangle,
  PlayCircle,
  Check,
  Users,
  PhoneOff,
  Compass,
} from 'lucide-react';
import {
  joinQueue,
  leaveQueue,
  tryMatch,
  listenForMatch,
  ensureCallRoom,
  generateOpaqueRoomToken,
} from '../lib/matchmaking';
import { checkIsBanned } from '../lib/moderation';
import SoloTestModal from '../components/SoloTestModal';
import {
  listenToFriends,
  listenToPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from '../lib/friends';
import {
  sendCallInvite,
  listenForIncomingCall,
  listenForCallResponse,
  cancelCallInvite,
} from '../lib/directCalls';
import { dmRoomId } from '../lib/dm';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import PrivateRoomModal from '../components/PrivateRoomModal';
import DmDrawer from '../components/DmDrawer';
import IncomingCallModal from '../components/IncomingCallModal';
import SettingsModal from '../components/SettingsModal';
import CallingOverlay from '../components/CallingOverlay';
import ConnectionLoader from '../components/ConnectionLoader';
import CallHistoryModal from '../components/CallHistoryModal';
import FriendProfileModal from '../components/FriendProfileModal';

const DECLINE_CHIME_URL = 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3';

// Focus Pod modes — professional/student oriented
const FOCUS_MODES = ['professional', 'study', 'language', 'deeptalk'];
// Casual Lounge modes — social / entertainment
const LOUNGE_MODES = ['quicktalk', 'gaming', 'casual', 'voiceonly'];

const MODES = [
  { id: 'quicktalk', label: 'Quick Talk (5-Min)', icon: Clock, description: 'Fast 5-minute timed casual video chat.' },
  { id: 'deeptalk', label: 'Deep Talk', icon: MessageSquare, description: 'Meaningful conversations, philosophy & life topics.' },
  { id: 'professional', label: 'Professional & Tech', icon: Briefcase, description: 'Network with developers, founders & creators.' },
  { id: 'language', label: 'Language Exchange', icon: Globe, description: 'Practice English, Spanish, Hindi & world languages.' },
  { id: 'study', label: 'Study & Work Buddy', icon: BookOpen, description: 'Focus sessions, co-working & homework partners.' },
  { id: 'gaming', label: 'Gaming Buddy', icon: Gamepad2, description: 'Find co-op, FPS & RPG gaming partners.' },
  { id: 'voiceonly', label: 'Voice Only', icon: Mic, description: 'Mic-only audio call with camera disabled.' },
  { id: 'casual', label: 'Casual Coffee', icon: Coffee, description: 'Relaxed, open global stranger chat.' },
];

// ─── Friend Card ─────────────────────────────────────────────────────────────
function FriendCard({ friend, unreadCount, onCall, onMessage, onRemove, onProfile }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/80 transition-all shadow-xs">
      {/* Avatar + Name + occupation (Clickable to inspect public profile) */}
      <div
        onClick={() => onProfile(friend)}
        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer group"
        title="View public profile"
      >
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#14213D] group-hover:bg-[#1E3A8A] flex items-center justify-center text-white font-bold text-sm shadow-xs transition">
            {friend.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-900 group-hover:text-[#FCA311] transition truncate">{friend.username}</p>
          <p className="text-[10px] text-slate-500 truncate">{friend.occupation || 'Friend'}</p>
        </div>
      </div>

      {/* Action tray */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onCall(friend)}
          className="p-1.5 rounded-lg bg-amber-50 text-[#14213D] border border-amber-200 hover:bg-[#FCA311] transition cursor-pointer active:scale-95"
          title="Direct Call"
        >
          <PhoneCall size={13} />
        </button>

        {/* Message button with unread badge */}
        <button
          onClick={() => onMessage(friend)}
          className="relative p-1.5 rounded-lg bg-slate-100 text-[#14213D] border border-slate-200 hover:bg-[#14213D] hover:text-white transition cursor-pointer active:scale-95"
          title="Direct Message"
        >
          <MessageSquare size={13} />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center px-0.5 shadow-sm border border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onRemove(friend)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer active:scale-95"
          title="Remove Friend"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Pending Request Card ─────────────────────────────────────────────────────
function RequestCard({ req, onAccept, onReject }) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const handleAccept = async () => { setAccepting(true); await onAccept(req); setAccepting(false); };
  const handleReject = async () => { setRejecting(true); await onReject(req.id); setRejecting(false); };
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center text-white font-bold text-[11px] shrink-0">
          {req.fromUsername?.charAt(0).toUpperCase() || '?'}
        </div>
        <span className="font-semibold text-slate-800 truncate">{req.fromUsername}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={handleAccept} disabled={accepting || rejecting}
          className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 cursor-pointer active:scale-95" title="Accept">
          {accepting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button onClick={handleReject} disabled={accepting || rejecting}
          className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-red-500 hover:text-white transition disabled:opacity-50 cursor-pointer active:scale-95" title="Decline">
          {rejecting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
        </button>
      </div>
    </div>
  );
}

// ─── Call Declined Toast ──────────────────────────────────────────────────────
function DeclineToast({ calleeName, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] animate-toast-slide-down">
      <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-sans">
        <PhoneOff size={18} className="shrink-0" />
        <div>
          <p className="font-bold text-sm">{calleeName || 'User'} declined your call</p>
          <p className="text-xs text-red-200">They are busy or unavailable right now.</p>
        </div>
        <button onClick={onDismiss} className="ml-2 p-1 rounded-full hover:bg-red-700 transition cursor-pointer">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [matchMode, setMatchMode] = useState(profile?.preferredMode || 'professional');
  const [loungeMode, setLoungeMode] = useState('focus'); // 'focus' | 'casual'
  const [filterGender, setFilterGender] = useState('Any');
  const [searching, setSearching] = useState(false);
  const [searchStatusText, setSearchStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [privateModalOpen, setPrivateModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [soloTestModalOpen, setSoloTestModalOpen] = useState(false);
  const [selectedProfileFriend, setSelectedProfileFriend] = useState(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isFriendsDrawerOpen, setIsFriendsDrawerOpen] = useState(false);

  const [isBanned, setIsBanned] = useState(false);
  const [dmFriend, setDmFriend] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [declineToast, setDeclineToast] = useState(null);
  const [callingFriend, setCallingFriend] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  const pollRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const unsubRef = useRef(null);
  const queueUnsubRef = useRef(null);
  const declineUnsubRef = useRef(null);
  const navigatedRef = useRef(false);
  const searchAttemptsRef = useRef(0);
  const openDmUidRef = useRef(null);
  const podsSectionRef = useRef(null);

  const activeModeObj = MODES.find((m) => m.id === matchMode) || MODES[0];

  // Total unread notifications & pending requests badge count
  const totalUnreadAndRequests =
    Object.values(unreadCounts).reduce((acc, count) => acc + (typeof count === 'number' ? count : 0), 0) +
    pendingRequests.length;

  // ── Cleanup queue on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (user?.uid) leaveQueue(user.uid).catch(() => { });
  }, [user?.uid]);

  // ── Ban check, friends (real-time live profiles), pending requests ───────
  useEffect(() => {
    if (!user) return;
    checkIsBanned(user.uid).then(setIsBanned);
    const unsubFriends = listenToFriends(user.uid, setFriends);
    const unsubRequests = listenToPendingRequests(user.uid, setPendingRequests);
    return () => { unsubFriends(); unsubRequests(); };
  }, [user]);

  // ── DM unread badge counters (one listener per friend) ─────────────────
  useEffect(() => {
    if (!user?.uid || friends.length === 0) return;
    const unsubs = friends.map((friend) => {
      const roomId = dmRoomId(user.uid, friend.uid);
      const q = query(
        collection(db, 'dms', roomId, 'messages'),
        where('senderUid', '==', friend.uid)
      );
      const unsub = onSnapshot(q, (snap) => {
        if (openDmUidRef.current === friend.uid) {
          setUnreadCounts((prev) => ({ ...prev, [friend.uid]: 0 }));
          return;
        }
        setUnreadCounts((prev) => {
          const prevCount = prev[friend.uid] ?? null;
          const newCount = snap.size;
          if (prevCount === null) {
            return { ...prev, [friend.uid]: 0, [`_base_${friend.uid}`]: newCount };
          }
          const base = prev[`_base_${friend.uid}`] ?? newCount;
          return { ...prev, [friend.uid]: Math.max(0, newCount - base) };
        });
      }, () => { });
      return unsub;
    });
    return () => unsubs.forEach((u) => u());
  }, [user?.uid, friends]);

  // ── Global incoming call listener ───────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForIncomingCall(user.uid, setIncomingCall);
    return unsub;
  }, [user?.uid]);

  const searchingRef = useRef(searching);
  useEffect(() => {
    searchingRef.current = searching;
  }, [searching]);

  // ── Cleanup on unmount & Back-Button (popstate) trapping during search ────
  useEffect(() => {
    const handlePopState = () => {
      if (searchingRef.current) {
        stopSearching(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (searchingRef.current) {
        stopSearching(true);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Matchmaking helpers ─────────────────────────────────────────────────
  const stopSearching = (removeFromQueue = true) => {
    setSearching(false);
    setSearchStatusText('');
    searchAttemptsRef.current = 0;
    if (pollRef.current) clearInterval(pollRef.current);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    if (unsubRef.current) unsubRef.current();
    if (queueUnsubRef.current) queueUnsubRef.current();
    if (declineUnsubRef.current) { declineUnsubRef.current(); declineUnsubRef.current = null; }
    pollRef.current = null; debounceTimeoutRef.current = null; unsubRef.current = null; queueUnsubRef.current = null;
    if (removeFromQueue && user) leaveQueue(user.uid).catch(() => { });
  };

  const goToRoom = (roomId, role) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    stopSearching(false);
    const roleQuery = role ? `&role=${role}` : '';
    navigate(`/call/${roomId}?mode=${matchMode}${roleQuery}`, { replace: true });
  };

  const startMatch = async () => {
    console.log('[Dashboard] startMatch clicked. User:', user?.uid, 'Mode:', matchMode);
    if (!user) {
      setErrorMessage('Please sign in to find a partner.');
      return;
    }
    if (isBanned || (profile?.strikeCount && profile.strikeCount >= 3)) {
      setErrorMessage('Your account has been suspended due to community policy strikes.');
      return;
    }
    if (searching) {
      stopSearching(true);
    }
    setErrorMessage('');
    navigatedRef.current = false;
    searchAttemptsRef.current = 0;
    const isLocalhost = typeof window !== 'undefined' && Boolean(
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    );
    setSearching(true);
    setSearchStatusText('Joining matchmaking queue...');
    try {
      const activeUsername = profile?.username || user.displayName || user.email?.split('@')[0] || 'Stranger';
      const activeGender = profile?.gender || 'Any';
      const activeOccupation = profile?.occupation || '';
      const activeAge = profile?.age || null;

      await joinQueue({
        uid: user.uid,
        username: activeUsername,
        gender: activeGender,
        genderFilter: filterGender || 'Any',
        mode: matchMode || 'casual',
        occupation: activeOccupation,
        age: activeAge,
      }).catch((err) => {
        console.warn('[Matchmaking] joinQueue notice:', err);
      });

      let lastAttemptTime = 0;
      const attempt = async () => {
        const now = Date.now();
        if (now - lastAttemptTime < 2500) {
          if (!debounceTimeoutRef.current) {
            debounceTimeoutRef.current = setTimeout(() => {
              debounceTimeoutRef.current = null;
              attempt();
            }, 2500 - (now - lastAttemptTime));
          }
          return;
        }
        lastAttemptTime = now;
        searchAttemptsRef.current += 1;
        const attempts = searchAttemptsRef.current;
        if (attempts <= 4) {
          setSearchStatusText(`Looking for a ${activeModeObj.label} partner...`);
        } else if (attempts <= 8) {
          setSearchStatusText('Expanding search to nearby modes...');
        } else if (isLocalhost) {
          setSearchStatusText('Searching for nearby peers on localhost... (Open an Incognito window to connect)');
        } else {
          setSearchStatusText('Opening to all available strangers...');
        }
        try {
          const roomId = await tryMatch(user.uid, {
            gender: activeGender,
            genderFilter: filterGender || 'Any',
            mode: matchMode || 'casual',
            searchAttemptCount: attempts,
          });
          if (roomId) {
            goToRoom(roomId, 'caller');
          } else if (isLocalhost && attempts >= 2) {
            setSearchStatusText('Searching for nearby peers on localhost... (Open an Incognito window to connect)');
          }
        } catch (err) {
          console.warn('[Matchmaking] attempt notice:', err);
          if (isLocalhost) {
            setSearchStatusText('Searching for nearby peers on localhost... (Open an Incognito window to connect)');
          }
          // Keep searching = true active so ConnectionLoader remains stably visible on screen.
        }
      };

      unsubRef.current = listenForMatch(
        user.uid,
        (roomId) => goToRoom(roomId, 'callee'),
        (err) => {
          console.warn('[Matchmaking] listenForMatch notice:', err);
          if (isLocalhost) {
            setSearchStatusText('Searching for nearby peers on localhost... (Open an Incognito window to connect)');
          }
          // Do NOT abort or call stopSearching(true) on transient error
        },
        () => {
          attempt();
        }
      );

      await attempt();
      // Watchdog fallback polling at 10s protects Firestore read quota from aggressive polling
      pollRef.current = setInterval(attempt, 10000);
    } catch (err) {
      console.warn('[Matchmaking] startMatch notice:', err);
      if (isLocalhost) {
        setSearchStatusText('Searching for nearby peers on localhost... (Open an Incognito window to connect)');
      } else {
        setSearchStatusText('Searching for available peers...');
      }
      // Keep searching = true active. Dismiss only when user clicks onCancel.
    }
  };

  const startPracticeCall = async () => {
    const roomId = `practice_${generateOpaqueRoomToken()}`;
    try {
      await ensureCallRoom(roomId, [user.uid], { isPractice: true, createdBy: user.uid });
    } catch (err) {
      console.error('Solo test room error:', err);
    }
    navigate(`/call/${roomId}?mode=practice`, { replace: true });
  };

  const startDirectCall = async (friend) => {
    const roomId = await sendCallInvite({
      callerUid: user.uid,
      callerName: profile?.username || 'Friend',
      receiverUid: friend.uid,
    });
    try {
      await ensureCallRoom(roomId, [user.uid, friend.uid], { isDirect: true });
    } catch {
      setErrorMessage('Failed to start direct call. Please try again.');
      return;
    }

    setCallingFriend({ ...friend, roomId });

    if (declineUnsubRef.current) declineUnsubRef.current();
    declineUnsubRef.current = listenForCallResponse(friend.uid, (status) => {
      if (status === 'declined') {
        if (declineUnsubRef.current) { declineUnsubRef.current(); declineUnsubRef.current = null; }
        cancelCallInvite(friend.uid).catch(() => { });
        try { new Audio(DECLINE_CHIME_URL).play().catch(() => { }); } catch { /* no-op */ }
        setCallingFriend(null);
        setDeclineToast({ calleeName: friend.username });
      } else if (status === 'gone') {
        if (declineUnsubRef.current) { declineUnsubRef.current(); declineUnsubRef.current = null; }
        setCallingFriend(null);
        navigate(`/call/${roomId}?mode=direct`, { replace: true });
      }
    });
  };

  const cancelOutgoingCall = () => {
    if (!callingFriend) return;
    if (declineUnsubRef.current) { declineUnsubRef.current(); declineUnsubRef.current = null; }
    cancelCallInvite(callingFriend.uid).catch(() => { });
    setCallingFriend(null);
  };

  const openDm = useCallback((friend) => {
    openDmUidRef.current = friend.uid;
    setUnreadCounts((prev) => ({ ...prev, [friend.uid]: 0, [`_base_${friend.uid}`]: prev[`_base_${friend.uid}`] ?? 0 }));
    setDmFriend(friend);
  }, []);

  const closeDm = useCallback(() => {
    openDmUidRef.current = null;
    setDmFriend(null);
  }, []);

  const handleAcceptRequest = async (req) => { await acceptFriendRequest(req); };
  const handleLogout = async () => { await stopSearching(true); await logout(); };

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-slate-800 font-sans relative overflow-x-hidden flex flex-col justify-start lg:justify-center items-center pb-24 lg:pb-8">
      {/* ── Full screen matchmaking loader overlay ────────────────────────── */}
      {searching && (
        <ConnectionLoader
          title={searchStatusText || `Looking for ${activeModeObj.label} partner...`}
          mode={matchMode}
          onCancel={() => stopSearching(true)}
        />
      )}

      {callingFriend && (
        <CallingOverlay friend={callingFriend} onCancel={cancelOutgoingCall} />
      )}

      {/* ── Call Decline Toast ────────────────────────────────────────────── */}
      {declineToast && (
        <DeclineToast calleeName={declineToast.calleeName} onDismiss={() => setDeclineToast(null)} />
      )}

      {/* ── Top Floating Ambient Header / Status Chips ────────────────────── */}
      <header className="w-full max-w-6xl px-4 sm:px-8 pt-4 pb-2 sm:pt-6 flex items-center justify-between shrink-0 z-20">
        {/* Brand identity chip */}
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-[0_2px_10px_rgb(0,0,0,0.03)]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FCA311] animate-pulse" />
          <span className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-tight">RandomTalks</span>
          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">PRO</span>
        </div>



        {/* Right header actions: User Profile quick chip */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={() => setIsProfileDrawerOpen(true)}
            className="flex items-center gap-2.5 p-1 pr-3 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-[0_2px_10px_rgb(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all cursor-pointer active:scale-95"
            title="Open Profile"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[#14213D] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[110px]">{profile?.username || 'User'}</span>
                <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
              </div>
              <span className="text-[10px] text-slate-500 block leading-tight">
                {profile?.totalChatsCount > 0 ? `${profile.trustScore ?? 100}% Trust` : 'New Member'}
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* ── 1. FLOATING VERTICAL NOTCH DOCK (High contrast, crisp icons, clear micro-labels) ── */}
      <nav
        aria-label="Floating Navigation Notch Dock"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-4 lg:top-1/2 lg:-translate-y-1/2 lg:translate-x-0 z-40 rounded-2xl lg:rounded-[28px] bg-[#121417]/95 text-white py-2 px-2.5 sm:px-3 lg:py-3.5 lg:px-2 shadow-2xl flex flex-row lg:flex-col items-center gap-1 sm:gap-1.5 lg:gap-2.5 border border-white/10 backdrop-blur-md transition-all duration-200 lg:w-[78px]"
      >
        {/* 1. Compass Icon ──► "Home" */}
        <button
          onClick={() => podsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl hover:bg-white/10 transition-all duration-150 cursor-pointer active:scale-95 group w-14 lg:w-full"
          aria-label="Home"
        >
          <div className="relative flex items-center justify-center text-[#F8FAFC] group-hover:text-[#FCA311] transition-colors">
            <Compass size={21} className="stroke-[2.2]" />
          </div>
          <span className="text-[10px] tracking-tight font-medium text-slate-300 group-hover:text-white transition-colors leading-none text-center">
            Home
          </span>
        </button>

        {/* 2. Users Icon (with unread badge) ──► "Friends" */}
        <button
          onClick={() => setIsFriendsDrawerOpen((prev) => !prev)}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all duration-150 cursor-pointer active:scale-95 group w-14 lg:w-full ${
            isFriendsDrawerOpen ? 'bg-white/15 text-white ring-1 ring-[#FCA311]/40' : 'hover:bg-white/10 text-slate-300'
          }`}
          aria-label="Friends"
        >
          <div className="relative flex items-center justify-center text-[#F8FAFC] group-hover:text-[#FCA311] transition-colors">
            <Users size={21} className={`stroke-[2.2] ${isFriendsDrawerOpen ? 'text-[#FCA311]' : ''}`} />
            {totalUnreadAndRequests > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[17px] h-[17px] bg-[#FCA311] text-[#121417] text-[9px] font-black rounded-full flex items-center justify-center px-0.5 border-2 border-[#121417] shadow-xs animate-pulse">
                {totalUnreadAndRequests > 9 ? '9+' : totalUnreadAndRequests}
              </span>
            )}
          </div>
          <span className={`text-[10px] tracking-tight font-medium leading-none text-center ${isFriendsDrawerOpen ? 'text-[#FCA311] font-semibold' : 'text-slate-300 group-hover:text-white'}`}>
            Friends
          </span>
        </button>

        {/* 3. Key Icon ──► "Private Room" */}
        <button
          onClick={() => setPrivateModalOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all duration-150 cursor-pointer active:scale-95 group w-14 lg:w-full ${
            privateModalOpen ? 'bg-white/15 text-white ring-1 ring-[#FCA311]/40' : 'hover:bg-white/10 text-slate-300'
          }`}
          aria-label="Private Room"
        >
          <div className="relative flex items-center justify-center text-[#F8FAFC] group-hover:text-[#FCA311] transition-colors">
            <Key size={21} className={`stroke-[2.2] ${privateModalOpen ? 'text-[#FCA311]' : ''}`} />
          </div>
          <span className={`text-[10px] tracking-tight font-medium leading-tight text-center ${privateModalOpen ? 'text-[#FCA311] font-semibold' : 'text-slate-300 group-hover:text-white'}`}>
            Private Room
          </span>
        </button>

        {/* 4. Clock Icon ──► "History" */}
        <button
          onClick={() => setHistoryOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all duration-150 cursor-pointer active:scale-95 group w-14 lg:w-full ${
            historyOpen ? 'bg-white/15 text-white ring-1 ring-[#FCA311]/40' : 'hover:bg-white/10 text-slate-300'
          }`}
          aria-label="History"
        >
          <div className="relative flex items-center justify-center text-[#F8FAFC] group-hover:text-[#FCA311] transition-colors">
            <Clock size={21} className={`stroke-[2.2] ${historyOpen ? 'text-[#FCA311]' : ''}`} />
          </div>
          <span className={`text-[10px] tracking-tight font-medium leading-none text-center ${historyOpen ? 'text-[#FCA311] font-semibold' : 'text-slate-300 group-hover:text-white'}`}>
            History
          </span>
        </button>

        {/* 5. Gear Icon ──► "Settings" */}
        <button
          onClick={() => setSettingsOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-2xl transition-all duration-150 cursor-pointer active:scale-95 group w-14 lg:w-full ${
            settingsOpen ? 'bg-white/15 text-white ring-1 ring-[#FCA311]/40' : 'hover:bg-white/10 text-slate-300'
          }`}
          aria-label="Settings"
        >
          <div className="relative flex items-center justify-center text-[#F8FAFC] group-hover:text-[#FCA311] transition-colors">
            <Settings size={21} className={`stroke-[2.2] ${settingsOpen ? 'text-[#FCA311]' : ''}`} />
          </div>
          <span className={`text-[10px] tracking-tight font-medium leading-none text-center ${settingsOpen ? 'text-[#FCA311] font-semibold' : 'text-slate-300 group-hover:text-white'}`}>
            Settings
          </span>
        </button>

        {/* Divider */}
        <div className="w-8 h-px bg-white/15 my-0.5 hidden lg:block" />
        <div className="h-8 w-px bg-white/15 mx-0.5 lg:hidden" />

        {/* 6. Sign Out Icon ──► "Sign out" */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl hover:bg-red-500/20 transition-all duration-150 cursor-pointer active:scale-95 group w-14 lg:w-full"
          aria-label="Sign out"
        >
          <div className="relative flex items-center justify-center text-[#F8FAFC] group-hover:text-red-400 transition-colors">
            <LogOut size={21} className="stroke-[2.2]" />
          </div>
          <span className="text-[10px] tracking-tight font-medium text-slate-300 group-hover:text-red-400 transition-colors leading-none text-center">
            Sign out
          </span>
        </button>
      </nav>

      {/* ── 2A. LEFT SLIDING FRIENDS DRAWER (Slides from Left Edge, w-80) ── */}
      {isFriendsDrawerOpen && (
        <div
          onClick={() => setIsFriendsDrawerOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity duration-300 animate-fade-in"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] h-full max-h-[100dvh] bg-white border-r border-slate-200/80 p-5 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out shrink-0 overflow-hidden ${
          isFriendsDrawerOpen ? 'translate-x-0 animate-slide-right' : '-translate-x-full pointer-events-none'
        }`}
      >
        {/* Friends Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#FCA311] border border-amber-200/60 flex items-center justify-center font-bold">
              <Users size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Friends &amp; Circle</h3>
              <p className="text-[10px] text-slate-500 font-medium">{friends.length} Connected</p>
            </div>
          </div>
          <button
            onClick={() => setIsFriendsDrawerOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer active:scale-95"
            aria-label="Close friends drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Friends & Requests Container */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden my-3">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
            {/* Incoming friend requests */}
            {pendingRequests.length > 0 && (
              <div className="mb-3 space-y-1.5 pb-2 border-b border-slate-100">
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center justify-between">
                  <span>Friend Requests</span>
                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                    {pendingRequests.length}
                  </span>
                </div>
                {pendingRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    onAccept={handleAcceptRequest}
                    onReject={rejectFriendRequest}
                  />
                ))}
              </div>
            )}

            {friends.length === 0 ? (
              <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl text-center space-y-2 my-auto">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <Users size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-700">No friends connected yet</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Send friend requests in call rooms to expand your network!
                </p>
              </div>
            ) : (
              friends.map((f) => (
                <FriendCard
                  key={f.uid}
                  friend={f}
                  unreadCount={unreadCounts[f.uid] ?? 0}
                  onCall={startDirectCall}
                  onMessage={openDm}
                  onProfile={(fr) => setSelectedProfileFriend(fr)}
                  onRemove={(fr) => removeFriend(user.uid, fr.uid)}
                />
              ))
            )}
          </div>
        </div>

        {/* Friends Drawer Footer Actions */}
        <div className="pt-3 border-t border-slate-100 shrink-0 space-y-1.5">
          <button
            onClick={() => {
              setIsFriendsDrawerOpen(false);
              setPrivateModalOpen(true);
            }}
            className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl px-3 py-2 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Key size={14} className="text-[#FCA311]" />
            <span>Join Private Code Room</span>
          </button>
        </div>
      </aside>

      {/* ── 2B. RIGHT SLIDING USER PROFILE DRAWER (Slides strictly from Right Edge, w-80) ── */}
      {isProfileDrawerOpen && (
        <div
          onClick={() => setIsProfileDrawerOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity duration-300 animate-fade-in"
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] h-full max-h-[100dvh] bg-white border-l border-slate-200/80 p-5 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out shrink-0 overflow-hidden ${
          isProfileDrawerOpen ? 'translate-x-0 animate-slide-left' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* Profile Drawer Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Account &amp; Profile</h3>
              <p className="text-[10px] text-slate-500 font-medium">Member Settings</p>
            </div>
          </div>
          <button
            onClick={() => setIsProfileDrawerOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer active:scale-95"
            aria-label="Close profile drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile Card & Details */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-center space-y-2">
            <div className="relative inline-block mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#14213D] text-white flex items-center justify-center font-extrabold text-2xl shadow-md mx-auto">
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="font-extrabold text-slate-900 text-base">{profile?.username || 'User'}</h4>
                <ShieldCheck size={16} className="text-emerald-600" />
              </div>
              <p className="text-slate-500 text-xs font-medium">{profile?.occupation || 'Member'}</p>
            </div>

            {/* Badges */}
            <div className="flex items-center justify-center gap-2 pt-1 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                {profile?.trustScore ?? 100}% Trust
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold text-[10px]">
                {profile?.country || 'Global'}
              </span>
            </div>
          </div>

          {/* Ban Warning */}
          {isBanned && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <AlertTriangle size={13} /> Account Suspended
              </p>
              <p className="text-[11px]">3 policy strikes. You cannot match until reviewed.</p>
            </div>
          )}

          {/* Quick Profile Actions List */}
          <div className="space-y-1.5">
            <button
              onClick={() => {
                setIsProfileDrawerOpen(false);
                setSoloTestModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer text-xs font-semibold"
            >
              <span className="flex items-center gap-2.5">
                <PlayCircle size={16} className="text-[#FCA311]" /> Hardware &amp; Solo Test
              </span>
              <span className="text-[10px] text-slate-400">Preview</span>
            </button>

            <button
              onClick={() => {
                setIsProfileDrawerOpen(false);
                setHistoryOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer text-xs font-semibold"
            >
              <span className="flex items-center gap-2.5">
                <Clock size={16} className="text-blue-500" /> Call History &amp; Notes
              </span>
              <span className="text-[10px] text-slate-400">View</span>
            </button>

            <button
              onClick={() => {
                setIsProfileDrawerOpen(false);
                setSettingsOpen(true);
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 transition cursor-pointer text-xs font-semibold"
            >
              <span className="flex items-center gap-2.5">
                <Settings size={16} className="text-slate-600" /> Account &amp; Safety Settings
              </span>
              <span className="text-[10px] text-slate-400">Edit</span>
            </button>
          </div>
        </div>

        {/* Profile Footer Sign Out */}
        <div className="pt-3 border-t border-slate-100 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── 3. MAIN STAGE WITH GENEROUS BREATHING ROOM & SOFT TACTILE CLAY CARDS ── */}
      <main
        ref={podsSectionRef}
        className="w-full max-w-4xl px-4 sm:px-6 my-auto flex flex-col items-center justify-center space-y-6 sm:space-y-8 animate-fade-in z-10"
      >
        {/* Floating Category Switcher Pills at the top */}
        <div className="flex items-center justify-center pt-2">
          <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-full border border-slate-200/80 shadow-[0_4px_20px_rgb(0,0,0,0.03)] inline-flex gap-1.5">
            <button
              onClick={() => {
                setLoungeMode('focus');
                if (!FOCUS_MODES.includes(matchMode)) setMatchMode('professional');
              }}
              className={`flex items-center gap-2 transition-all cursor-pointer rounded-full px-5 py-2 text-xs sm:text-sm font-semibold active:scale-95 ${
                loungeMode === 'focus'
                  ? 'bg-[#121417] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <span>⚡</span> Focus Pods
              <span className={`hidden sm:inline text-[11px] font-normal ${loungeMode === 'focus' ? 'text-white/70' : 'text-slate-400'}`}>
                — Dev, Study, Language
              </span>
            </button>
            <button
              onClick={() => {
                setLoungeMode('casual');
                if (!LOUNGE_MODES.includes(matchMode)) setMatchMode('casual');
              }}
              className={`flex items-center gap-2 transition-all cursor-pointer rounded-full px-5 py-2 text-xs sm:text-sm font-semibold active:scale-95 ${
                loungeMode === 'casual'
                  ? 'bg-[#121417] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <span>☕</span> Casual Lounge
              <span className={`hidden sm:inline text-[11px] font-normal ${loungeMode === 'casual' ? 'text-white/70' : 'text-slate-400'}`}>
                — Social, Games, Banter
              </span>
            </button>
          </div>
        </div>

        {/* Discovery Hero Heading */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-[#14213D] border border-amber-200/70 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#FCA311]" />
            <span>Global Stranger &amp; Friends Discovery</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Purpose-Based Discovery
          </h1>
          <p className="text-slate-500 font-medium leading-relaxed text-xs sm:text-sm max-w-lg mx-auto">
            Select your conversation goal to match with strangers who share the exact same intent.
          </p>
        </div>

        {/* Purpose Discovery Clay Cards: Deep Talk, Professional & Tech, Language Exchange, Study Buddy */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full text-left">
          {MODES.filter((m) =>
            loungeMode === 'focus' ? FOCUS_MODES.includes(m.id) : LOUNGE_MODES.includes(m.id)
          ).map((mode) => {
            const Icon = mode.icon;
            const active = matchMode === mode.id;
            return (
              <button
                key={mode.id}
                disabled={searching}
                onClick={() => setMatchMode(mode.id)}
                className={`group relative p-4 sm:p-5 rounded-3xl border text-left transition-all duration-200 flex flex-col justify-between min-h-36 sm:min-h-40 cursor-pointer ${
                  active
                    ? 'bg-white border-[#FCA311] shadow-[0_12px_32px_rgba(252,163,17,0.16)] ring-2 ring-[#FCA311]/25 -translate-y-1'
                    : 'bg-white border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-md hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-colors ${
                      active
                        ? 'bg-[#FCA311] text-[#14213D] shadow-xs'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200/70'
                    }`}
                  >
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  {active ? (
                    <span className="w-5 h-5 rounded-full bg-[#14213D] text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-200 bg-slate-50/60 group-hover:border-slate-300 transition-colors" />
                  )}
                </div>
                <div>
                  <h4 className="text-slate-900 font-bold text-xs sm:text-sm mb-1 tracking-tight">
                    {mode.label}
                  </h4>
                  <p className="text-slate-500 text-[11px] sm:text-xs font-normal leading-relaxed line-clamp-2">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* 3. Filter & CTA Clay Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 space-y-6 max-w-2xl w-full">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-sm text-slate-700">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-[#FCA311]">
                <SlidersHorizontal size={15} />
              </div>
              <span className="font-semibold text-slate-900 text-xs sm:text-sm">Filter Gender:</span>
              <select
                value={filterGender}
                disabled={searching}
                className="border border-slate-200/80 text-slate-900 text-xs sm:text-sm rounded-xl px-3.5 py-2 bg-slate-50/80 hover:bg-slate-50 focus:outline-none focus:border-[#FCA311] focus:ring-2 focus:ring-[#FCA311]/20 disabled:opacity-50 cursor-pointer transition font-medium"
                onChange={(e) => setFilterGender(e.target.value)}
              >
                <option value="Any">Any Gender</option>
                <option value="Female">Female Only</option>
                <option value="Male">Male Only</option>
              </select>
            </div>

            <button
              onClick={() => setSoloTestModalOpen(true)}
              disabled={searching}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <PlayCircle size={15} className="text-slate-500" />
              <span>Solo Device Test</span>
            </button>
          </div>

          {errorMessage && (
            <div className="text-xs text-red-700 font-semibold bg-red-50 p-3.5 rounded-2xl border border-red-200 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={startMatch}
            disabled={isBanned}
            className="group relative h-14 px-8 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-extrabold text-base shadow-[0_12px_28px_-4px_rgba(252,163,17,0.4)] hover:shadow-[0_16px_32px_-4px_rgba(252,163,17,0.5)] transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 w-full sm:w-auto mx-auto select-none"
          >
            <Video className="group-hover:scale-110 transition duration-200" size={20} />
            <span className="tracking-tight">Find Partner for {activeModeObj.label}</span>
          </button>
        </div>
      </main>

      {/* ── Modals & Drawers ──────────────────────────────────────────────── */}
      {privateModalOpen && (
        <PrivateRoomModal user={user} profile={profile} onClose={() => setPrivateModalOpen(false)} />
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {historyOpen && <CallHistoryModal onClose={() => setHistoryOpen(false)} />}

      {soloTestModalOpen && (
        <SoloTestModal
          isOpen={soloTestModalOpen}
          onClose={() => setSoloTestModalOpen(false)}
          user={user}
          profile={profile}
          onEnterRoom={startPracticeCall}
        />
      )}

      {dmFriend && (
        <DmDrawer myUid={user.uid} friend={dmFriend} onClose={closeDm} />
      )}

      {selectedProfileFriend && (
        <FriendProfileModal
          targetUid={selectedProfileFriend.uid}
          initialProfile={selectedProfileFriend}
          myUid={user?.uid}
          myUsername={profile?.username}
          onClose={() => setSelectedProfileFriend(null)}
        />
      )}



      <IncomingCallModal invite={incomingCall} myUid={user?.uid} />
    </div>
  );
}
