import { useEffect, useState } from 'react';

const LOADING_MESSAGES = [
  'Scanning for study & work partners...',
  'Calibrating real-time audio channels...',
];

export default function FluidLoadingOrb({ message }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((index) => (index + 1) % LOADING_MESSAGES.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 py-4" aria-live="polite">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="fluid-orb absolute inset-0" />
        <div className="relative z-10 h-8 w-8 rounded-full border border-white/50 bg-[#14213D]/80 shadow-lg" />
      </div>
      <p className="min-h-4 text-center font-mono text-xs font-semibold tracking-wide text-[#14213D]">
        {message || LOADING_MESSAGES[messageIndex]}
      </p>
    </div>
  );
}