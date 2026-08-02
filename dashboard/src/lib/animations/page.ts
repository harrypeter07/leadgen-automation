// dashboard/src/lib/animations/page.ts
import gsap from 'gsap';
import { DURATIONS, EASINGS } from './easings';

export function animatePageTransition(containerTarget: gsap.TweenTarget) {
  if (typeof window === 'undefined') return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  return gsap.fromTo(
    containerTarget,
    { opacity: 0, y: 16, filter: 'blur(4px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: DURATIONS.normal, ease: EASINGS.editorial }
  );
}
