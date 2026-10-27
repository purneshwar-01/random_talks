import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { generateMatchmakingTips, FALLBACK_TIPS } from '../lib/geminiIcebreaker';

const MODE_LABELS = {
  professional: 'Professional & Tech',
  study: 'Study & Co-Work',
  language: 'Language Exchange',
  silent: 'Silent Accountability',
  casual: 'Casual & Banter',
  gaming: 'Gaming & Fun',
  banter: 'Light Banter',
  listening: 'Active Listening',
};

export default function ConnectionLoader({
  title = 'Finding your next conversation partner...',
  onCancel,
  mode = 'casual',
}) {
  const [tips, setTips] = useState(FALLBACK_TIPS || [
    '✨ Tip: Say a warm hello right away — first impressions spark great conversations!',
    '🛡️ Community Rule: Keep it respectful and polite. We maintain a zero-tolerance policy for toxicity.',
    '💡 Icebreaker Idea: Ask about their city, current passion project, or favorite hobby.',
    '⚡ Pro Tip: Use Quick Notes in the dock to jot down shared ideas and project links.',
    '🤝 Connection Goal: If you hit it off, hit "Add Friend" to stay connected for direct calls!',
  ]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const displayMode = MODE_LABELS[mode?.toLowerCase()] || mode || 'Casual';

  // Clean up any residual tuner debug state from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('rt_loader_config');
    } catch {
      // ignore
    }
  }, []);

  // Fetch dynamic tips from Gemini API
  useEffect(() => {
    let mounted = true;
    generateMatchmakingTips()
      .then((fetchedTips) => {
        if (mounted && Array.isArray(fetchedTips) && fetchedTips.length > 0) {
          setTips(fetchedTips);
        }
      })
      .catch((err) => {
        console.warn('[ConnectionLoader] Error generating matchmaking tips:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Cycle tips every 3.5s with a smooth fade
  useEffect(() => {
    if (!tips || tips.length === 0) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentTipIndex((prev) => (prev + 1) % tips.length);
        setFade(true);
      }, 250);
    }, 3500);

    return () => clearInterval(interval);
  }, [tips]);

  return (
    <div className="fixed inset-0 w-screen h-screen min-h-screen bg-black z-50 flex items-center justify-center select-none overflow-hidden animate-fade-in">
      {/* ── Atmospheric Centerpiece Hands Visual (Permanently Baked at 1.35x Scale, -100px Y-Offset) ── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-10"
        style={{
          transform: 'translateY(-100px)',
        }}
      >
        <img
          src="/loading-hands.gif"
          alt="Connecting hands"
          style={{
            transform: 'scale(1.35)',
            maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 50%, transparent 95%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 50%, transparent 95%)',
          }}
          className="w-full min-h-[75vh] sm:min-h-[85vh] h-[85vh] max-w-[95vw] md:max-w-7xl object-contain mix-blend-screen drop-shadow-[0_0_60px_rgba(6,182,212,0.45)] select-none"
        />
      </div>

      {/* ── Overlay Text Composition (Permanently Baked at +110px Y-Offset in Open Space) ── */}
      <div
        className="relative z-20 flex flex-col items-center justify-center text-center px-4 max-w-2xl mx-auto space-y-3.5 pointer-events-auto"
        style={{
          transform: 'translateY(110px)',
        }}
      >
        {/* Floating Mode Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] sm:text-xs font-mono font-bold text-[#FCA311] uppercase tracking-wider shadow-[0_0_25px_rgba(252,163,17,0.35)]">
          <span className="w-2 h-2 rounded-full bg-[#FCA311] animate-ping" />
          <span>MATCHING IN {displayMode.toUpperCase()}</span>
        </div>

        {/* Main Status Heading */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
          {title}
        </h2>

        {/* Cycling Conversation Etiquette Tips */}
        <div className="min-h-[48px] sm:min-h-[56px] flex items-center justify-center px-4">
          <p
            className={`text-slate-200 font-medium text-xs sm:text-sm md:text-base text-center leading-relaxed max-w-lg mx-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] transition-opacity duration-300 ${
              fade ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-1'
            }`}
          >
            {tips[currentTipIndex] || 'Connecting you to the next available conversation...'}
          </p>
        </div>
      </div>

      {/* ── Anchored Leave Queue Button (Bottom-center with subtle frosted glass) ── */}
      {onCancel && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 backdrop-blur-md transition-all duration-200 active:scale-95 flex items-center gap-2 shadow-[0_4px_30px_rgba(0,0,0,0.7)] hover:border-white/40 cursor-pointer"
          >
            <X size={16} className="text-slate-200" />
            <span>Leave Queue</span>
          </button>
        </div>
      )}
    </div>
  );
}