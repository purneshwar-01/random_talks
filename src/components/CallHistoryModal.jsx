import { useEffect, useState } from 'react';
import {
  X,
  History,
  Clock,
  Calendar,
  FileText,
  User,
  Sparkles,
  Loader2,
  Video,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRecentCallHistory, deleteCallRecord } from '../lib/callHistory';
import FriendProfileModal from './FriendProfileModal';

function formatDuration(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

const MODE_COLORS = {
  professional: 'bg-blue-50 text-blue-700 border-blue-200',
  study: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  language: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  deeptalk: 'bg-purple-50 text-purple-700 border-purple-200',
  quicktalk: 'bg-amber-50 text-amber-700 border-amber-200',
  gaming: 'bg-rose-50 text-rose-700 border-rose-200',
  casual: 'bg-slate-100 text-slate-700 border-slate-200',
  voiceonly: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

export default function CallHistoryModal({ onClose }) {
  const { user, profile } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [inspectingStranger, setInspectingStranger] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getRecentCallHistory(user.uid, 5)
      .then((records) => {
        if (mounted) {
          setHistory(records);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[CallHistoryModal] getRecentCallHistory error:', err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const toggleNote = (callId) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [callId]: !prev[callId],
    }));
  };

  const handleDelete = async (callId) => {
    setHistory((prev) => prev.filter((c) => c.id !== callId));
    try {
      await deleteCallRecord(callId);
    } catch (err) {
      console.error('[CallHistoryModal] Delete error:', err);
    }
  };

  const handleOpenStrangerProfile = (call) => {
    if (call.strangerUid && call.strangerUid !== 'unknown') {
      setInspectingStranger({
        uid: call.strangerUid,
        username: call.strangerName || 'Stranger',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] relative overflow-hidden animate-scale-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#14213D] text-[#FCA311] flex items-center justify-center shadow-md">
              <History size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-xl">Recent Call History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Your video conversations from the last 5 days</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={30} className="animate-spin text-[#FCA311]" />
              <p className="text-xs font-semibold">Loading call history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-[#FCA311] flex items-center justify-center mx-auto border border-amber-200">
                <Video size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">No recent calls in the last 5 days</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Completed video chats lasting 3+ seconds are automatically logged here along with your session notes.
              </p>
            </div>
          ) : (
            history.map((call) => {
              const modeKey = (call.mode || 'casual').toLowerCase();
              const badgeStyle = MODE_COLORS[modeKey] || MODE_COLORS.casual;
              const hasNotes = Boolean(call.notes && call.notes.trim().length > 0);
              const isNotesOpen = expandedNotes[call.id];

              return (
                <div
                  key={call.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Avatar + Stranger Name (Clickable) */}
                    <div
                      onClick={() => handleOpenStrangerProfile(call)}
                      className={`flex items-center gap-2.5 ${
                        call.strangerUid && call.strangerUid !== 'unknown'
                          ? 'cursor-pointer group'
                          : ''
                      }`}
                      title={
                        call.strangerUid && call.strangerUid !== 'unknown'
                          ? 'View public profile'
                          : undefined
                      }
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#14213D] group-hover:bg-[#1E3A8A] text-white flex items-center justify-center font-bold text-xs shadow-sm transition">
                        {call.strangerName?.charAt(0).toUpperCase() || <User size={14} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#FCA311] transition flex items-center gap-1.5">
                          {call.strangerName || 'Stranger'}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {formatDate(call.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Badge, Duration, Notes Toggle, Delete Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeStyle}`}
                      >
                        {call.mode || 'Casual'}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-mono font-bold">
                        <Clock size={12} className="text-slate-400" />
                        {formatDuration(call.duration)}
                      </div>

                      {hasNotes && (
                        <button
                          onClick={() => toggleNote(call.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                            isNotesOpen
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title="Toggle Notes"
                        >
                          <FileText size={11} />
                          <span>Notes</span>
                          {isNotesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(call.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition cursor-pointer"
                        title="Delete Call Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Notes Drawer */}
                  {hasNotes && isNotesOpen && (
                    <div className="w-full bg-[#0E1526] text-slate-100 p-3.5 rounded-xl border border-slate-700/60 shadow-inner mt-2.5 flex items-start gap-3 animate-fade-in font-sans leading-relaxed box-border overflow-hidden">
                      <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                        <FileText size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                          <span>Session Note</span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-100 font-normal leading-relaxed whitespace-pre-wrap break-words select-text">
                          {call.notes}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles size={13} className="text-[#FCA311]" /> Total calls: {history.length}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Stranger Public Profile Modal */}
      {inspectingStranger && (
        <FriendProfileModal
          targetUid={inspectingStranger.uid}
          myUid={user?.uid}
          myUsername={profile?.username}
          onClose={() => setInspectingStranger(null)}
        />
      )}
    </div>
  );
}
