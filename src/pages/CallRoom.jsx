import { useCallback, useEffect, useRef, useState, Component } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Sparkles,
  MessageCircle,
  Flag,
  X,
  Check,
  ShieldCheck,
  Zap,
  Clock,
  Lock,
  Monitor,
  FileText,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  User,
  CheckCircle2,
  PlayCircle,
  LogOut,
  LayoutGrid,
  Columns,
  Copy,
  Link2,
  Rocket,
  Users,
} from 'lucide-react';
import {
  leaveQueue,
  joinQueue,
  tryMatch,
  listenForMatch,
  markCallEnded,
  listenForCallEnd,
} from '../lib/matchmaking';
import { blockUser, reportUser } from '../lib/moderation';
import { saveCallRecord, updateCallNotesByRoom } from '../lib/callHistory';
import { generateIcebreaker } from '../lib/geminiIcebreaker';
import ChatPanel from '../components/ChatPanel';
import ReportModal from '../components/ReportModal';
import FeedbackModal from '../components/FeedbackModal';
import NetworkingModal from '../components/NetworkingModal';
import FriendProfileModal from '../components/FriendProfileModal';

// Framer Motion spring physics calibrated to Law 31
const springTransition = { type: 'spring', stiffness: 380, damping: 30 };

const QUICK_TALK_SECONDS = 5 * 60; // 5 mins
const END_CHIME = 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

// ── React Error Boundary to prevent White Screen of Death ────────────────────
class CallRoomErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CallRoom ErrorBoundary] Caught render crash:', error, errorInfo);
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
              <h3 className="text-xl font-extrabold text-white">Call Session Recovered</h3>
              <p className="text-xs text-slate-300">
                A rendering glitch occurred. Click below to reload the session or return to dashboard.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 rounded-xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-extrabold text-xs shadow-lg transition cursor-pointer"
              >
                Reload Room
              </button>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 transition cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper to extract the other peer's UID from roomId: uidA_uidB_timestamp
function parseOtherUid(roomId, myUid, fallbackParticipants = []) {
  if (!roomId) return null;
  if (roomId.startsWith('practice_') || roomId.startsWith('solo_')) {
    return null;
  }
  if (Array.isArray(fallbackParticipants) && fallbackParticipants.length > 0) {
    const found = fallbackParticipants.find((id) => id && id !== myUid);
    if (found) return found;
  }
  const parts = roomId.split('_');
  if (parts.length >= 2) {
    const candidateA = parts[0];
    const candidateB = parts[1];
    if (candidateA && candidateA !== myUid && !candidateA.startsWith('private')) return candidateA;
    if (candidateB && candidateB !== myUid && !candidateB.startsWith('private')) return candidateB;
    if (candidateA === myUid && candidateB === myUid) return myUid;
  }
  return null;
}

