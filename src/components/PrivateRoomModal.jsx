import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Lock, Key, Copy, Check, X, ArrowRight } from 'lucide-react';

function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function PrivateRoomModal({ user, onClose }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('create');
  const [generatedCode, setGeneratedCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copiedTarget, setCopiedTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const code = generate6DigitCode();
      const roomId = `private_${code}`;

      // Create private room entry (accessible by all authed users)
      await setDoc(doc(db, 'privateRooms', code), {
        code,
        roomId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Create call room entry
      await setDoc(doc(db, 'calls', roomId), {
        participants: [user.uid],
        isPrivate: true,
        code,
        status: 'active',
        isEnded: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      setGeneratedCode(code);
      setLoading(false);
    } catch (err) {
      console.error('Create private room error:', err);
      setError('Failed to create private room. Try again.');
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    const cleanCode = inputCode.trim();
    if (cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Check privateRooms collection (no permission error!)
      const roomRef = doc(db, 'privateRooms', cleanCode);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setError('Room not found. Please check the code.');
        setLoading(false);
        return;
      }

      const roomId = roomSnap.data().roomId || `private_${cleanCode}`;

      // Use setDoc with merge so the joiner doesn't need to already be in
      // participants (updateDoc would fail with 403 under the new rules).
      // arrayUnion safely appends without duplicating.
      const callRef = doc(db, 'calls', roomId);
      await setDoc(
        callRef,
        { participants: arrayUnion(user.uid) },
        { merge: true }
      );

      onClose();
      navigate(`/call/${roomId}?mode=group`);
    } catch (err) {
      console.error('Join private room error:', err);
      setError('Failed to join room. Please check the code.');
    }
    setLoading(false);
  };

  const copyValue = async (value, target) => {
    await navigator.clipboard.writeText(value);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(''), 2000);
  };

  const roomId = generatedCode ? `private_${generatedCode}` : '';
  const directUrl = roomId ? `${window.location.origin}/call/${roomId}?mode=group` : '';

  const enterRoom = () => {
    if (!roomId) return;
    onClose();
    navigate(`/call/${roomId}?mode=group`);
  };

  return (
    <div className="fixed inset-0 bg-[#14213D]/40 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 md:p-8 max-w-md w-full shadow-xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-[#14213D] hover:bg-slate-100 transition"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#14213D] flex items-center justify-center mx-auto">
            <Lock size={22} />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight text-[#14213D]">Private Code Room</h3>
          <p className="text-sm font-medium leading-relaxed text-[#475569] max-w-xs mx-auto">
            Create a private room with a 6-digit code or enter a code shared by a friend.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-bold">
          <button
            onClick={() => {
              setTab('create');
              setError('');
            }}
            className={`py-2 rounded-lg transition ${
              tab === 'create' ? 'bg-white text-[#14213D] shadow-sm' : 'text-slate-500'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => {
              setTab('join');
              setError('');
            }}
            className={`py-2 rounded-lg transition ${
              tab === 'join' ? 'bg-white text-[#14213D] shadow-sm' : 'text-slate-500'
            }`}
          >
            Join Room
          </button>
        </div>

        {tab === 'create' ? (
          <div className="space-y-4 text-center">
            {!generatedCode ? (
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-bold shadow-[0_10px_25px_-5px_rgba(252,163,17,0.35)] transition text-sm flex items-center justify-center gap-2"
              >
                <Key size={16} /> {loading ? 'Generating Code...' : 'Generate 6-Digit Room Code'}
              </button>
            ) : (
              <div className="space-y-4 bg-amber-50/50 border border-amber-200 p-5 rounded-2xl">
                <p className="text-xs font-bold text-[#14213D] uppercase tracking-wider">Your Room Code</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl font-bold tracking-widest text-[#14213D] bg-slate-100 p-3 rounded-xl border border-[#E5E5E5]">
                    {generatedCode}
                  </span>
                  <button
                    onClick={() => copyValue(generatedCode, 'code')}
                    className="p-3 rounded-xl bg-white border border-[#E5E5E5] text-[#14213D] hover:bg-slate-100 transition shadow-sm"
                    title="Copy Code"
                  >
                    {copiedTarget === 'code' ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => copyValue(directUrl, 'url')}
                    className="rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-xs font-semibold text-[#14213D] shadow-sm transition hover:bg-slate-50"
                  >
                    {copiedTarget === 'url' ? 'Copied!' : 'Copy Direct URL'}
                  </button>
                  <button
                    onClick={enterRoom}
                    className="rounded-xl bg-[#14213D] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d3159]"
                  >
                    Enter Room Now
                  </button>
                </div>
                <p className="text-[11px] font-medium text-slate-500">
                  Share the code or direct URL, then enter whenever you are ready.
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#475569] block mb-1">
                Enter 6-Digit Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit room code"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl p-3 text-center text-xl font-bold tracking-widest text-[#14213D] uppercase focus:outline-none focus:border-[#FCA311] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading || inputCode.length !== 6}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-bold shadow-sm transition text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ArrowRight size={16} /> {loading ? 'Joining...' : 'Join Private Room'}
            </button>
          </form>
        )}

        {error && (
          <p className="text-xs text-red-500 font-semibold text-center bg-red-50 p-2.5 rounded-xl border border-red-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
