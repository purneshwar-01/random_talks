import confetti from 'canvas-confetti';

/**
 * Standard Framer Motion Spring Physics configuration
 * Enforced by Iron Law 31 of RandomTalks Pro Engineering (.antigravity/rules.md)
 */
export const springTransition = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
};

export const snappySpring = {
  type: 'spring',
  stiffness: 450,
  damping: 25,
};

export const modalMotionVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springTransition },
  exit: { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
};

export const drawerRightMotionVariants = {
  hidden: { opacity: 0, x: '100%' },
  visible: { opacity: 1, x: 0, transition: springTransition },
  exit: { opacity: 0, x: '100%', transition: { duration: 0.2 } },
};

export const backdropMotionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Celebratory micro-delight burst
 * Enforced by Iron Law 40 (.antigravity/rules.md)
 */
export function triggerCelebrationConfetti() {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#FCA311', '#14213D', '#10B981', '#3B82F6'],
  });
}