function CallRoomInner() {
  const { roomId: initialRoomId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = (searchParams?.get('mode') || 'casual').toLowerCase();

  const safeRoomId = initialRoomId || 'practice_room';
  const isSoloTest = Boolean(
    safeRoomId.startsWith('practice_') ||
    safeRoomId.startsWith('solo_') ||
    mode === 'practice' ||
    mode === 'solo'
  );
  const isPrivateRoom = Boolean(
    safeRoomId.startsWith('private_') ||
    mode === 'group' ||
    mode === 'private'
  );
  const isVoiceOnly = Boolean(!isSoloTest && !isPrivateRoom && mode === 'voiceonly');
  const isStrangerCall = Boolean(!isSoloTest && !isPrivateRoom && !isVoiceOnly);

  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [currentRoomId, setCurrentRoomId] = useState(safeRoomId);
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'spotlight'
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync currentRoomId when URL param initialRoomId changes on navigation / rematch
  useEffect(() => {
    setIsSearchingNext(false);
    setStrangerLeftOpen(false);
    isExplicitlyLeavingRef.current = false;
    if (initialRoomId && initialRoomId !== currentRoomId) {
      setCurrentRoomId(initialRoomId);
    }
  }, [initialRoomId, currentRoomId]);

  // Video and Media Stream Refs & State (state ensures React re-renders when tracks attach)
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const recognitionRef = useRef(null);
  const disconnectTimeoutRef = useRef(null);

  const [roomParticipants, setRoomParticipants] = useState([]);
  const [participantProfiles, setParticipantProfiles] = useState({});

  const [localStreamState, setLocalStreamState] = useState(null);
  const [remoteStreamState, setRemoteStreamState] = useState(null);

  // Audio Level Analyzers
  const [micVolume, setMicVolume] = useState(0); // 0-100
  const [remoteVolume, setRemoteVolume] = useState(0); // 0-100

  // Matchmaking / binge auto-next state
  const [isSearchingNext, setIsSearchingNext] = useState(false);
  const matchPollRef = useRef(null);
  const matchUnsubRef = useRef(null);
  const queueUnsubRef = useRef(null);
  const searchAttemptsRef = useRef(0);

  // Stranger disconnect prompt state (Case B)
  const [strangerLeftOpen, setStrangerLeftOpen] = useState(false);

  // Call tracking & history
  const callDurationRef = useRef(0);
  const callTimerRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const otherUidRef = useRef(null);
  const otherProfileRef = useRef(null);
  const notesRef = useRef('');
  const hasSavedCallRef = useRef(false);
  const isExplicitlyLeavingRef = useRef(false);

  // UI state
  const [icebreaker, setIcebreaker] = useState('');
  const [generatingIcebreaker, setGeneratingIcebreaker] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [isRemoteConnected, setIsRemoteConnected] = useState(isSoloTest);
  const [otherUid, setOtherUid] = useState(() => parseOtherUid(safeRoomId, user?.uid));
  const [otherProfile, setOtherProfile] = useState(null);

  // Keep otherUid synced when room changes
  useEffect(() => {
    const parsed = parseOtherUid(currentRoomId, user?.uid);
    if (parsed) {
      setOtherUid(parsed);
      otherUidRef.current = parsed;
    }
  }, [currentRoomId, user?.uid]);
  const [chatOpen, setChatOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [inspectingUser, setInspectingUser] = useState(null);
  const [networkingOpen, setNetworkingOpen] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [roomFullBlocked, setRoomFullBlocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(mode === 'quicktalk' ? QUICK_TALK_SECONDS : null);
  const [callError, setCallError] = useState('');

  // Hardware controls state — single-state camera pipeline (Law 12 compliant)
  const [micEnabled, setMicEnabled] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(!isVoiceOnly && mode !== 'voiceonly');
  const [screenSharing, setScreenSharing] = useState(false);

  // Quick Notes scratchpad
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saveNoteStatus, setSaveNoteStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

  const activeRemoteStream = remoteStreamState || remoteStreamRef.current;
  const isRemoteVideoActive =
    isRemoteConnected &&
    Boolean(
      activeRemoteStream &&
      (activeRemoteStream.getVideoTracks?.()?.length || 0) > 0 &&
      activeRemoteStream.getVideoTracks()[0]?.enabled !== false
    );

  // Active speaker detection state (calibrated Web Audio RMS volume > 15)
  const isLocalSpeaking = Boolean(micEnabled && micVolume > 15);
  const isRemoteSpeaking = Boolean(isRemoteConnected && remoteVolume > 15);

  // Dynamic peer count evaluation: local user + connected remote peer(s)
  // Dynamic peer count evaluation — capped at 3 per SPEC-003
  const totalActivePeers = (() => {
    if (isSoloTest) return 1;
    if (!isRemoteConnected || isSearchingNext) return 1;
    if (roomParticipants.length > 2) {
      return Math.min(3, Math.max(2, roomParticipants.length));
    }
    return 2;
  })();

  // Solid Amber glowing border for active speaker (Feature B.01)
  const getSpeakerBorderClass = (isSpeaking) =>
    isSpeaking
      ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/50'
      : 'border-white/10 shadow-2xl';

  // CSS Grid auto-packing matrix (Feature B.01)
  const getGridContainerClass = () => {
    if (totalActivePeers === 1) {
      return 'w-full h-full flex items-center justify-center p-2';
    }
    if (totalActivePeers === 2) {
      return 'w-full h-full grid grid-cols-1 md:grid-cols-2 gap-4';
    }
    if (totalActivePeers === 3 || totalActivePeers === 4) {
      return 'w-full h-full grid grid-cols-2 grid-rows-2 gap-3';
    }
    return 'w-full h-full grid grid-cols-3 grid-rows-2 gap-2.5';
  };

  // Reset single-save guard when roomId changes
  useEffect(() => {
    hasSavedCallRef.current = false;
  }, [currentRoomId]);

  // Keep refs in sync for teardown callbacks
  useEffect(() => {
    if (otherUid) otherUidRef.current = otherUid;
  }, [otherUid]);
  useEffect(() => {
    if (otherProfile) otherProfileRef.current = otherProfile;
  }, [otherProfile]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Reactive stream assignment: guarantees localVideoRef and screenVideoRef get streams
  useEffect(() => {
    const localCamStream = localStreamState || localStreamRef.current;
    if (localVideoRef.current && localCamStream) {
      if (localVideoRef.current.srcObject !== localCamStream) {
        localVideoRef.current.srcObject = localCamStream;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.volume = 0;
      localVideoRef.current.play().catch(() => {});
    }

    if (screenVideoRef.current && screenStreamRef.current) {
      if (screenVideoRef.current.srcObject !== screenStreamRef.current) {
        screenVideoRef.current.srcObject = screenStreamRef.current;
      }
      screenVideoRef.current.muted = true;
      screenVideoRef.current.volume = 0;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [localStreamState, screenSharing, isCameraOn, currentRoomId, layoutMode]);

  // Reactive remote stream assignment: guarantees remoteVideoRef receives active remote stream
  useEffect(() => {
    const stream = remoteStreamState || remoteStreamRef.current;
    if (remoteVideoRef.current && stream) {
      if (remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStreamState, isRemoteVideoActive, isRemoteConnected, currentRoomId, layoutMode]);

  // ── Unmount Cleanup: Commit Call Record on Browser Back / Tab Close ──────
  useEffect(() => {
    return () => {
      if (!hasSavedCallRef.current && user?.uid && !isSoloTest) {
        const durationSeconds = callStartTimeRef.current
          ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
          : callDurationRef.current;
        if (durationSeconds >= 2) {
          hasSavedCallRef.current = true;
          saveCallRecord({
            userId: user.uid,
            strangerName: otherProfileRef.current?.username || 'Stranger',
            strangerUid: otherUidRef.current || 'unknown',
            roomId: currentRoomId,
            mode,
            duration: durationSeconds,
            notes: notesRef.current || notes || '',
          }).catch(() => {});
        }
      }
    };
  }, [user?.uid, isSoloTest, currentRoomId, mode, notes]);

  // Clean up any ongoing match searches when unmounting
  useEffect(() => {
    return () => {
      if (matchPollRef.current) clearInterval(matchPollRef.current);
      if (matchUnsubRef.current) matchUnsubRef.current();
      if (queueUnsubRef.current) queueUnsubRef.current();
    };
  }, []);

  // ── Call Duration Tracking ──────────────────────────────────────────────
  useEffect(() => {
    callDurationRef.current = 0;
    if (isSearchingNext || strangerLeftOpen) return;

    if (otherUid || isSoloTest || isPrivateRoom) {
      if (!callStartTimeRef.current) {
        callStartTimeRef.current = Date.now();
      }
    }

    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1;
    }, 1000);

    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [currentRoomId, isSearchingNext, strangerLeftOpen, otherUid, isSoloTest, isPrivateRoom]);

  // ── Helper to log history if duration >= 2s (Single-Save Guarded) ─────────
  const logCurrentCallHistory = useCallback(async () => {
    if (hasSavedCallRef.current) return;

    const durationSeconds = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : callDurationRef.current;
    callStartTimeRef.current = null;

    if (!user?.uid || isSoloTest || durationSeconds < 2) return;

    hasSavedCallRef.current = true;
    try {
      await saveCallRecord({
        userId: user.uid,
        strangerName: otherProfileRef.current?.username || otherProfile?.username || 'Stranger',
        strangerUid: otherUidRef.current || otherUid || 'unknown',
        roomId: currentRoomId,
        mode,
        duration: durationSeconds,
        notes: notesRef.current || notes || '',
      });
    } catch (err) {
      console.error('[CallRoom] logCurrentCallHistory error:', err);
    }
  }, [user?.uid, isSoloTest, currentRoomId, mode, otherProfile, otherUid, notes]);

  // ── Real-Time Mic Audio Level Meter (Web Audio API) ──────────────────────
  useEffect(() => {
    if (
      !localStreamRef.current ||
      !micEnabled ||
      (localStreamRef.current.getAudioTracks?.()?.length || 0) === 0
    ) {
      setMicVolume(0);
      return;
    }
    let animationFrameId;
    let audioContext = null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(localStreamRef.current);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / (dataArray.length || 1);
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      }
    } catch {
      /* AudioContext gesture fallback */
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [micEnabled, currentRoomId, isSearchingNext, localStreamState]);

  // ── Real-Time Remote Audio Level Meter ──────────────────────────────────
  useEffect(() => {
    if (
      !remoteStreamRef.current ||
      !isRemoteConnected ||
      (remoteStreamRef.current.getAudioTracks?.()?.length || 0) === 0
    ) {
      setRemoteVolume(0);
      return;
    }
    let animationFrameId;
    let audioContext = null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(remoteStreamRef.current);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateRemoteVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / (dataArray.length || 1);
          setRemoteVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameId = requestAnimationFrame(updateRemoteVolume);
        };
        updateRemoteVolume();
      }
    } catch {
      /* AudioContext gesture fallback */
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [isRemoteConnected, otherUid, remoteStreamState]);

  // ── Clean up media streams and WebRTC instances ────────────────────────
  const teardownMediaTracks = useCallback(() => {
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks?.().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* best effort */
          }
        });
      } catch {
        /* best effort */
      }
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks?.().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* best effort */
          }
        });
      } catch {
        /* best effort */
      }
      screenStreamRef.current = null;
    }

    if (remoteStreamRef.current) {
      try {
        remoteStreamRef.current.getTracks?.().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* best effort */
          }
        });
      } catch {
        /* best effort */
      }
      remoteStreamRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* best effort */
      }
      pcRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setLocalStreamState(null);
    setRemoteStreamState(null);
  }, []);

  // ── Stop match search polling ───────────────────────────────────────────
  const stopMatchSearch = useCallback(() => {
    if (matchPollRef.current) clearInterval(matchPollRef.current);
    if (matchUnsubRef.current) matchUnsubRef.current();
    if (queueUnsubRef.current) queueUnsubRef.current();
    matchPollRef.current = null;
    matchUnsubRef.current = null;
    queueUnsubRef.current = null;
    searchAttemptsRef.current = 0;
    if (user?.uid) leaveQueue(user.uid).catch(() => {});
  }, [user?.uid]);

  // ── Handle Remote Partner Disconnect (Case B) with Debounce Guard ───────
  const handleRemotePartnerDisconnected = useCallback(() => {
    if (isSearchingNext || isSoloTest || isPrivateRoom || isExplicitlyLeavingRef.current) return;

    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }

    setIsRemoteConnected(false);
    setChatOpen(false);

    // Log history of the session that just finished
    logCurrentCallHistory();

    // Play disconnect audio chime
    try {
      new Audio(END_CHIME).play().catch(() => {});
    } catch {
      /* no-op */
    }

    // Teardown active media tracks so the old feed doesn't freeze or lock webcam
    teardownMediaTracks();

    // Open Stranger Left dialog (Matchmaking is paused until user chooses action)
    setStrangerLeftOpen(true);
  }, [isSearchingNext, isSoloTest, isPrivateRoom, logCurrentCallHistory, teardownMediaTracks]);

  // ── Debounced Disconnect Scheduler ──────────────────────────────────────
  const scheduleDisconnect = useCallback(() => {
    if (disconnectTimeoutRef.current || isExplicitlyLeavingRef.current) return;
    disconnectTimeoutRef.current = setTimeout(() => {
      disconnectTimeoutRef.current = null;
      if (!isSoloTest && !isPrivateRoom && !isExplicitlyLeavingRef.current) {
        handleRemotePartnerDisconnected();
      }
    }, 2000);
  }, [isSoloTest, isPrivateRoom, handleRemotePartnerDisconnected]);

  const cancelDisconnect = useCallback(() => {
    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
      disconnectTimeoutRef.current = null;
    }
  }, []);

  // ── Continuous Binge Chatting: Find & Connect to Next Stranger ───────────
  const handleNextStranger = useCallback(async () => {
    if (isSoloTest || isPrivateRoom) return;

    // 1. Immediately mark current room ended in Firestore so peer receives notice without latency
    markCallEnded(currentRoomId).catch(() => {});

    // 2. Log previous call history in background without blocking matchmaking flow
    logCurrentCallHistory().catch(() => {});

    // 3. Teardown active call media and start matching loader
    teardownMediaTracks();
    setStrangerLeftOpen(false);
    setOtherUid(null);
    setIsRemoteConnected(false);
    setOtherProfile(null);
    setIcebreaker('');
    setSubtitle('');
    setChatOpen(false);
    setNotes('');
    setIsSearchingNext(true);

    // 4. Release webcam hardware lock (350ms OS camera driver release)
    await new Promise((resolve) => setTimeout(resolve, 350));

    // 5. Start matchmaking queue
    if (!user?.uid || !profile) return;
    try {
      stopMatchSearch();
      await joinQueue({
        uid: user.uid,
        username: profile.username || 'Stranger',
        gender: profile.gender || 'Any',
        genderFilter: 'Any',
        mode,
        occupation: profile.occupation || '',
        age: profile.age,
      });

      // Polling & real-time tryMatch attempt
      const attemptMatch = async () => {
        searchAttemptsRef.current += 1;
        try {
          const matchedRoom = await tryMatch(user.uid, {
            gender: profile.gender || 'Any',
            genderFilter: 'Any',
            mode,
            searchAttemptCount: searchAttemptsRef.current,
          });
          if (matchedRoom) {
            stopMatchSearch();
            setIsSearchingNext(false);
            setStrangerLeftOpen(false);
            setCurrentRoomId(matchedRoom);
            navigate(`/call/${matchedRoom}?mode=${mode}&role=caller`, { replace: true });
          }
        } catch (e) {
          console.error('[CallRoom] tryMatch attempt error:', e);
        }
      };

      // Real-time listener for incoming match + queue activity
      matchUnsubRef.current = listenForMatch(
        user.uid,
        (newRoomId) => {
          stopMatchSearch();
          setIsSearchingNext(false);
          setStrangerLeftOpen(false);
          setCurrentRoomId(newRoomId);
          navigate(`/call/${newRoomId}?mode=${mode}&role=callee`, { replace: true });
        },
        (err) => console.error('[CallRoom] listenForMatch error:', err),
        () => {
          attemptMatch();
        }
      );

      await attemptMatch();
      matchPollRef.current = setInterval(attemptMatch, 1500);
    } catch (err) {
      console.error('[CallRoom] handleNextStranger matchmaking error:', err);
      setIsSearchingNext(false);
      setCallError('Matchmaking error. Please try again.');
    }
  }, [
    isSoloTest,
    isPrivateRoom,
    logCurrentCallHistory,
    currentRoomId,
    teardownMediaTracks,
    user?.uid,
    profile,
    mode,
    stopMatchSearch,
    navigate,
  ]);

  // ── Explicit Leave Call ─────────────────────────────────────────────────
  const leaveCallExplicit = useCallback(async () => {
    isExplicitlyLeavingRef.current = true;
    setStrangerLeftOpen(false);
    setChatOpen(false);
    markCallEnded(currentRoomId).catch(() => {});
    logCurrentCallHistory().catch(() => {});
    stopMatchSearch();
    teardownMediaTracks();

    if (!isPrivateRoom && !isSoloTest && (otherUidRef.current || otherUid)) {
      setFeedbackOpen(true);
    } else if (!isSoloTest) {
      setNetworkingOpen(true);
    } else {
      navigate('/dashboard');
    }
  }, [logCurrentCallHistory, stopMatchSearch, currentRoomId, teardownMediaTracks, isPrivateRoom, isSoloTest, otherUid, navigate]);

  const handleRemotePartnerDisconnectedRef = useRef(handleRemotePartnerDisconnected);
  useEffect(() => {
    handleRemotePartnerDisconnectedRef.current = handleRemotePartnerDisconnected;
  }, [handleRemotePartnerDisconnected]);

  // ── Remote Call-End / Stranger Disconnect Listener (Immediate on explicit end) ──
  useEffect(() => {
    if (!currentRoomId || isSoloTest || isSearchingNext) return;

    const unsub = listenForCallEnd(currentRoomId, () => {
      if (handleRemotePartnerDisconnectedRef.current) {
        handleRemotePartnerDisconnectedRef.current();
      }
    });

    return unsub;
  }, [currentRoomId, isSoloTest, isSearchingNext]);

  // ── Real-time Callee/Caller Signaling & Participant Profile Listener ─────
  useEffect(() => {
    if (!user || !currentRoomId || isSearchingNext) return;

    if (isSoloTest) {
      setIsRemoteConnected(true);
      return;
    }

    let isMounted = true;

    // Real-time onSnapshot listener on /calls/{currentRoomId}
    const unsub = onSnapshot(
      doc(db, 'calls', currentRoomId),
      async (snap) => {
        if (!isMounted) return;
        const callData = snap.data();
        if (!snap.exists() || !callData) {
          // Waiting for caller to initialize the call document
          return;
        }

        // Check if call ended explicitly in Firestore
        if (callData.isEnded || callData.status === 'ended') {
          if (handleRemotePartnerDisconnectedRef.current) {
            handleRemotePartnerDisconnectedRef.current();
          }
          return;
        }

        const participants = callData.participants || [];

        // SPEC-003: Room capacity guard — max 3 participants
        if (
          isMounted &&
          participants.length >= 3 &&
          !participants.includes(user.uid)
        ) {
          setRoomFullBlocked(true);
          return;
        }

        if (isMounted) {
          setRoomParticipants(participants);
          if (Array.isArray(participants) && participants.length > 0) {
            participants.forEach(async (pUid) => {
              if (pUid && pUid !== user?.uid) {
                try {
                  const uSnap = await getDoc(doc(db, 'users', pUid));
                  if (isMounted && uSnap.exists()) {
                    setParticipantProfiles((prev) => ({ ...prev, [pUid]: uSnap.data() }));
                  }
                } catch {
                  /* ignore */
                }
              }
            });
          }
        }
        const other = participants.find((id) => id !== user.uid) || parseOtherUid(currentRoomId, user.uid, participants);

        if (other) {
          setOtherUid(other);
          otherUidRef.current = other;
          if (!callStartTimeRef.current) {
            callStartTimeRef.current = Date.now();
          }

          // Transition to room stage once partner is confirmed
          setTimeout(() => {
            if (isMounted) setIsRemoteConnected(true);
          }, 2500);

          try {
            const userSnap = await getDoc(doc(db, 'users', other));
            if (isMounted && userSnap.exists()) {
              const uData = userSnap.data();
              setOtherProfile(uData);
              otherProfileRef.current = uData;
            }
          } catch (err) {
            console.error('[CallRoom] Error fetching other user profile:', err);
          }
        }
      },
      (err) => {
        console.error('[CallRoom] onSnapshot error on call room:', err);
      }
    );

    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentRoomId, user, isSearchingNext, isSoloTest, handleRemotePartnerDisconnected]);

  // ── 5-Minute Timer for Quick Talk ───────────────────────────────────────
  useEffect(() => {
    if (mode !== 'quicktalk' || timeLeft === null || isSearchingNext || strangerLeftOpen) return;
    if (timeLeft <= 0) {
      leaveCallExplicit();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => clearInterval(timer);
  }, [leaveCallExplicit, mode, timeLeft, isSearchingNext, strangerLeftOpen]);

  // ── Universal Media Stream Acquisition ──────────────────────────────────
  const safeGetMediaStream = useCallback(async () => {
    // For all video modes: simple universal constraints { video: true, audio: true }
    if (!isVoiceOnly) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        return stream;
      } catch (tier1Err) {
        console.warn('[CallRoom] Universal video+audio query failed:', tier1Err?.name || tier1Err);

        // Fallback 1: Video-only
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          setMicEnabled(false);
          return videoStream;
        } catch (tier2Err) {
          console.warn('[CallRoom] Universal video-only fallback failed:', tier2Err?.name || tier2Err);
        }

        // Fallback 2: Audio-only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
          setIsCameraOn(false);
          return audioStream;
        } catch (tier3Err) {
          console.warn('[CallRoom] Universal audio-only failed:', tier3Err?.name || tier3Err);
        }

        // Fallback 3: Both denied or unavailable
        console.warn('[CallRoom] Entering room in receive-only mode.');
        setIsCameraOn(false);
        setMicEnabled(false);
        return null;
      }
    } else {
      // Voice-only mode — acquire Audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        setIsCameraOn(false);
        return audioStream;
      } catch (err) {
        console.warn('[CallRoom] Voice-only audio acquisition failed:', err);
        setIsCameraOn(false);
        setMicEnabled(false);
        return null;
      }
    }
  }, [isVoiceOnly]);

  // ── 100% Native WebRTC PeerConnection + Firestore Signaling ─────────────
  useEffect(() => {
    if (!user || isSearchingNext || strangerLeftOpen) return;

    let isCancelled = false;
    let unsubCall = null;
    let unsubCandidates = null;

    const initWebRTC = async () => {
      setCallError('');

      // 1. Acquire local stream
      const stream = await safeGetMediaStream();
      if (isCancelled) {
        if (stream) stream.getTracks?.().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        localStreamRef.current = stream;
        setLocalStreamState(stream);
        setRemoteStreamState(null);
        const hasVideo = Boolean(stream.getVideoTracks?.()?.length && stream.getVideoTracks()[0].enabled);
        const hasAudio = Boolean(stream.getAudioTracks?.()?.length && stream.getAudioTracks()[0].enabled);
        setIsCameraOn(hasVideo);
        setMicEnabled(hasAudio);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.volume = 0;
          localVideoRef.current.play().catch(() => {});
        }
      } else {
        localStreamRef.current = null;
        setLocalStreamState(null);
        setRemoteStreamState(null);
        setIsCameraOn(false);
        setMicEnabled(false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }

      // 2. Solo / Practice Test Room: Local preview only
      if (isSoloTest) {
        setIsRemoteConnected(true);
        return;
      }

      // 3. Real WebRTC PeerConnection Setup
      try {
        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Add local tracks to peer connection
        if (stream) {
          stream.getTracks?.().forEach((track) => {
            try {
              pc.addTrack(track, stream);
            } catch (e) {
              console.warn('[WebRTC] addTrack error:', e);
            }
          });
        }

        // Add receive-only transceivers if audio or video track is not publishing
        const hasAudioTrack = Boolean(stream?.getAudioTracks?.()?.length);
        const hasVideoTrack = Boolean(stream?.getVideoTracks?.()?.length);

        if (!hasAudioTrack) {
          try {
            pc.addTransceiver('audio', { direction: 'recvonly' });
          } catch {
            /* best effort */
          }
        }
        if (!hasVideoTrack && !isVoiceOnly) {
          try {
            pc.addTransceiver('video', { direction: 'recvonly' });
          } catch {
            /* best effort */
          }
        }

        // Handle remote stream tracks
        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            remoteStreamRef.current = event.streams[0];
            setRemoteStreamState(event.streams[0]);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.play().catch(() => {});
            }
            cancelDisconnect();
            setIsRemoteConnected(true);
          } else if (event.track) {
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = new MediaStream();
            }
            remoteStreamRef.current.addTrack(event.track);
            setRemoteStreamState(remoteStreamRef.current);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => {});
            }
            cancelDisconnect();
            setIsRemoteConnected(true);
          }
        };

        // Connection state changes with 2000ms debounce
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            cancelDisconnect();
            setIsRemoteConnected(true);
          } else if (
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'failed' ||
            pc.connectionState === 'closed'
          ) {
            scheduleDisconnect();
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            cancelDisconnect();
            setIsRemoteConnected(true);
          } else if (
            pc.iceConnectionState === 'disconnected' ||
            pc.iceConnectionState === 'failed' ||
            pc.iceConnectionState === 'closed'
          ) {
            scheduleDisconnect();
          }
        };

        // Deterministic role: URL role param, callerUid if set, or roomId segments comparison
        const roleParam = searchParams?.get('role');
        const roomSegments = currentRoomId.split('_');
        const defaultCaller = roomSegments.length >= 2 ? roomSegments[0] : null;

        const callDocRef = doc(db, 'calls', currentRoomId);
        let callerUid = null;
        try {
          const callSnap = await getDoc(callDocRef);
          if (callSnap.exists()) {
            callerUid = callSnap.data()?.callerUid;
          }
        } catch {
          /* fallback */
        }

        const isCaller = roleParam === 'caller'
          ? true
          : roleParam === 'callee'
          ? false
          : (callerUid ? user.uid === callerUid : (defaultCaller ? user.uid === defaultCaller : true));

        const myCandidateColl = isCaller ? 'callerCandidates' : 'calleeCandidates';
        const remoteCandidateColl = isCaller ? 'calleeCandidates' : 'callerCandidates';

        // Send local ICE candidates to Firestore (capped to top 6 to optimize quota & connection speed)
        let localCandidateCount = 0;
        pc.onicecandidate = (event) => {
          if (event.candidate && currentRoomId && localCandidateCount < 6) {
            localCandidateCount++;
            addDoc(
              collection(db, 'calls', currentRoomId, myCandidateColl),
              event.candidate.toJSON()
            ).catch(() => {});
          }
        };

        const candidateQueue = [];
        const flushCandidates = async () => {
          while (candidateQueue.length > 0) {
            const c = candidateQueue.shift();
            try {
              if (pcRef.current && pc.signalingState !== 'closed') {
                await pc.addIceCandidate(c);
              }
            } catch {
              /* candidate error ignore */
            }
          }
        };

        if (isCaller) {
          if (isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
          // Caller: Create and save offer
          const offerDescription = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          if (isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
          await pc.setLocalDescription(offerDescription);

          await setDoc(
            callDocRef,
            {
              offer: { sdp: offerDescription.sdp, type: offerDescription.type },
              callerUid: user.uid,
              status: 'active',
              isEnded: false,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          // Listen for Callee answer
          unsubCall = onSnapshot(callDocRef, async (snapshot) => {
            if (!snapshot.exists() || isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
            const data = snapshot.data();
            if (!data) return;

            if (data.answer && !pc.currentRemoteDescription && pc.signalingState === 'have-local-offer') {
              try {
                if (pc.signalingState !== 'have-local-offer') return;
                const answerDescription = new RTCSessionDescription(data.answer);
                await pc.setRemoteDescription(answerDescription);
                await flushCandidates();
              } catch (err) {
                console.warn('[WebRTC Caller] setRemoteDescription notice:', err?.message || err);
              }
            }
          });
        } else {
          // Callee: Wait for Caller's offer, then create and save answer
          let hasAnswered = false;
          unsubCall = onSnapshot(callDocRef, async (snapshot) => {
            if (!snapshot.exists() || isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
            const data = snapshot.data();
            if (!data) return;

            if (
              data.offer &&
              !hasAnswered &&
              !pc.currentRemoteDescription &&
              (pc.signalingState === 'stable' || pc.signalingState === 'have-remote-offer')
            ) {
              hasAnswered = true;
              try {
                const offerDescription = new RTCSessionDescription(data.offer);
                await pc.setRemoteDescription(offerDescription);
                await flushCandidates();

                if (isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
                const answerDescription = await pc.createAnswer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                if (isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
                await pc.setLocalDescription(answerDescription);

                await updateDoc(callDocRef, {
                  answer: { sdp: answerDescription.sdp, type: answerDescription.type },
                  calleeUid: user.uid,
                  status: 'active',
                  updatedAt: serverTimestamp(),
                });
              } catch (err) {
                console.error('[WebRTC Callee] negotiation error:', err);
                hasAnswered = false;
              }
            }
          });
        }

        // Listen for remote ICE candidates
        unsubCandidates = onSnapshot(
          collection(db, 'calls', currentRoomId, remoteCandidateColl),
          (snapshot) => {
            if (!snapshot || snapshot.empty || isCancelled || !pcRef.current || pc.signalingState === 'closed') return;
            snapshot.docChanges().forEach(async (change) => {
              if (change.type === 'added') {
                try {
                  const candidateData = change.doc.data();
                  if (candidateData && candidateData.candidate) {
                    const candidate = new RTCIceCandidate(candidateData);
                    if (!pc.remoteDescription) {
                      candidateQueue.push(candidate);
                    } else {
                      await pc.addIceCandidate(candidate);
                    }
                  }
                } catch {
                  /* candidate buffering */
                }
              }
            });
          }
        );
      } catch (err) {
        console.error('[CallRoom] WebRTC connection error:', err);
        if (!isCancelled) {
          setCallError('Direct connection error. Retrying...');
        }
      }
    };

    initWebRTC();

    return () => {
      isCancelled = true;
      cancelDisconnect();
      if (unsubCall) unsubCall();
      if (unsubCandidates) unsubCandidates();
      teardownMediaTracks();
    };
  }, [
    currentRoomId,
    user,
    isSoloTest,
    isPrivateRoom,
    isVoiceOnly,
    isSearchingNext,
    strangerLeftOpen,
    safeGetMediaStream,
    teardownMediaTracks,
    scheduleDisconnect,
    cancelDisconnect,
    searchParams,
  ]);

  // ── Live Mic Speech Recognition Subtitles ───────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      setSubtitle(r[0]?.transcript || '');
    };
    recognition.onend = () => {
      try {
        recognition.start();
      } catch {
        /* no-op */
      }
    };

    try {
      recognition.start();
    } catch {
      /* no-op */
    }
    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch {
          /* no-op */
        }
        recognitionRef.current = null;
      }
    };
  }, [currentRoomId]);

  // ── Hardware Control Handlers ───────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const audioTracks = localStreamRef.current?.getAudioTracks?.() || [];
    const activeTrack = audioTracks.find((t) => t.readyState === 'live');

    if (!activeTrack) {
      try {
        const aStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const newTrack = aStream.getAudioTracks()[0];
        if (newTrack) {
          newTrack.enabled = true;
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream([newTrack]);
          } else {
            audioTracks.forEach((t) => {
              try { localStreamRef.current.removeTrack(t); } catch { /* ignore */ }
            });
            localStreamRef.current.addTrack(newTrack);
          }
          setLocalStreamState(localStreamRef.current);
          setMicEnabled(true);

          if (pcRef.current) {
            const senders = pcRef.current.getSenders?.() || [];
            const audioSender = senders.find((s) => s.track?.kind === 'audio' || s.kind === 'audio');
            if (audioSender) {
              await audioSender.replaceTrack(newTrack);
            } else {
              try {
                pcRef.current.addTrack(newTrack, localStreamRef.current);
              } catch (e) {
                console.warn('[CallRoom] Failed to add new audio track to RTCPeerConnection:', e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[CallRoom] toggleMic acquire audio track error:', err);
      }
      return;
    }

    const nextState = !activeTrack.enabled;
    audioTracks.forEach((t) => {
      t.enabled = nextState;
    });
    setLocalStreamState(localStreamRef.current);
    setMicEnabled(nextState);
  }, []);

  const toggleCam = useCallback(async () => {
    const videoTracks = localStreamRef.current?.getVideoTracks?.() || [];
    const activeTrack = videoTracks.find((t) => t.readyState === 'live');

    if (!activeTrack) {
      // No live video track in local stream — actively acquire camera track
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const newTrack = vStream.getVideoTracks()[0];
        if (newTrack) {
          newTrack.enabled = true;
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream([newTrack]);
          } else {
            videoTracks.forEach((t) => {
              try { localStreamRef.current.removeTrack(t); } catch { /* ignore */ }
            });
            localStreamRef.current.addTrack(newTrack);
          }
          setLocalStreamState(localStreamRef.current);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
          }
          setIsCameraOn(true);

          if (pcRef.current) {
            const senders = pcRef.current.getSenders?.() || [];
            const videoSender = senders.find((s) => s.track?.kind === 'video' || s.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newTrack);
            } else {
              try {
                pcRef.current.addTrack(newTrack, localStreamRef.current);
              } catch (e) {
                console.warn('[CallRoom] Failed to add new video track to RTCPeerConnection:', e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[CallRoom] toggleCam acquire video track error:', err);
      }
      return;
    }

    // Toggle existing live video track
    const nextState = !activeTrack.enabled;
    videoTracks.forEach((t) => {
      t.enabled = nextState;
    });
    setLocalStreamState(localStreamRef.current);
    setIsCameraOn(nextState);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      try {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks?.().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = null;
        }

        const camTrack = localStreamRef.current?.getVideoTracks?.()[0];
        if (pcRef.current && camTrack) {
          const senders = pcRef.current.getSenders?.();
          const videoSender = senders?.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(camTrack);
          }
        }

        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.muted = true;
        }
      } catch {
        /* best effort */
      }
      setScreenSharing(false);
      setLayoutMode('grid');
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        if (screenTrack) {
          // 1. Swap track on RTCPeerConnection sender
          if (pcRef.current) {
            const senders = pcRef.current.getSenders?.();
            const videoSender = senders?.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(screenTrack);
            }
          }

          // 2. Display screen on screenVideoRef and preserve webcam on localVideoRef
          if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = screenStream;
            screenVideoRef.current.muted = true;
            screenVideoRef.current.play().catch(() => {});
          }
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.muted = true;
          }
          setScreenSharing(true);
          setLayoutMode('spotlight'); // Google Meet style spotlight layout

          // 3. Revert cleanly when user clicks "Stop Sharing" in Chrome banner
          screenTrack.onended = async () => {
            if (localStreamRef.current) {
              const camTrack = localStreamRef.current.getVideoTracks?.()[0];
              if (pcRef.current && camTrack) {
                const videoSender = pcRef.current.getSenders?.().find((s) => s.track && s.track.kind === 'video');
                if (videoSender) await videoSender.replaceTrack(camTrack);
              }
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
                localVideoRef.current.muted = true;
              }
            }
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks?.().forEach((t) => t.stop());
              screenStreamRef.current = null;
            }
            if (screenVideoRef.current) {
              screenVideoRef.current.srcObject = null;
            }
            setScreenSharing(false);
            setLayoutMode('grid');
          };
        }
      } catch (err) {
        if (err?.name !== 'NotAllowedError') console.error('[CallRoom] Screen share error:', err);
      }
    }
  }, [screenSharing]);

  // ── Gemini Dynamic AI Icebreaker ─────────────────────────────────────────
  const handleGenerateIcebreaker = async () => {
    if (generatingIcebreaker) return;
    setGeneratingIcebreaker(true);
    try {
      const question = await generateIcebreaker(
        mode,
        profile?.interests || [],
        otherProfile?.interests || []
      );
      setIcebreaker(question);
    } catch (err) {
      console.warn('Icebreaker error:', err);
    } finally {
      setGeneratingIcebreaker(false);
    }
  };

  // ── Quick Notes Firestore Persistence ───────────────────────────────────
  const handleSaveNotes = async () => {
    if (!user?.uid) return;
    setSaveNoteStatus('saving');
    notesRef.current = notes;
    try {
      if (currentRoomId) {
        await updateCallNotesByRoom(user.uid, currentRoomId, notes, {
          strangerUid: otherUidRef.current || otherUid || 'unknown',
          strangerName: otherProfileRef.current?.username || otherProfile?.username || 'Stranger',
          mode,
          duration: callDurationRef.current || 3,
        });
      }
      setSaveNoteStatus('saved');
      setTimeout(() => setSaveNoteStatus('idle'), 2500);
    } catch (err) {
      console.error('Save notes error:', err);
      setSaveNoteStatus('saved');
      setTimeout(() => setSaveNoteStatus('idle'), 2500);
    }
  };

  // ── In-Call Drawer Mutual Exclusion Handlers ─────────────────────────────
  const toggleNotesDrawer = () => {
    setNotesOpen((prev) => {
      const next = !prev;
      if (next) setChatOpen(false);
      return next;
    });
  };

  const toggleChatDrawer = () => {
    setChatOpen((prev) => {
      const next = !prev;
      if (next) setNotesOpen(false);
      return next;
    });
  };

  // ── Report & Strike Submission ──────────────────────────────────────────
  const handleReportSubmit = async ({ reason, details, alsoBlock }) => {
    const targetUid = otherUidRef.current || otherUid;
    if (targetUid) {
      await reportUser({
        reporterUid: user.uid,
        reportedUid: targetUid,
        roomId: currentRoomId,
        reason,
        details,
      });
      if (alsoBlock) await blockUser(user.uid, targetUid);
    }
    setReportOpen(false);
    handleNextStranger();
  };

  const copyRoomCode = () => {
    const code = currentRoomId.replace('private_', '');
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // SPEC-003: Dynamic 1-click invite link — zero hardcoded domains
  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/call/${currentRoomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const formatTimer = (secs) => {
    if (secs === null) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isCallLive = !isSearchingNext && !strangerLeftOpen;

  return (
    <div className="w-screen h-screen bg-[#07090E] relative overflow-hidden flex flex-col items-center justify-start font-sans text-white p-3 sm:p-4 select-none">
      {/* ── Call Error Overlay ─────────────────────────────────────────── */}
      {callError && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-w-sm rounded-2xl border border-red-500/30 bg-slate-900 p-6 text-center shadow-2xl space-y-4">
            <p className="text-base font-bold text-white">Connection notice</p>
            <p className="text-xs text-slate-300">{callError}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-xl bg-[#FCA311] px-5 py-2.5 text-xs font-bold text-[#14213D] hover:bg-[#E5930B] transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Top Bar / Header ───────────────────────────────────────────── */}
      <header className="w-full max-w-7xl flex justify-between items-center z-20 pb-2 pointer-events-none">
        {/* Left: Mode badge & Quick Info */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* Mode Pill */}
          <div className="bg-[#14213D]/90 border border-white/15 px-3.5 py-1.5 rounded-full backdrop-blur-xl shadow-lg flex items-center gap-2 text-xs font-mono font-bold text-slate-100 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {isSoloTest ? (
              <span className="flex items-center gap-1.5 text-amber-300">
                <PlayCircle size={13} /> Solo Test Room
              </span>
            ) : isPrivateRoom ? (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Lock size={13} /> Private Room: {currentRoomId.replace('private_', '')}
              </span>
            ) : isVoiceOnly ? (
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Mic size={13} /> Voice Lounge
              </span>
            ) : (
              <span>{mode.toUpperCase()} MODE</span>
            )}
          </div>

          {/* Quick Talk Timer */}
          {timeLeft !== null && (
            <div className="bg-[#FCA311] text-[#14213D] font-mono font-black px-3 py-1.5 rounded-full shadow-md text-xs flex items-center gap-1.5">
              <Clock size={13} /> {formatTimer(timeLeft)}
            </div>
          )}

          {/* Clickable Stranger Profile Badge */}
          {!isSoloTest && !isPrivateRoom && otherProfile && (
            <div
              onClick={() => {
                setInspectingUser({ uid: otherUid, profile: otherProfile });
                setProfileModalOpen(true);
              }}
              className="bg-[#14213D]/90 hover:bg-[#1E3A8A]/90 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-xl shadow-lg flex items-center gap-2 cursor-pointer transition active:scale-95 group"
              title="Click to view Stranger Profile"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                {otherProfile.username?.charAt(0).toUpperCase() || <User size={10} />}
              </div>
              <span className="text-xs font-bold text-white group-hover:text-[#FCA311] transition truncate max-w-[100px] sm:max-w-[140px]">
                {otherProfile.username || 'Stranger'}
              </span>
              <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
            </div>
          )}
        </div>

        {/* Right: Quick actions (Add Friend / Copy Code) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Private Room Copy Code Button */}
          {isPrivateRoom && (
            <button
              onClick={copyRoomCode}
              className="px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 bg-[#14213D] hover:bg-[#1E3A8A] text-white border border-white/15 transition shadow-lg cursor-pointer"
            >
              {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedCode ? 'Code Copied' : 'Invite Code'}</span>
            </button>
          )}

          {/* SPEC-003: Dynamic 1-Click Invite Friend Link */}
          <button
            onClick={copyInviteLink}
            className={`px-3.5 py-1.5 rounded-full font-extrabold text-xs flex items-center gap-1.5 shadow-[0_2px_12px_rgba(245,158,11,0.35)] transition-all active:scale-95 cursor-pointer ${
              inviteCopied
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950'
            }`}
          >
            {inviteCopied ? (
              <><Check size={13} className="text-white" /><span>Link Copied!</span></>
            ) : (
              <><Link2 size={13} /><span>Invite Friend</span></>
            )}
          </button>
        </div>
      </header>

      {/* ── Dynamic AI Icebreaker Banner ───────────────────────────────── */}
      {icebreaker && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-lg w-full px-4 animate-toast-slide-down">
          <div className="bg-[#14213D]/95 border border-[#FCA311]/40 text-white px-5 py-2.5 rounded-full backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 text-center">
            <p className="text-xs font-semibold flex items-center gap-2 text-slate-100 flex-1 justify-center">
              <Sparkles size={14} className="text-[#FCA311] shrink-0" />
              <span>{icebreaker}</span>
            </p>
            <button
              onClick={() => setIcebreaker('')}
              className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Video/Voice Stage (Unified Height & Dynamic Layouts) ─── */}
      <main className="w-full h-[calc(100vh-100px)] max-w-7xl mx-auto relative rounded-3xl overflow-hidden bg-slate-950 border border-white/10 shadow-2xl flex items-center justify-center p-3 sm:p-4">
        {/* ================================================================= */}
        {/* ================================================================= */}
        {/* A. SOLO TEST ROOM UI                                              */}
        {/* ================================================================= */}
        {isSoloTest && (
          <div className="w-full h-full flex flex-col items-center justify-center p-2">
            <motion.div
              layout
              layoutId="local-video-card"
              transition={springTransition}
              className={`w-full max-w-4xl aspect-video rounded-3xl bg-[#111318] border overflow-hidden shadow-2xl relative flex items-center justify-center transition-all duration-300 ${getSpeakerBorderClass(isLocalSpeaking)}`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
                  isCameraOn || screenSharing ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                }`}
              />
              {!(isCameraOn || screenSharing) && (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 p-[3px] shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                    <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                      {profile?.username?.charAt(0).toUpperCase() || <User size={32} />}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{profile?.username || 'You'}</p>
                    <span className="text-xs font-medium text-amber-400">Camera Off</span>
                  </div>
                </div>
              )}

              {/* Status Badges */}
              <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
                <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 shadow-lg">
                  <PlayCircle size={12} />
                  <span>Hardware Test</span>
                </div>
                {!micEnabled ? (
                  <div className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1 backdrop-blur-md">
                    <MicOff size={11} /> Muted
                  </div>
                ) : isLocalSpeaking ? (
                  <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 backdrop-blur-md">
                    <Mic size={11} className="text-amber-400" /> Speaking
                  </div>
                ) : null}
              </div>

              {/* Bottom Bar: Name & Mic Level Meter */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#14213D] flex items-center justify-center text-xs font-bold text-[#FCA311]">
                    {profile?.username?.charAt(0).toUpperCase() || 'Y'}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[200px]">
                    {profile?.username || 'You'} (Self Preview)
                  </span>
                </div>

                {/* Real-time responsive mic audio bar */}
                <div className="flex items-center gap-2">
                  <Mic size={14} className={micVolume > 5 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
                  <div className="w-24 sm:w-36 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75 rounded-full"
                      style={{ width: `${micEnabled ? Math.max(4, micVolume) : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
                    {micEnabled ? `${micVolume}%` : '0%'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* ================================================================= */}
        {/* B. VOICE-ONLY / CASUAL COFFEE ROOM UI                             */}
        {/* ================================================================= */}
        {isVoiceOnly && !isSoloTest && (
          <div className="w-full h-full flex flex-col md:flex-row items-center justify-center gap-6 p-4 max-w-5xl mx-auto">
            {/* Permanent unrendered media elements for audio playback & ref integrity (Law 12) */}
            <video ref={localVideoRef} autoPlay playsInline muted className="opacity-0 absolute w-1 h-1 pointer-events-none" />
            <video ref={remoteVideoRef} autoPlay playsInline className="opacity-0 absolute w-1 h-1 pointer-events-none" />

            {/* Left Card: Local User */}
            <div className="flex-1 w-full h-full max-h-[480px] rounded-3xl bg-[#111318] border border-white/10 shadow-2xl relative flex flex-col items-center justify-center p-6 transition-all duration-300">
              <div
                className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 p-[3px] transition-all duration-200 ${
                  micVolume > 8 ? 'scale-105 shadow-[0_0_40px_rgba(6,182,212,0.6)]' : 'shadow-[0_0_25px_rgba(6,182,212,0.25)]'
                }`}
              >
                <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                  {profile?.username?.charAt(0).toUpperCase() || <User size={36} />}
                </div>
              </div>

              <h4 className="text-lg font-bold text-white mt-4">{profile?.username || 'You'}</h4>
              <div className="mt-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-cyan-300 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${micEnabled ? 'bg-cyan-400 animate-pulse' : 'bg-red-500'}`} />
                <span>{micEnabled ? (micVolume > 5 ? 'Speaking...' : 'Listening') : 'Muted'}</span>
              </div>

              {/* Status Badges */}
              <div className="absolute top-4 left-4">
                {!micEnabled && (
                  <span className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1">
                    <MicOff size={11} /> Muted
                  </span>
                )}
              </div>
            </div>

            {/* Center Dynamic Audio Waveform Visualizer */}
            <div className="flex flex-row md:flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 py-4">
              {[40, 65, 85, 50, 95, 75, 45, 90, 60, 80, 55, 90, 70, 45].map((height, i) => {
                const isActive = (micVolume > 5 || remoteVolume > 5);
                const barScale = isActive
                  ? Math.max(0.2, (Math.sin((i + Date.now() / 200) * 0.8) + 1.2) * 0.5)
                  : 0.15;

                return (
                  <div
                    key={i}
                    className="w-1.5 md:w-8 md:h-1.5 bg-gradient-to-r from-cyan-400 via-indigo-400 to-[#FCA311] rounded-full transition-all duration-100"
                    style={{
                      height: `${Math.max(6, height * barScale)}px`,
                      opacity: isActive ? 0.9 : 0.25,
                    }}
                  />
                );
              })}
            </div>

            {/* Right Card: Remote Stranger / Waiting */}
            <div className="flex-1 w-full h-full max-h-[480px] rounded-3xl bg-[#111318] border border-white/10 shadow-2xl relative flex flex-col items-center justify-center p-6 transition-all duration-300">
              {isRemoteConnected && otherUid ? (
                <>
                  <div
                    onClick={() => {
                      setInspectingUser({ uid: otherUid, profile: otherProfile });
                      setProfileModalOpen(true);
                    }}
                    className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 p-[3px] cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 ${
                      remoteVolume > 8 ? 'scale-105 shadow-[0_0_40px_rgba(252,163,17,0.6)]' : 'shadow-[0_0_25px_rgba(252,163,17,0.25)]'
                    }`}
                    title="Click to inspect profile"
                  >
                    <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                      {otherProfile?.username?.charAt(0).toUpperCase() || <User size={36} />}
                    </div>
                  </div>

                  <h4 className="text-lg font-bold text-white mt-4 flex items-center gap-1.5">
                    <span>{otherProfile?.username || 'Stranger'}</span>
                    <ShieldCheck size={16} className="text-emerald-400" />
                  </h4>

                  <div className="mt-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-amber-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{remoteVolume > 5 ? 'Speaking...' : 'Connected'}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* C. PRIVATE ROOM & STANDARD STRANGER CALL (DISCORD AUTO-GRID B.01) */}
        {/* ================================================================= */}
        {(isStrangerCall || isPrivateRoom) && !isSoloTest && !isVoiceOnly && (
          <div className="w-full h-full relative">
            {/* 1. SCREEN SHARING SPOTLIGHT MODE (75% Screen Viewport + Top Filmstrip) */}
            {(layoutMode === 'spotlight' || screenSharing) && (
              <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
                {/* Top Horizontal Participant Filmstrip */}
                <div className="w-full h-32 sm:h-40 flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0 py-1 px-0.5">
                  {/* Local User Filmstrip Tile */}
                  <motion.div
                    layout
                    layoutId="local-video-card"
                    transition={springTransition}
                    className={`h-full aspect-video shrink-0 rounded-2xl bg-[#111318] border overflow-hidden relative flex items-center justify-center transition-all duration-300 ${getSpeakerBorderClass(isLocalSpeaking)}`}
                  >
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
                        isCameraOn || screenSharing ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                      }`}
                    />
                    {!(isCameraOn || screenSharing) && (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-1">
                        <div className="w-8 h-8 rounded-full bg-[#14213D] border border-white/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                          {profile?.username?.charAt(0).toUpperCase() || <User size={14} />}
                        </div>
                        <span className="text-[10px] text-slate-300 font-semibold">{profile?.username || 'You'}</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-semibold text-white/95 border border-white/10 flex items-center gap-1.5 shadow">
                      <span>{profile?.username || 'You'} (You)</span>
                      {!micEnabled ? (
                        <MicOff size={10} className="text-red-400" />
                      ) : isLocalSpeaking ? (
                        <Mic size={10} className="text-amber-400 animate-pulse" />
                      ) : null}
                    </div>
                  </motion.div>

                  {/* Remote Partner Filmstrip Tile */}
                  {isRemoteConnected && otherUid && (
                    <motion.div
                      layout
                      layoutId="remote-video-card"
                      transition={springTransition}
                      className={`h-full aspect-video shrink-0 rounded-2xl bg-[#111318] border overflow-hidden relative flex items-center justify-center transition-all duration-300 ${getSpeakerBorderClass(isRemoteSpeaking)}`}
                    >
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-cover ${isRemoteVideoActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                      />
                      {!isRemoteVideoActive && (
                        <div
                          onClick={() => {
                            if (otherUid && otherProfile) {
                              setInspectingUser({ uid: otherUid, profile: otherProfile });
                              setProfileModalOpen(true);
                            }
                          }}
                          className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-1 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#14213D] border border-white/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                            {otherProfile?.username?.charAt(0).toUpperCase() || <User size={14} />}
                          </div>
                          <span className="text-[10px] text-slate-300 font-semibold">{otherProfile?.username || 'Stranger'}</span>
                        </div>
                      )}
                      <div
                        onClick={() => {
                          if (otherUid && otherProfile) {
                            setInspectingUser({ uid: otherUid, profile: otherProfile });
                            setProfileModalOpen(true);
                          }
                        }}
                        className="absolute top-2 left-2 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-semibold text-white/95 border border-white/10 flex items-center gap-1.5 cursor-pointer shadow"
                      >
                        <span className="truncate max-w-[80px]">{otherProfile?.username || 'Stranger'}</span>
                        <ShieldCheck size={11} className="text-emerald-400 shrink-0" />
                        {isRemoteSpeaking && <Mic size={10} className="text-amber-400 animate-pulse" />}
                      </div>
                    </motion.div>
                  )}

                  {/* Additional Multi-Peer Filmstrip Tiles (3 to 6 participants) */}
                  {roomParticipants
                    .filter((uid) => uid && uid !== user?.uid && uid !== otherUid)
                    .slice(0, 4)
                    .map((pUid, idx) => {
                      const peerProf = participantProfiles[pUid];
                      return (
                        <div
                          key={pUid || idx}
                          onClick={() => {
                            if (peerProf) {
                              setInspectingUser({ uid: pUid, profile: peerProf });
                              setProfileModalOpen(true);
                            }
                          }}
                          className="h-full aspect-video shrink-0 rounded-2xl bg-[#111318] border border-white/10 overflow-hidden relative flex flex-col items-center justify-center p-2 cursor-pointer shadow-lg hover:border-amber-500/40 transition"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#14213D] border border-white/20 flex items-center justify-center text-white font-bold text-xs">
                            {peerProf?.username?.charAt(0).toUpperCase() || <User size={14} />}
                          </div>
                          <span className="text-[10px] text-slate-300 font-semibold mt-1 truncate max-w-[90px]">
                            {peerProf?.username || `Peer ${idx + 3}`}
                          </span>
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-slate-400 border border-white/10">
                            P{idx + 3}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Dominant Screen Stage Viewport (75% height) */}
                <div className="flex-1 w-full min-h-0 rounded-3xl bg-[#111318] border border-white/10 overflow-hidden shadow-2xl relative flex items-center justify-center">
                  {screenSharing ? (
                    <>
                      <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain bg-black"
                      />
                      <div className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-300 border border-amber-400/30 flex items-center gap-2 shadow-lg">
                        <Monitor size={14} className="text-[#FCA311]" />
                        <span>Your Screen (Sharing)</span>
                      </div>
                    </>
                  ) : (
                    /* Spotlight mode focused partner view */
                    <>
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-cover ${isRemoteConnected && isRemoteVideoActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                      />
                      {isRemoteConnected && otherUid ? (
                        <>
                          {!isRemoteVideoActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div
                                onClick={() => {
                                  setInspectingUser({ uid: otherUid, profile: otherProfile });
                                  setProfileModalOpen(true);
                                }}
                                className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 p-[3px] shadow-[0_0_30px_rgba(252,163,17,0.35)] cursor-pointer"
                              >
                                <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                                  {otherProfile?.username?.charAt(0).toUpperCase() || <User size={32} />}
                                </div>
                              </div>
                              <div className="text-center mt-3">
                                <p className="text-sm font-bold text-white">{otherProfile?.username || 'Stranger'}</p>
                              </div>
                            </div>
                          )}
                          <div
                            onClick={() => {
                              setInspectingUser({ uid: otherUid, profile: otherProfile });
                              setProfileModalOpen(true);
                            }}
                            className="absolute top-4 left-4 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/95 border border-white/10 shadow-lg flex items-center gap-2 cursor-pointer transition group"
                            title="Click to inspect Profile"
                          >
                            <span className="group-hover:text-[#FCA311] transition">
                              {otherProfile?.username || 'Stranger'}
                            </span>
                            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                            {isRemoteSpeaking && (
                              <span className="flex items-center gap-1 text-amber-400 text-[11px] font-bold border-l border-white/15 pl-1.5">
                                <Mic size={11} /> Speaking
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#FCA311] flex items-center justify-center animate-pulse">
                            <Sparkles size={28} />
                          </div>
                          <p className="text-sm font-bold text-slate-200">
                            {isSearchingNext ? 'Finding partner...' : 'Connecting partner...'}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 2. DYNAMIC CSS AUTO-GRID MODE (1 to 6 Peers with Framer Motion Physics) */}
            {layoutMode === 'grid' && !screenSharing && (
              <div className={getGridContainerClass()}>
                {/* ── CARD 1: Local User Card ── */}
                <motion.div
                  layout
                  layoutId="local-video-card"
                  transition={springTransition}
                  className={`rounded-3xl bg-[#111318] border overflow-hidden shadow-2xl relative flex items-center justify-center transition-all duration-300 ${
                    totalActivePeers === 1 ? 'w-full max-w-4xl aspect-video mx-auto' : 'w-full h-full min-h-0'
                  } ${getSpeakerBorderClass(isLocalSpeaking)}`}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
                      isCameraOn || screenSharing ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                    }`}
                  />
                  {!(isCameraOn || screenSharing) && (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[3px] shadow-[0_0_30px_rgba(99,102,241,0.35)]">
                        <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                          {profile?.username?.charAt(0).toUpperCase() || <User size={32} />}
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">{profile?.username || 'You'}</p>
                        <span className="text-xs font-semibold text-slate-400">Camera Off</span>
                      </div>
                    </div>
                  )}

                  {/* Top-Left Name Badge & Mic status */}
                  <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/95 border border-white/10 shadow-lg flex items-center gap-2">
                    <span>{profile?.username || 'You'} (You)</span>
                    {!micEnabled ? (
                      <span className="flex items-center gap-1 text-red-400 text-[11px] font-bold border-l border-white/15 pl-1.5">
                        <MicOff size={11} /> Muted
                      </span>
                    ) : isLocalSpeaking ? (
                      <span className="flex items-center gap-1 text-amber-400 text-[11px] font-bold border-l border-white/15 pl-1.5">
                        <Mic size={11} /> Speaking
                      </span>
                    ) : null}
                  </div>

                  {/* When waiting in Solo / Private Room without remote peer, show floating prompt */}
                  {totalActivePeers === 1 && isPrivateRoom && !isRemoteConnected && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 px-5 py-3 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 shadow-2xl text-center max-w-sm">
                      <p className="text-xs text-slate-300">Invite friends using room code:</p>
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-sm font-mono font-bold text-[#FCA311]">
                        <span>{currentRoomId.replace('private_', '')}</span>
                        <button
                          onClick={copyRoomCode}
                          className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {totalActivePeers === 1 && !isPrivateRoom && !isRemoteConnected && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-xs font-semibold text-amber-300 shadow-xl">
                      <span className="w-2 h-2 rounded-full bg-[#FCA311] animate-ping" />
                      <span>{isSearchingNext ? 'Finding next stranger...' : 'Waiting for partner...'}</span>
                    </div>
                  )}
                </motion.div>

                {/* ── CARD 2: Remote Partner Card (when 2+ peers) ── */}
                {totalActivePeers >= 2 && (
                  <motion.div
                    layout
                    layoutId="remote-video-card"
                    transition={springTransition}
                    className={`rounded-3xl bg-[#111318] border overflow-hidden shadow-2xl relative flex items-center justify-center transition-all duration-300 w-full h-full min-h-0 ${getSpeakerBorderClass(isRemoteSpeaking)}`}
                  >
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className={`w-full h-full object-cover ${isRemoteConnected && isRemoteVideoActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                    />

                    {/* Fallback avatar overlay if remote camera is disabled or connecting */}
                    {(!isRemoteConnected || !isRemoteVideoActive) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                        <div
                          onClick={() => {
                            if (otherUid && otherProfile) {
                              setInspectingUser({ uid: otherUid, profile: otherProfile });
                              setProfileModalOpen(true);
                            }
                          }}
                          className={`w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 p-[3px] shadow-[0_0_30px_rgba(252,163,17,0.35)] ${
                            otherProfile ? 'cursor-pointer hover:scale-105 active:scale-95 transition' : ''
                          }`}
                        >
                          <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                            {otherProfile?.username?.charAt(0).toUpperCase() || <User size={32} />}
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-sm font-bold text-white">
                            {otherProfile?.username || (isSearchingNext ? 'Finding Partner...' : 'Stranger')}
                          </p>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-amber-300">
                            <span className="w-2 h-2 rounded-full bg-[#FCA311] animate-ping" />
                            <span>
                              {isSearchingNext
                                ? 'Finding next stranger...'
                                : isRemoteConnected
                                ? 'Camera Off'
                                : 'Connecting to partner...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Top-Left Clickable Name Badge */}
                    {otherProfile && (
                      <div
                        onClick={() => {
                          setInspectingUser({ uid: otherUid, profile: otherProfile });
                          setProfileModalOpen(true);
                        }}
                        className="absolute top-4 left-4 z-20 bg-black/60 hover:bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-white/95 border border-white/10 shadow-lg flex items-center gap-2 cursor-pointer transition group"
                        title="Click to inspect Profile"
                      >
                        <span className="group-hover:text-[#FCA311] transition">
                          {otherProfile?.username || 'Stranger'}
                        </span>
                        <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                        {isRemoteSpeaking && (
                          <span className="flex items-center gap-1 text-amber-400 text-[11px] font-bold border-l border-white/15 pl-1.5">
                            <Mic size={11} /> Speaking
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── CARD 3: Third Peer Card (Max 3 per SPEC-003) ── */}
                {totalActivePeers >= 3 &&
                  roomParticipants
                    .filter((uid) => uid && uid !== user?.uid && uid !== otherUid)
                    .slice(0, 4)
                    .map((pUid, idx) => {
                      const peerProf = participantProfiles[pUid];
                      const peerName = peerProf?.username || `Participant ${idx + 3}`;
                      return (
                        <motion.div
                          key={pUid || idx}
                          layout
                          layoutId={`extra-peer-${pUid || idx}`}
                          transition={springTransition}
                          className="rounded-3xl bg-[#111318] border border-white/10 overflow-hidden shadow-2xl relative flex flex-col items-center justify-center p-4 transition-all duration-300 w-full h-full min-h-0"
                        >
                          <div
                            onClick={() => {
                              if (peerProf) {
                                setInspectingUser({ uid: pUid, profile: peerProf });
                                setProfileModalOpen(true);
                              }
                            }}
                            className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[3px] shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition"
                          >
                            <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-2xl">
                              {peerProf?.username?.charAt(0).toUpperCase() || <User size={24} />}
                            </div>
                          </div>
                          <div className="text-center mt-3">
                            <p className="text-sm font-bold text-white flex items-center justify-center gap-1">
                              <span>{peerName}</span>
                              <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                            </p>
                            <span className="text-[11px] text-slate-400 font-mono">Connected</span>
                          </div>
                          <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-white/95 border border-white/10 shadow-lg flex items-center gap-1.5">
                            <span>{peerName}</span>
                          </div>
                        </motion.div>
                      );
                    })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Live Mic Speech Subtitles Overlay ──────────────────────────── */}
      {subtitle && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-md w-full px-4 pointer-events-none z-30">
          <div className="bg-slate-950/90 backdrop-blur-md text-white text-center px-4 py-2 rounded-xl border border-white/15 shadow-2xl">
            <p className="text-xs font-medium text-slate-200">{subtitle}</p>
          </div>
        </div>
      )}

      {/* ── Stranger Left Modal (Case B: 3 clean actions) ──────────────── */}
      {strangerLeftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in font-sans">
          <div className="bg-stone-900 border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 animate-scale-pop">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#FCA311] flex items-center justify-center mx-auto shadow-inner">
              <PhoneOff size={28} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-extrabold text-white">Stranger Left the Conversation</h3>
              <p className="text-xs text-slate-300">
                Your conversation partner has disconnected. What would you like to do?
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              {/* 1. Primary CTA: Find Next Stranger */}
              <button
                onClick={() => {
                  setStrangerLeftOpen(false);
                  handleNextStranger();
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] text-sm font-black shadow-[0_4px_20px_rgba(252,163,17,0.35)] transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Zap size={16} className="fill-current" /> Find Next Stranger
              </button>

              <div className="flex items-center gap-2.5">
                {/* 2. Secondary: Report User */}
                <button
                  onClick={() => {
                    setStrangerLeftOpen(false);
                    setReportOpen(true);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-red-500/20 text-slate-200 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Flag size={14} /> Report User
                </button>

                {/* 3. Secondary: Leave to Dashboard */}
                <button
                  onClick={() => {
                    setStrangerLeftOpen(false);
                    teardownMediaTracks();
                    navigate('/dashboard');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <LogOut size={14} /> Leave to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom Bottom Dock (Mode-Aware Controls) ───────────────────── */}
      {isCallLive && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-stone-900/90 backdrop-blur-xl border border-white/15 px-6 py-3 rounded-full shadow-2xl flex flex-row items-center justify-center gap-3 flex-nowrap">
          {/* A. SOLO TEST DOCK: [Mic] [Cam] | [Exit Test] */}
          {isSoloTest && (
            <>
              <button
                onClick={toggleMic}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  micEnabled
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
                title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              <button
                onClick={toggleCam}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  isCameraOn
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>

              <div className="h-6 w-px bg-white/15" />

              <button
                onClick={() => {
                  teardownMediaTracks();
                  navigate('/dashboard');
                }}
                className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
              >
                <LogOut size={14} /> Exit Test
              </button>
            </>
          )}

          {/* B. PRIVATE CODE ROOM DOCK: [Mic] [Cam] | [Screen Share] [Notes] [Chat] [Layout] | [Leave Room] */}
          {isPrivateRoom && !isSoloTest && (
            <>
              <button
                onClick={toggleMic}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  micEnabled
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
                title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              <button
                onClick={toggleCam}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  isCameraOn
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
              </button>

              <div className="h-6 w-px bg-white/15" />

              <button
                onClick={toggleScreenShare}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  screenSharing ? 'bg-[#FCA311] text-[#14213D]' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <Monitor size={18} />
              </button>

              <button
                onClick={toggleNotesDrawer}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  notesOpen ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Quick Notes"
              >
                <FileText size={18} />
              </button>

              <button
                onClick={toggleChatDrawer}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  chatOpen ? 'bg-[#FCA311] text-[#14213D]' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Toggle Text Chat"
              >
                <MessageCircle size={18} />
              </button>

              <button
                onClick={() => setLayoutMode((m) => (m === 'grid' ? 'spotlight' : 'grid'))}
                className="p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center active:scale-95 cursor-pointer"
                title={`Switch Layout (Current: ${layoutMode})`}
              >
                {layoutMode === 'grid' ? <Columns size={18} /> : <LayoutGrid size={18} />}
              </button>

              <div className="h-6 w-px bg-white/15" />

              <button
                onClick={leaveCallExplicit}
                className="p-2.5 sm:p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
                title="Leave Room"
              >
                <PhoneOff size={18} />
              </button>
            </>
          )}

          {/* C & D. VOICE-ONLY / CASUAL & STANDARD 1-ON-1 STRANGER ROOM DOCK */}
          {!isSoloTest && !isPrivateRoom && (
            <>
              {/* [Mic] */}
              <button
                onClick={toggleMic}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  micEnabled
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}
                title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {/* [Camera] */}
              {!isVoiceOnly && (
                <button
                  onClick={toggleCam}
                  className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                    isCameraOn
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                  title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                >
                  {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              )}

              <div className="h-6 w-px bg-white/15" />

              {/* [AI Icebreaker] */}
              <button
                onClick={handleGenerateIcebreaker}
                disabled={generatingIcebreaker}
                className="p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white hover:text-[#FCA311] transition flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-50"
                title="Generate AI Icebreaker"
              >
                <Sparkles size={18} className={generatingIcebreaker ? 'animate-spin text-[#FCA311]' : 'text-[#FCA311]'} />
              </button>

              {/* [Screen Share] */}
              {!isVoiceOnly && (
                <button
                  onClick={toggleScreenShare}
                  className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                    screenSharing ? 'bg-[#FCA311] text-[#14213D]' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}
                >
                  <Monitor size={18} />
                </button>
              )}

              {/* [Notes] */}
              <button
                onClick={toggleNotesDrawer}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  notesOpen ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Quick Notes & Scratchpad"
              >
                <FileText size={18} />
              </button>

              {/* [Chat] */}
              <button
                onClick={toggleChatDrawer}
                className={`p-2.5 sm:p-3 rounded-full transition flex items-center justify-center active:scale-95 cursor-pointer ${
                  chatOpen ? 'bg-[#FCA311] text-[#14213D]' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Toggle Text Chat"
              >
                <MessageCircle size={18} />
              </button>

              {/* [Report] */}
              {(otherUid || otherUidRef.current) && (
                <button
                  onClick={() => setReportOpen(true)}
                  className="p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-red-500/20 text-slate-300 hover:text-red-400 transition flex items-center justify-center active:scale-95 cursor-pointer"
                  title="Report & Strike User"
                >
                  <Flag size={18} />
                </button>
              )}

              {/* [Layout Switcher] */}
              {!isVoiceOnly && (
                <button
                  onClick={() => setLayoutMode((m) => (m === 'grid' ? 'spotlight' : 'grid'))}
                  className="p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center active:scale-95 cursor-pointer"
                  title={`Switch Layout (Current: ${layoutMode})`}
                >
                  {layoutMode === 'grid' ? <Columns size={18} /> : <LayoutGrid size={18} />}
                </button>
              )}

              <div className="h-6 w-px bg-white/15" />

              {/* [Next Stranger] (Amber button) */}
              <button
                onClick={handleNextStranger}
                disabled={isSearchingNext}
                className="h-10 px-4 sm:px-5 rounded-full font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap shadow-lg cursor-pointer bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] shadow-[0_4px_20px_rgba(252,163,17,0.35)] disabled:opacity-50"
                title="Skip to next stranger"
              >
                <Zap size={14} className="fill-current" />
                <span className="hidden sm:inline">Next Stranger</span>
              </button>

              {/* [Leave Call] (ONLY single red circular button at far right) */}
              <button
                onClick={leaveCallExplicit}
                className="p-2.5 sm:p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition flex items-center justify-center shadow-lg active:scale-95 cursor-pointer"
                title="Leave Call"
              >
                <PhoneOff size={18} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Slide-in In-Call Chat Drawer (Right-side) ──────────────────── */}
      {chatOpen && user && (
        <ChatPanel
          key={currentRoomId}
          roomId={currentRoomId}
          uid={user.uid}
          username={profile?.username || 'Stranger'}
          onClose={() => setChatOpen(false)}
        />
      )}

      {/* ── Quick Notes & Code Scratchpad Drawer ───────────────────────── */}
      {notesOpen && (
        <div className="fixed top-16 right-4 bottom-24 w-80 bg-[#14213D]/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 animate-slide-up">
          <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 text-white">
            <div className="flex items-center gap-2">
              <FileText size={15} />
              <span className="font-bold text-xs uppercase tracking-wider">Quick Notes</span>
            </div>
            <button
              onClick={() => setNotesOpen(false)}
              className="p-1 rounded-full hover:bg-emerald-700 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              notesRef.current = e.target.value;
            }}
            placeholder={`# Session Notes\nJot down ideas, links, tech stacks, or code snippets...\n\nClick "Save Note" to persist to your call history.`}
            className="flex-1 p-3.5 text-xs font-mono text-slate-100 bg-[#07090E]/60 resize-none focus:outline-none placeholder-slate-500 border-0"
            spellCheck={false}
          />

          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 bg-[#14213D]">
            <span className="text-[10px] text-slate-400">{notes.length} chars</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNotes('')}
                className="text-[10px] font-semibold text-slate-400 hover:text-red-400 transition cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={saveNoteStatus === 'saving'}
                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {saveNoteStatus === 'saved' ? (
                  <>
                    <CheckCircle2 size={12} /> Saved!
                  </>
                ) : saveNoteStatus === 'saving' ? (
                  'Saving...'
                ) : (
                  'Save Note'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Modal (Inspecting Partner) ─────────────────────────── */}
      {profileModalOpen && (
        <FriendProfileModal
          targetUid={inspectingUser?.uid || otherUid}
          initialProfile={inspectingUser?.profile || otherProfile}
          myUid={user?.uid}
          myUsername={profile?.username}
          onClose={() => {
            setProfileModalOpen(false);
            setInspectingUser(null);
          }}
        />
      )}

      {/* ── Report Modal ───────────────────────────────────────────────── */}
      {reportOpen && (
        <ReportModal onSubmit={handleReportSubmit} onClose={() => setReportOpen(false)} />
      )}

      {/* ── Post-Call Feedback Rating Modal (ONLY on explicit leave) ───── */}
      {feedbackOpen && (otherUid || otherUidRef.current) && (
        <FeedbackModal
          fromUid={user.uid}
          toUid={otherUid || otherUidRef.current}
          roomId={currentRoomId}
          onComplete={async () => {
            await logCurrentCallHistory();
            setFeedbackOpen(false);
            navigate('/dashboard');
          }}
        />
      )}

      {/* ── Networking Modal (Contact exchange) ────────────────────────── */}
      {networkingOpen && (
        <NetworkingModal
          roomId={currentRoomId}
          myUid={user?.uid}
          myProfile={profile}
          otherUid={otherUid || otherUidRef.current}
          onClose={async () => {
            await logCurrentCallHistory();
            setNetworkingOpen(false);
            navigate('/dashboard');
          }}
        />
      )}

      {/* ── SPEC-003: Room Full Modal ──────────────────────────────────── */}
      {roomFullBlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in font-sans">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springTransition}
            className="max-w-md w-full bg-[#121417] border border-white/15 rounded-3xl p-7 text-center shadow-2xl space-y-5 text-white"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-inner">
              <Users size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-white">Room is Full (3/3)</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                This conversation has reached its maximum capacity of 3 participants.
              </p>
            </div>
            <button
              onClick={() => {
                setRoomFullBlocked(false);
                navigate('/dashboard');
              }}
              className="w-full py-3 rounded-xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-extrabold text-xs shadow-[0_4px_15px_rgba(252,163,17,0.35)] transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <Rocket size={14} /> Start Your Own Conversation
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function CallRoom() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = (searchParams?.get('mode') || 'casual').toLowerCase();

  return (
    <CallRoomErrorBoundary>
      <CallRoomInner key={`${roomId || 'practice_room'}_${mode}`} />
    </CallRoomErrorBoundary>
  );
}
