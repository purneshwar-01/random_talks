import { useEffect, useState } from 'react';
import { PhoneOff, Loader2 } from 'lucide-react';

/**
 * Fullscreen overlay shown on the caller's side while waiting
 * for the receiver to accept/decline a direct call.
 */
export default function CallingOverlay({ friend, onCancel }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm font-sans p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-xs w-full shadow-xl text-center space-y-6 relative overflow-hidden">
        {/* Pulse ring */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl border-2 border-amber-400/30 animate-ping" />

        {/* Avatar */}
        <div className="relative mx-auto w-24 h-24">
          <div className="w-24 h-24 rounded-2xl bg-[#14213D] flex items-center justify-center text-white font-black text-4xl shadow-lg shadow-slate-900/20">
            {friend?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          {/* Animated ring around avatar */}
          <div className="absolute -inset-2 rounded-2xl border-2 border-amber-400/40 animate-ping" />
        </div>

        <div>
          <p className="text-[11px] font-bold text-[#14213D] uppercase tracking-widest">Calling</p>
          <h3 className="text-xl font-extrabold text-slate-900 mt-1">{friend?.username}</h3>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Waiting for response{dots}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Loader2 size={16} className="animate-spin text-[#FCA311]" />
          <span className="text-xs text-slate-600 font-semibold">Ringing</span>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95"
        >
          <PhoneOff size={16} /> Cancel Call
        </button>
      </div>
    </div>
  );
}
