import { useEffect, useState } from 'react';
import { Linkedin, Github, X, Handshake, CheckCircle, ExternalLink } from 'lucide-react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Post-call networking modal — "Exchange Professional Contacts?"
 * Both users must click "Share My Profile" for contacts to be revealed.
 *
 * Firestore path: /networkExchanges/{roomId}/intents/{uid}
 * Fields: { uid, sharedAt, linkedin, github, displayName }
 */
export default function NetworkingModal({ roomId, myUid, myProfile, otherUid, onClose }) {
  const [myShared, setMyShared]     = useState(false);
  const [otherShared, setOtherShared] = useState(false);
  const [otherData, setOtherData]   = useState(null);
  const [sharing, setSharing]       = useState(false);
  const [countdown, setCountdown]   = useState(20);

  // Auto-close after 20 seconds if neither shares.
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); onClose(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onClose]);

  // Listen for the other user's intent.
  useEffect(() => {
    if (!otherUid || !roomId) return;
    const unsub = onSnapshot(
      doc(db, 'networkExchanges', roomId, 'intents', otherUid),
      (snap) => {
        if (snap.exists()) {
          setOtherShared(true);
          setOtherData(snap.data());
        }
      }
    );
    return unsub;
  }, [roomId, otherUid]);

  const handleShare = async () => {
    if (myShared || sharing) return;
    setSharing(true);
    try {
      await setDoc(doc(db, 'networkExchanges', roomId, 'intents', myUid), {
        uid:         myUid,
        displayName: myProfile?.username || 'Anonymous',
        linkedin:    myProfile?.linkedin || '',
        github:      myProfile?.github   || '',
        sharedAt:    serverTimestamp(),
      });
      setMyShared(true);
    } catch (err) {
      console.error('[Networking] share error:', err);
    } finally {
      setSharing(false);
    }
  };

  const bothShared = myShared && otherShared;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full shadow-xl overflow-hidden animate-scale-pop">
        {/* Header */}
        <div className="bg-[#14213D] p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/20 transition">
            <X size={15} />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3 shadow">
            <Handshake size={28} className="text-white" />
          </div>
          <h3 className="font-extrabold text-lg">Exchange Contacts?</h3>
          <p className="text-xs text-slate-200 mt-1">
            Both must share for contacts to be revealed. Auto-closes in {countdown}s.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Mutual reveal panel — shown only when both shared */}
          {bothShared && otherData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 justify-center">
                <CheckCircle size={18} />
                <p className="font-bold text-sm">Both profiles shared! 🎉</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{otherData.displayName}</p>
                {otherData.linkedin ? (
                  <a href={otherData.linkedin} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-xs font-semibold text-[#14213D] hover:text-[#FCA311] transition">
                    <Linkedin size={14} /> {otherData.linkedin}
                    <ExternalLink size={11} className="ml-auto shrink-0" />
                  </a>
                ) : null}
                {otherData.github ? (
                  <a href={`https://github.com/${otherData.github}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition">
                    <Github size={14} /> github.com/{otherData.github}
                    <ExternalLink size={11} className="ml-auto shrink-0" />
                  </a>
                ) : null}
                {!otherData.linkedin && !otherData.github && (
                  <p className="text-xs text-slate-400 italic">No links provided yet — ask them to add LinkedIn/GitHub in Settings.</p>
                )}
              </div>

              <button onClick={onClose}
                    className="w-full py-3 rounded-2xl bg-[#FCA311] text-[#14213D] font-bold text-sm hover:bg-[#E5930B] transition">
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status pills */}
              <div className="flex items-center justify-center gap-3">
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${myShared ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {myShared ? '✓ You shared' : 'You: waiting'}
                </span>
                <span className="text-slate-300 text-xs font-bold">↔</span>
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${otherShared ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  {otherShared ? '✓ Them: shared' : 'Them: waiting'}
                </span>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Add LinkedIn &amp; GitHub in <strong>Settings ⚙️</strong> so they appear here.
              </p>

              {!myShared ? (
                <button onClick={handleShare} disabled={sharing}
                  className="w-full py-3.5 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50">
                  {sharing ? 'Sharing...' : '🤝 Share My Profile'}
                </button>
              ) : (
                <div className="w-full py-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={15} /> Shared! Waiting for them...
                </div>
              )}

              <button onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 font-semibold text-xs hover:bg-slate-50 transition">
                Skip — No thanks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
