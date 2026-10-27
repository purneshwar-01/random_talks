import { useEffect, useRef, useState } from 'react';
import { Send, X, Lock, MessageCircle, Clock } from 'lucide-react';
import { sendDm, listenToDm } from '../lib/dm';

export default function DmDrawer({ myUid, friend, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef(null);

  // Real-time message listener
  useEffect(() => {
    if (!myUid || !friend?.uid) return;
    const unsub = listenToDm(myUid, friend.uid, setMessages);
    return unsub;
  }, [myUid, friend?.uid]);

  // Auto-scroll to newest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    const saved = body;
    setText('');
    try {
      await sendDm(myUid, friend.uid, saved);
    } catch (err) {
      console.error('[DmDrawer] send error:', err);
      setSendError('Failed to send. Tap to retry.');
      setText(saved);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-6 z-50 w-80 flex flex-col shadow-xl rounded-t-3xl overflow-hidden border border-slate-200 bg-white font-sans text-slate-900 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#14213D] text-white">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">
          {friend?.username?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{friend?.username || 'Friend'}</p>
          <p className="text-[10px] text-slate-300 truncate">{friend?.occupation || 'Member'}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition">
          <X size={16} />
        </button>
      </div>

      {/* Retention notice indicator */}
      <div className="bg-slate-100/90 border-b border-slate-200/80 px-3 py-1.5 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
        <Clock size={12} className="text-slate-400 shrink-0" />
        <span>Messages are automatically retained for 5 days</span>
      </div>

      {/* Messages */}
      <div className="flex-1 h-72 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-slate-400">
            <MessageCircle size={28} className="text-indigo-200" />
            <p className="text-xs font-medium">Start your private conversation!</p>
          </div>
        )}
        {messages.map((m) => {
          const isMine = m.senderUid === myUid;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span
                className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] text-xs font-medium break-words ${
                  isMine
                    ? 'bg-[#14213D] text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md shadow-sm'
                }`}
              >
                {m.text}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {sendError && (
        <p className="px-4 py-1 text-[10px] text-red-500 font-semibold bg-red-50 border-t border-red-100">
          {sendError}
        </p>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 bg-white"
      >
        <div className="flex items-center gap-1 text-[#FCA311] pl-1">
          <Lock size={11} />
        </div>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          maxLength={500}
          disabled={sending}
          className="flex-1 bg-slate-50 border border-[#E5E5E5] rounded-full px-3 py-1.5 text-xs focus:outline-none focus:border-[#FCA311] focus:bg-white text-slate-900 font-medium transition"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="p-2 rounded-full bg-[#FCA311] text-[#14213D] hover:bg-[#E5930B] transition shadow-sm disabled:opacity-40 active:scale-95"
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  );
}
