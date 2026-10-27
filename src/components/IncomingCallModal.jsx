import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, PhoneCall } from 'lucide-react';
import { acceptCallInvite, declineCallInvite } from '../lib/directCalls';
import { ensureCallRoom } from '../lib/matchmaking';
import { useNavigate } from 'react-router-dom';

const CHIME_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function IncomingCallModal({ invite, myUid }) {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Play ringtone
  useEffect(() => {
    if (!invite) return;
    const audio = new Audio(CHIME_URL);
    audio.loop = true;
    audioRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [invite]);

  if (!invite) return null;

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    audioRef.current?.pause();
    try {
      // Ensure the call room doc exists so CallRoom.jsx finds participants.
      await ensureCallRoom(invite.roomId, [invite.callerUid, myUid], { isDirect: true });
      // Remove the invite doc.
      await acceptCallInvite(myUid);
      // Navigate to the room — caller is already waiting there.
      navigate(`/call/${invite.roomId}?mode=direct`);
    } catch (err) {
      console.error('[IncomingCall] accept error:', err);
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (declining) return;
    setDeclining(true);
    audioRef.current?.pause();
    // declineCallInvite now sets status:'declined' so the caller
    // can see it via onSnapshot before the doc is eventually removed.
    await declineCallInvite(myUid);
    setDeclining(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full shadow-xl text-center space-y-5 relative overflow-hidden animate-scale-pop">
        {/* Animated ring */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 rounded-3xl border-2 border-amber-400/40 animate-ping" />
        </div>

        {/* Avatar */}
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 rounded-2xl bg-[#14213D] flex items-center justify-center text-white font-bold text-3xl shadow-lg">
            {invite.callerName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center">
            <PhoneCall size={12} className="text-white" />
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="text-xs font-bold text-[#14213D] uppercase tracking-wider">Incoming Call</p>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1">{invite.callerName}</h3>
          <p className="text-xs text-slate-500 mt-0.5">wants to video call you</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-6 pt-2">
          <button
            onClick={handleDecline}
            disabled={declining || accepting}
            className="flex flex-col items-center gap-2 group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full bg-red-100 hover:bg-red-500 border border-red-200 flex items-center justify-center transition active:scale-95 group-hover:border-red-500">
              <PhoneOff size={22} className="text-red-500 group-hover:text-white transition" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 group-hover:text-red-500 transition">
              {declining ? 'Declining...' : 'Decline'}
            </span>
          </button>

          <button
            onClick={handleAccept}
            disabled={accepting || declining}
            className="flex flex-col items-center gap-2 group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition shadow-lg shadow-emerald-500/30 active:scale-95 animate-bounce">
              <Phone size={22} className="text-white" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600">
              {accepting ? 'Joining...' : 'Accept'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
