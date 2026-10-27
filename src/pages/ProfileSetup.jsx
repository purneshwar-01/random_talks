import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Briefcase, Globe, Heart, ShieldCheck, Sparkles, Languages, Video, Mic } from 'lucide-react';

const MIN_AGE = 18;

const LANGUAGES = ['English', 'Spanish', 'Hindi', 'French', 'German', 'Japanese', 'Chinese', 'Other'];

export default function ProfileSetup() {
  const { updateProfile, profile } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    age: profile?.age || '',
    gender: profile?.gender || 'Any',
    occupation: profile?.occupation || '',
    country: profile?.country || 'Global',
    language: profile?.language || 'English',
    preferredMode: profile?.preferredMode || 'professional',
    cameraDefaultOn: profile?.cameraDefaultOn !== false,
    interests: Array.isArray(profile?.interests) ? profile.interests.join(', ') : '',
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const ageNum = parseInt(formData.age, 10);
    if (Number.isNaN(ageNum) || ageNum < MIN_AGE) {
      setError(`You must be ${MIN_AGE} or older to use this platform.`);
      return;
    }
    if (!ageConfirmed) {
      setError('Please confirm the community guidelines statement below to continue.');
      return;
    }

    const tags = formData.interests
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    await updateProfile({
      ...formData,
      age: ageNum,
      interests: tags,
      isAdult: true,
      isVerified: true,
      isProfileComplete: true,
      setupCompleted: true,
      trustScore: 100,
      strikeCount: 0,
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-900 font-sans">
      <div className="bg-white border border-slate-200 p-8 rounded-2xl max-w-lg w-full shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles size={13} /> Trust-First Profile Setup
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Set Up Your Identity
          </h2>
          <p className="text-slate-500 text-xs">
            Connect with verified professionals and genuine strangers safely.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <User size={14} className="text-indigo-600" /> Display Name / Username
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Alex Vance"
              value={formData.username}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition text-sm font-medium"
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Briefcase size={14} className="text-indigo-600" /> Profession / Role
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Software Engineer, Designer, Student, Creator"
              value={formData.occupation}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-medium"
              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                Age
              </label>
              <input
                required
                type="number"
                min={MIN_AGE}
                value={formData.age}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-medium"
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">
                Gender
              </label>
              <select
                value={formData.gender}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-medium"
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="Any">Any / Non-binary</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Globe size={14} className="text-indigo-600" /> Country / Region
              </label>
              <input
                type="text"
                placeholder="e.g. India, USA, Global"
                value={formData.country}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-medium"
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Languages size={14} className="text-indigo-600" /> Primary Language
              </label>
              <select
                value={formData.language}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-medium"
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Heart size={14} className="text-indigo-600" /> Key Topics & Hobbies (comma separated)
            </label>
            <input
              type="text"
              placeholder="AI, Web3, Startups, Gaming, Fitness, Music"
              value={formData.interests}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition text-sm font-medium"
              onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Camera Preference
            </label>
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="cam"
                  checked={formData.cameraDefaultOn}
                  onChange={() => setFormData({ ...formData, cameraDefaultOn: true })}
                />
                <Video size={14} className="text-indigo-600" /> Camera On by Default
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="cam"
                  checked={!formData.cameraDefaultOn}
                  onChange={() => setFormData({ ...formData, cameraDefaultOn: false })}
                />
                <Mic size={14} className="text-indigo-600" /> Audio/Voice Only Default
              </label>
            </div>
          </div>

          <label className="flex items-start gap-3 text-xs text-slate-600 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-0"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
            />
            <span className="leading-relaxed">
              <ShieldCheck size={14} className="inline text-emerald-600 mr-1" />
              I confirm I am <strong>{MIN_AGE}+</strong> years old. I agree to maintain respect, avoid harassment or spam, and follow community safety rules.
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-2xl bg-[#FCA311] hover:bg-[#E5930B] font-bold text-[#14213D] shadow-sm transition-all duration-150 active:scale-98 text-sm"
          >
            Complete Setup & Start Connecting
          </button>
        </form>
      </div>
    </div>
  );
}
