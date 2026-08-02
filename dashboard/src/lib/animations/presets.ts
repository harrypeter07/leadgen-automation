// dashboard/src/lib/animations/presets.ts
import gsap from 'gsap';
import { EASINGS, DURATIONS } from './easings';

export const PRESETS = {
  fadeIn: (target: gsap.TweenTarget, delay = 0) => {
    return gsap.fromTo(
      target,
      { opacity: 0 },
      { opacity: 1, duration: DURATIONS.normal, ease: EASINGS.power3, delay }
    );
  },
  scaleUp: (target: gsap.TweenTarget, delay = 0) => {
    return gsap.fromTo(
      target,
      { opacity: 0, scale: 0.96 },
      { opacity: 1, scale: 1, duration: DURATIONS.normal, ease: EASINGS.editorial, delay }
    );
  },
  staggerReveal: (targets: gsap.TweenTarget, stagger = 0.04) => {
    return gsap.fromTo(
      targets,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: DURATIONS.normal, ease: EASINGS.power3, stagger }
    );
  },
};
