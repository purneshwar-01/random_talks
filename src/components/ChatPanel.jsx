import { useEffect, useRef, useState } from 'react';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Send, X, Lock } from 'lucide-react';

export default function ChatPanel({ roomId, uid, username, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const [snapError, setSnapError] = useState(null);

  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (prevRoomId !== roomId) {
    setPrevRoomId(roomId);
    setMessages([]);
  }

  useEffect(() => {
    // Immediately reset message state on roomId change before snapshot resolves
    setMessages([]);
    setSnapError(null);

    const q = query(
      collection(db, 'calls', roomId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSnapError(null);
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('[ChatPanel] snapshot error:', err);
        setSnapError('Chat unavailable right now.');
      }
    );
    return unsub;
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [sendError, setSendError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    setSendError('');
    try {
      await addDoc(collection(db, 'calls', roomId, 'messages'), {
        uid,
        username,
        text: body.slice(0, 500),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[ChatPanel] send error:', err);
      setSendError('Message failed. Please try again.');
      setText(body); // restore so user can retry
    }
  };

  return (
    <div className="absolute right-5 top-20 bottom-24 w-80 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden z-20 pointer-events-auto shadow-xl font-sans text-slate-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
          <Lock size={13} className="text-[#FCA311]" /> Private Chat
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {snapError && (
          <p className="text-xs text-red-500 text-center mt-6 font-medium">{snapError}</p>
        )}
        {!snapError && messages.length === 0 && (
          <p className="text-xs text-slate-400 text-center mt-6">
            Say hi — messages here are private to your call.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.uid === uid ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] text-xs font-medium ${
                m.uid === uid
                  ? 'bg-[#14213D] text-white shadow-sm'
                  : 'bg-slate-50 border border-slate-200 text-slate-900'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <p className="px-4 pb-1 text-[10px] text-red-500 font-semibold">{sendError}</p>
      )}
      <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-slate-200 bg-white">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 bg-slate-50 border border-[#E5E5E5] rounded-full px-4 py-2 text-xs focus:outline-none focus:border-[#FCA311] focus:ring-1 focus:ring-[#FCA311]/50 text-slate-900 font-medium"
        />
        <button type="submit" className="p-2 rounded-full bg-[#FCA311] text-[#14213D] hover:bg-[#E5930B] transition shadow-sm">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
