import { useState } from 'react';
import { ThumbsUp, Frown, Flag, X, Check } from 'lucide-react';
import { submitPostChatFeedback } from '../lib/moderation';

export default function FeedbackModal({ fromUid, toUid, roomId, onComplete }) {
  const [submitted, setSubmitted] = useState(false);

  const handleRating = async (rating) => {
    setSubmitted(true);
    await submitPostChatFeedback({ fromUid, toUid, roomId, rating });
    setTimeout(() => {
      onComplete();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-xl text-center space-y-4 relative">
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        >
          <X size={16} />
        </button>

        {!submitted ? (
          <>
            <h3 className="text-lg font-bold text-slate-900">How was this conversation?</h3>
            <p className="text-xs text-slate-500">Your quick rating improves matchmaking quality.</p>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={() => handleRating('great')}
                className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95"
              >
                <ThumbsUp size={20} className="text-emerald-600" />
                Great Chat
              </button>
              <button
                onClick={() => handleRating('mismatch')}
                className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95"
              >
                <Frown size={20} className="text-slate-500" />
                Mismatch
              </button>
              <button
                onClick={() => handleRating('spam')}
                className="p-3.5 rounded-2xl border border-red-200 bg-red-50/50 hover:bg-red-100 text-red-700 font-bold text-xs flex flex-col items-center gap-1.5 transition active:scale-95"
              >
                <Flag size={20} className="text-red-500" />
                Spam / Rude
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <Check size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">Thank you for your feedback!</p>
          </div>
        )}
      </div>
    </div>
  );
}
