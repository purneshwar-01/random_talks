import { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  Shield,
  Briefcase,
  Globe,
  Languages,
  UserPlus,
  Check,
  Linkedin,
  Github,
  Award,
  Loader2,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendFriendRequest, checkIsFriend, checkPendingRequest } from '../lib/friends';

export default function FriendProfileModal({
  targetUid,
  initialProfile = null,
  myUid,
  myUsername,
  onClose,
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(!initialProfile && !!targetUid);
  const [friendStatus, setFriendStatus] = useState('none');
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (!targetUid) return;

    let mounted = true;
    (async () => {
      try {
        if (!initialProfile) {
          const snap = await getDoc(doc(db, 'users', targetUid));
          if (mounted && snap.exists()) {
            setProfile(snap.data());
          }
        }
        if (myUid && myUid !== targetUid) {
          const isFriend = await checkIsFriend(myUid, targetUid);
          if (mounted && isFriend) {
            setFriendStatus('friends');
          } else {
            const pending = await checkPendingRequest(myUid, targetUid);
            if (mounted && pending) setFriendStatus('pending');
          }
        }
      } catch (err) {
        console.error('[FriendProfileModal] error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [targetUid, initialProfile, myUid]);

  const handleAddFriend = async () => {
    if (!targetUid || !myUid || friendStatus !== 'none' || sendingRequest) return;
    setSendingRequest(true);
    try {
      await sendFriendRequest({
        fromUid: myUid,
        fromUsername: myUsername || 'Stranger',
        toUid: targetUid,
      });
      setFriendStatus('pending');
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans animate-fade-in">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-md shadow-2xl flex flex-col relative overflow-hidden animate-scale-pop">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-[#14213D] to-[#1E3A8A] relative p-4 flex items-start justify-end">
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white transition backdrop-blur-md"
          >
            <X size={16} />
          </button>
        </div>

        {/* Profile details */}
        <div className="px-6 pb-6 pt-0 -mt-10 space-y-5">
          {/* Avatar & Header */}
          <div className="flex items-end justify-between">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-[#14213D] border-4 border-white flex items-center justify-center text-white font-extrabold text-2xl shadow-lg">
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
            </div>
          </div>

          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-[#FCA311]" />
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-extrabold text-slate-900 truncate">
                    {profile?.username || 'Stranger'}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-[11px] font-black shadow-2xs">
                    <Shield size={12} className="text-[#FCA311] fill-amber-400/20 shrink-0" />
                    <span>{profile?.karmaScore ?? 0} Karma</span>
                  </span>
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0" title="Verified Member" />
                </div>
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <Briefcase size={14} className="text-[#FCA311]" />
                  {profile?.occupation || 'Member'}
                </p>
              </div>

              {/* Badges / Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col items-center text-center">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mb-1">
                    <Shield size={14} className="text-amber-600 fill-amber-500/20" />
                  </div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Builder Karma</p>
                  <p className="text-xs font-black text-amber-600">
                    {profile?.karmaScore ?? 0} pts
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col items-center text-center">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mb-1">
                    <Award size={14} />
                  </div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Trust Score</p>
                  <p className="text-xs font-black text-emerald-700">
                    {profile?.trustScore ?? 100}%
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col items-center text-center">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mb-1">
                    <Globe size={14} />
                  </div>
                  <p className="text-[9px] uppercase font-bold text-slate-400">Location</p>
                  <p className="text-xs font-black text-slate-800 truncate max-w-full">
                    {profile?.country || 'Global'}
                  </p>
                </div>
              </div>

              {/* Language & Hobbies */}
              <div className="space-y-3 pt-1">
                {profile?.language && (
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <Languages size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-500">Primary Language:</span>
                    <span className="font-bold text-slate-800">{profile.language}</span>
                  </div>
                )}

                {Array.isArray(profile?.interests) && profile.interests.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Topics &amp; Interests
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="bg-amber-50 text-[#14213D] border border-amber-200/80 text-xs font-semibold px-2.5 py-1 rounded-full"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {(profile?.linkedin || profile?.github) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {profile.linkedin && (
                      <a
                        href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl font-bold hover:bg-blue-100 transition"
                      >
                        <Linkedin size={13} /> LinkedIn
                      </a>
                    )}
                    {profile.github && (
                      <a
                        href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-bold hover:bg-slate-200 transition"
                      >
                        <Github size={13} /> GitHub
                      </a>
                    )}
                  </div>
                )}

                {/* Friend Action Button */}
                {myUid && targetUid && myUid !== targetUid && (
                  <div className="pt-2">
                    {friendStatus === 'friends' ? (
                      <div className="w-full py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-center gap-2">
                        <Check size={16} />
                        You are Connected as Friends
                      </div>
                    ) : friendStatus === 'pending' ? (
                      <div className="w-full py-3 px-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
                        <Check size={16} />
                        Friend Request Sent
                      </div>
                    ) : (
                      <button
                        onClick={handleAddFriend}
                        disabled={sendingRequest}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {sendingRequest ? (
                          <Loader2 size={16} className="animate-spin text-slate-900" />
                        ) : (
                          <UserPlus size={16} className="text-slate-900" />
                        )}
                        <span>Send Friend Request</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
