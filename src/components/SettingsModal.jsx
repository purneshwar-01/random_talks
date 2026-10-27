import { useState } from 'react';
import {
  X,
  Mail,
  User,
  Briefcase,
  Globe,
  Heart,
  Languages,
  Video,
  Mic,
  ShieldCheck,
  Check,
  Loader2,
  Linkedin,
  Github,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MIN_AGE = 18;
const LANGUAGES = ['English', 'Spanish', 'Hindi', 'French', 'German', 'Japanese', 'Chinese', 'Other'];

export default function SettingsModal({ onClose }) {
  const { user, profile, updateProfile } = useAuth();

  const [formData, setFormData] = useState({
    username:        profile?.username        || '',
    occupation:      profile?.occupation      || '',
    age:             profile?.age             || '',
    gender:          profile?.gender          || 'Any',
    country:         profile?.country         || 'Global',
    language:        profile?.language        || 'English',
    interests:       Array.isArray(profile?.interests) ? profile.interests.join(', ') : '',
    cameraDefaultOn: profile?.cameraDefaultOn !== false,
    linkedin:        profile?.linkedin        || '',
    github:          profile?.github          || '',
  });

  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  const set = (key, val) => setFormData((prev) => ({ ...prev, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const ageNum = parseInt(formData.age, 10);
    if (Number.isNaN(ageNum) || ageNum < MIN_AGE) {
      setError('You must be 18 or older to use RandomTalks');
      return;
    }

    const tags = formData.interests
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    setSaving(true);
    try {
      await updateProfile({
        username:        formData.username,
        occupation:      formData.occupation,
        age:             ageNum,
        gender:          formData.gender,
        country:         formData.country,
        language:        formData.language,
        interests:       tags,
        cameraDefaultOn: formData.cameraDefaultOn,
        linkedin:        formData.linkedin.trim(),
        github:          formData.github.trim(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save. Please try again.');
      console.error('[SettingsModal] updateProfile error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden animate-scale-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="font-extrabold text-slate-900 text-xl">Account Settings</h2>
            <p className="text-sm text-slate-500 mt-0.5">Update your profile details anytime.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSave} className="overflow-y-auto px-6 py-5 space-y-4 flex-1">
          {/* Email — read-only */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Mail size={12} className="text-[#FCA311]" /> Gmail / Email Address
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <span className="text-sm text-slate-700 font-medium flex-1 truncate">
                {user?.email || '—'}
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                Read-only
              </span>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <User size={12} className="text-[#FCA311]" /> Display Name
            </label>
            <input
              required
              type="text"
              value={formData.username}
              onChange={(e) => set('username', e.target.value)}
              placeholder="e.g. Alex Vance"
              className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#FCA311] focus:bg-white transition"
            />
          </div>

          {/* Profession */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Briefcase size={12} className="text-[#FCA311]" /> Profession / Role
            </label>
            <input
              required
              type="text"
              value={formData.occupation}
              onChange={(e) => set('occupation', e.target.value)}
              placeholder="e.g. Software Engineer, Student"
              className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#FCA311] focus:bg-white transition"
            />
          </div>

          {/* Age + Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Age</label>
              <input
                required
                type="number"
                min={MIN_AGE}
                value={formData.age}
                onChange={(e) => set('age', e.target.value)}
                className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#FCA311] focus:bg-white transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => set('gender', e.target.value)}
                className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#FCA311] focus:bg-white transition"
              >
                <option value="Any">Any / Non-binary</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          {/* Country + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Globe size={12} className="text-[#FCA311]" /> Country
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="India, USA, Global"
                className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#FCA311] focus:bg-white transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                <Languages size={12} className="text-[#FCA311]" /> Language
              </label>
              <select
                value={formData.language}
                onChange={(e) => set('language', e.target.value)}
                className="w-full bg-slate-50 border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-[#FCA311] focus:bg-white transition"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Hobbies */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Heart size={12} className="text-indigo-500" /> Topics &amp; Hobbies (comma-separated, max 5)
            </label>
            <input
              type="text"
              value={formData.interests}
              onChange={(e) => set('interests', e.target.value)}
              placeholder="AI, Gaming, Music, Travel, Fitness"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Camera preference */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Camera Default
            </label>
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="cam-settings"
                  checked={formData.cameraDefaultOn}
                  onChange={() => set('cameraDefaultOn', true)}
                  className="accent-indigo-600"
                />
                <Video size={13} className="text-indigo-600" /> Camera On
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="cam-settings"
                  checked={!formData.cameraDefaultOn}
                  onChange={() => set('cameraDefaultOn', false)}
                  className="accent-indigo-600"
                />
                <Mic size={13} className="text-indigo-600" /> Audio Only
              </label>
            </div>
          </div>

          {/* Verified badge */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <p className="text-[11px] text-emerald-700 font-semibold">
              This account is verified. Trust score: <strong>{profile?.trustScore ?? 100}%</strong>
            </p>
          </div>

          {/* Professional Links */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Professional Links (shown post-call)</p>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Linkedin size={11} className="text-blue-600" /> LinkedIn URL
              </label>
              <input
                type="url"
                value={formData.linkedin}
                onChange={(e) => set('linkedin', e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Github size={11} className="text-slate-700" /> GitHub Username
              </label>
              <input
                type="text"
                value={formData.github}
                onChange={(e) => set('github', e.target.value)}
                placeholder="your-github-username"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 px-3 py-2.5 rounded-xl border border-red-200">
              {error}
            </p>
          )}
        </form>

        {/* Footer actions */}
        <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSave}
            disabled={saving}
              className="flex-1 py-3 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 size={15} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check size={15} /> Saved!</>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
