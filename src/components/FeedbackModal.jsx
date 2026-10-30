import { useState } from 'react';
import { ThumbsUp, Frown, Flag, X, Check, Shield, Sparkles, MessageSquare } from 'lucide-react';
import { submitPostChatFeedback, upvoteUserKarma } from '../lib/moderation';

export default function FeedbackModal({ fromUid, toUid, roomId, onComplete }) {
  const [submitted, setSubmitted] = useState(false);
  const [awardedKarma, setAwardedKarma] = useState(null);
  const [endorsementTitle, setEndorsementTitle] = useState('');

  const handleKarmaEndorsement = async (points, title) => {
    setAwardedKarma(points);
    setEndorsementTitle(title);
    setSubmitted(true);
    try {
      if (toUid) {
        await upvoteUserKarma(toUid, points);
      }
      await submitPostChatFeedback({
        fromUid,
        toUid,
        roomId,
        rating: `endorse_${points}_${title.toLowerCase().replace(/\s+/g, '_')}`,
      });
    } catch (err) {
      console.warn('[FeedbackModal] Karma endorse notice:', err);
    }
    setTimeout(() => {
      onComplete();
    }, 1200);
  };

  const handleRating = async (rating) => {
    setSubmitted(true);
    await submitPostChatFeedback({ fromUid, toUid, roomId, rating });
    setTimeout(() => {
      onComplete();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans animate-fade-in">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl text-center space-y-4 relative animate-scale-pop">
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X size={16} />
        </button>

        {!submitted ? (
          <>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-bold">
                <Shield size={12} className="text-amber-500 fill-amber-500/20" />
                <span>Builder Karma &amp; Trust</span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900">How was your session?</h3>
              <p className="text-xs text-slate-500">Endorse your partner or rate the conversation.</p>
            </div>

            {/* 1-Click Karma Endorsements */}
            <div className="space-y-2 pt-1 text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
                1-Click Karma Endorsement
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleKarmaEndorsement(5, 'Great Conversation')}
                  className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 text-[#14213D] transition active:scale-95 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-200/60 text-amber-900 flex items-center justify-center group-hover:scale-110 transition">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black block leading-tight">Great Conversation</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-200/50 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      +5 Karma
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleKarmaEndorsement(10, 'Helpful Builder')}
                  className="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100/90 hover:to-orange-100/90 border border-orange-200/80 text-[#14213D] transition active:scale-95 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-200/60 text-orange-900 flex items-center justify-center group-hover:scale-110 transition">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black block leading-tight">Helpful Builder</span>
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-200/50 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      +10 Karma
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* General Match Rating Options */}
            <div className="pt-2 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRating('great')}
                  className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <ThumbsUp size={16} className="text-emerald-600" />
                  Great Chat
                </button>
                <button
                  type="button"
                  onClick={() => handleRating('mismatch')}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <Frown size={16} className="text-slate-500" />
                  Mismatch
                </button>
                <button
                  type="button"
                  onClick={() => handleRating('spam')}
                  className="p-2.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-700 font-bold text-[11px] flex flex-col items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  <Flag size={16} className="text-red-500" />
                  Spam / Rude
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-6 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              {awardedKarma ? <Shield size={28} className="text-amber-500 fill-amber-500/20" /> : <Check size={28} className="text-emerald-600" />}
            </div>
            <div>
              <p className="text-base font-extrabold text-slate-900">
                {awardedKarma ? `+${awardedKarma} Karma Awarded! 🛡️` : 'Thank you for your feedback!'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {awardedKarma
                  ? `You endorsed your partner as "${endorsementTitle}".`
                  : 'Your response helps improve discovery across the network.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
