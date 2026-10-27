import { useEffect, useRef } from 'react';

export default function SpotlightShell({ children, className = '' }) {
  const shellRef = useRef(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || window.matchMedia('(pointer: coarse)').matches) return undefined;

    let frame = 0;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const updateTarget = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      shell.style.setProperty('--mouse-x', `${currentX}px`);
      shell.style.setProperty('--mouse-y', `${currentY}px`);
      frame = requestAnimationFrame(render);
    };

    window.addEventListener('pointermove', updateTarget, { passive: true });
    frame = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('pointermove', updateTarget);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={shellRef} className={`relative min-h-screen bg-slate-50 text-slate-900 raycast-halo ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.7),transparent_65%)]" />
      <div className="relative min-h-screen">{children}</div>
    </div>
  );
}